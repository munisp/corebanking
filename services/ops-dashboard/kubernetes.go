package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// healthPaths is the ordered list of well-known health-check paths tried per service.
var healthPaths = []string{"/health", "/healthz", "/ready", "/livez"}

const (
	k8sTokenPath  = "/var/run/secrets/kubernetes.io/serviceaccount/token"
	k8sCACertPath = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
	k8sNSPath     = "/var/run/secrets/kubernetes.io/serviceaccount/namespace"
	k8sAPIServer  = "https://kubernetes.default.svc"
)

type KubernetesClient struct {
	apiServer  string
	token      string
	namespace  string
	httpClient *http.Client
}

// NewKubernetesClient creates an in-cluster client using the pod's mounted service account.
// Returns nil when not running inside Kubernetes (local dev, etc.).
func NewKubernetesClient() *KubernetesClient {
	tokenBytes, err := os.ReadFile(k8sTokenPath)
	if err != nil {
		return nil
	}
	nsBytes, err := os.ReadFile(k8sNSPath)
	if err != nil {
		return nil
	}
	caCert, err := os.ReadFile(k8sCACertPath)
	if err != nil {
		return nil
	}
	pool := x509.NewCertPool()
	pool.AppendCertsFromPEM(caCert)

	return &KubernetesClient{
		apiServer: k8sAPIServer,
		token:     strings.TrimSpace(string(tokenBytes)),
		namespace: strings.TrimSpace(string(nsBytes)),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{RootCAs: pool},
			},
		},
	}
}

type k8sPodList struct {
	Items []struct {
		Metadata struct {
			Name   string            `json:"name"`
			Labels map[string]string `json:"labels"`
		} `json:"metadata"`
		Status struct {
			Phase             string `json:"phase"`
			ContainerStatuses []struct {
				Name         string `json:"name"`
				Ready        bool   `json:"ready"`
				RestartCount int    `json:"restartCount"`
			} `json:"containerStatuses"`
			InitContainerStatuses []struct {
				Ready bool `json:"ready"`
			} `json:"initContainerStatuses"`
		} `json:"status"`
	} `json:"items"`
}

// FetchPodHealth lists all pods in the namespace and returns a ServiceHealth map.
// The service name is taken from the pod's app / app.kubernetes.io/name label.
// Multiple pods for the same service are merged by taking the worst status.
func (c *KubernetesClient) FetchPodHealth() (map[string]ServiceHealth, error) {
	reqURL := fmt.Sprintf("%s/api/v1/namespaces/%s/pods", c.apiServer, c.namespace)
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var podList k8sPodList
	if err := json.Unmarshal(body, &podList); err != nil {
		return nil, fmt.Errorf("decode pods: %w", err)
	}

	now := time.Now().UTC()
	health := make(map[string]ServiceHealth)

	for _, pod := range podList.Items {
		// Resolve service name from standard labels
		svcName := pod.Metadata.Labels["app"]
		if svcName == "" {
			svcName = pod.Metadata.Labels["app.kubernetes.io/name"]
		}
		if svcName == "" {
			continue
		}

		// Determine pod health
		status := podStatus(pod.Status.Phase, pod.Status.ContainerStatuses)

		// Merge: keep the worst status across replica pods
		if existing, ok := health[svcName]; ok {
			if statusWeight(status) > statusWeight(existing.Status) {
				existing.Status = status
				existing.LastCheck = now
				health[svcName] = existing
			}
		} else {
			health[svcName] = ServiceHealth{Name: svcName, Status: status, LastCheck: now}
		}
	}

	return health, nil
}

func podStatus(phase string, containers []struct {
	Name         string `json:"name"`
	Ready        bool   `json:"ready"`
	RestartCount int    `json:"restartCount"`
}) string {
	switch phase {
	case "Succeeded":
		return "healthy" // completed jobs
	case "Failed", "Unknown":
		return "down"
	case "Pending":
		return "degraded"
	}
	// Phase == Running — check container readiness
	for _, cs := range containers {
		if !cs.Ready {
			return "degraded"
		}
		if cs.RestartCount > 5 {
			return "degraded"
		}
	}
	return "healthy"
}

func statusWeight(s string) int {
	switch s {
	case "down":
		return 2
	case "degraded":
		return 1
	default:
		return 0
	}
}

type k8sServiceList struct {
	Items []struct {
		Metadata struct {
			Name   string            `json:"name"`
			Labels map[string]string `json:"labels"`
		} `json:"metadata"`
		Spec struct {
			ClusterIP string `json:"clusterIP"`
			Ports     []struct {
				Port     int    `json:"port"`
				Protocol string `json:"protocol"`
			} `json:"ports"`
		} `json:"spec"`
	} `json:"items"`
}

// ProbeServiceHealth fetches the K8s service list and HTTP-probes each service
// concurrently, trying healthPaths in order until one responds successfully.
func (c *KubernetesClient) ProbeServiceHealth() (map[string]ServiceHealth, error) {
	reqURL := fmt.Sprintf("%s/api/v1/namespaces/%s/services", c.apiServer, c.namespace)
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var svcList k8sServiceList
	if err := json.Unmarshal(body, &svcList); err != nil {
		return nil, fmt.Errorf("decode services: %w", err)
	}

	probeClient := &http.Client{Timeout: 3 * time.Second}
	now := time.Now().UTC()
	health := make(map[string]ServiceHealth)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, svc := range svcList.Items {
		if svc.Spec.ClusterIP == "" || svc.Spec.ClusterIP == "None" {
			continue
		}
		if len(svc.Spec.Ports) == 0 {
			continue
		}
		name := svc.Metadata.Name
		baseURL := fmt.Sprintf("http://%s:%d", svc.Spec.ClusterIP, svc.Spec.Ports[0].Port)

		wg.Add(1)
		go func(name, baseURL string) {
			defer wg.Done()
			status, latencyMS := probeHealth(probeClient, baseURL)
			mu.Lock()
			health[name] = ServiceHealth{Name: name, Status: status, LatencyMS: latencyMS, LastCheck: now}
			mu.Unlock()
		}(name, baseURL)
	}

	wg.Wait()
	return health, nil
}

// probeHealth tries each path in healthPaths and returns on the first response.
// Returns "down" with 0 ms if all paths fail to connect.
func probeHealth(client *http.Client, baseURL string) (status string, latencyMS float64) {
	for _, path := range healthPaths {
		start := time.Now()
		resp, err := client.Get(baseURL + path)
		elapsed := float64(time.Since(start).Milliseconds())
		if err != nil {
			continue
		}
		resp.Body.Close()
		if resp.StatusCode >= 500 {
			return "down", elapsed
		}
		if resp.StatusCode >= 400 {
			return "degraded", elapsed
		}
		return "healthy", elapsed
	}
	return "down", 0
}
