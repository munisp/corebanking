package main

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type PrometheusClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewPrometheusClient(baseURL string) *PrometheusClient {
	return &PrometheusClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type promSample struct {
	Metric map[string]string
	Value  float64
}

func (c *PrometheusClient) queryVector(query string) ([]promSample, error) {
	reqURL := fmt.Sprintf("%s/api/v1/query?query=%s", c.baseURL, url.QueryEscape(query))
	resp, err := c.httpClient.Get(reqURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Status string `json:"status"`
		Data   struct {
			ResultType string `json:"resultType"`
			Result     []struct {
				Metric map[string]string `json:"metric"`
				Value  [2]json.RawMessage `json:"value"`
			} `json:"result"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	if result.Status != "success" {
		return nil, fmt.Errorf("prometheus status: %s", result.Status)
	}

	samples := make([]promSample, 0, len(result.Data.Result))
	for _, r := range result.Data.Result {
		var valStr string
		if err := json.Unmarshal(r.Value[1], &valStr); err != nil {
			continue
		}
		val, err := strconv.ParseFloat(valStr, 64)
		if err != nil || math.IsNaN(val) || math.IsInf(val, 0) {
			continue
		}
		samples = append(samples, promSample{Metric: r.Metric, Value: val})
	}
	return samples, nil
}

// jobLabel picks the best label to use as the service/job name.
func jobLabel(metric map[string]string) string {
	for _, k := range []string{"job", "service", "app", "container"} {
		if v := metric[k]; v != "" {
			return v
		}
	}
	return metric["instance"]
}

// FetchServiceHealth queries Prometheus for the health of all scraped services.
// It uses three queries:
//  1. `up`            — whether each job is reachable
//  2. P95 latency     — derived from http_request_duration_seconds_bucket
//  3. HTTP error rate — 5xx / total over the last 5 minutes
func (c *PrometheusClient) FetchServiceHealth() (map[string]ServiceHealth, error) {
	now := time.Now().UTC()
	health := make(map[string]ServiceHealth)

	// 1. Up/down status
	upSamples, err := c.queryVector("up")
	if err != nil {
		return nil, fmt.Errorf("up query: %w", err)
	}
	for _, s := range upSamples {
		job := jobLabel(s.Metric)
		if job == "" {
			continue
		}
		status := "healthy"
		if s.Value == 0 {
			status = "down"
		}
		health[job] = ServiceHealth{Name: job, Status: status, LastCheck: now}
	}

	if len(health) == 0 {
		return health, nil
	}

	// 2. P95 latency (seconds → ms)
	latSamples, _ := c.queryVector(
		`histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (job, le))`,
	)
	for _, s := range latSamples {
		job := jobLabel(s.Metric)
		if svc, ok := health[job]; ok {
			svc.LatencyMS = math.Round(s.Value*1000*100) / 100
			if svc.Status == "healthy" && svc.LatencyMS > 500 {
				svc.Status = "degraded"
			}
			health[job] = svc
		}
	}

	// 3. HTTP 5xx error rate (%)
	errSamples, _ := c.queryVector(
		`100 * sum(rate(http_requests_total{code=~"5.."}[5m])) by (job)` +
			` / sum(rate(http_requests_total[5m])) by (job)`,
	)
	for _, s := range errSamples {
		job := jobLabel(s.Metric)
		if svc, ok := health[job]; ok {
			svc.ErrorRate = math.Round(s.Value*100) / 100
			if svc.Status == "healthy" && svc.ErrorRate > 1.0 {
				svc.Status = "degraded"
			}
			health[job] = svc
		}
	}

	return health, nil
}
