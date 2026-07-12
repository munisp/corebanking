package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AlertManagerClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewAlertManagerClient(baseURL string) *AlertManagerClient {
	return &AlertManagerClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type amAlert struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	StartsAt    time.Time         `json:"startsAt"`
	Status      struct {
		State string `json:"state"`
	} `json:"status"`
}

// FetchActiveAlerts queries AlertManager's v2 API for active, unsilenced alerts
// and converts them to the internal Alert type.
func (c *AlertManagerClient) FetchActiveAlerts() ([]Alert, error) {
	reqURL := fmt.Sprintf("%s/api/v2/alerts?active=true&silenced=false&inhibited=false", c.baseURL)
	resp, err := c.httpClient.Get(reqURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var raw []amAlert
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}

	alerts := make([]Alert, 0, len(raw))
	for _, a := range raw {
		if a.Status.State != "active" {
			continue
		}

		name := a.Labels["alertname"]
		if name == "" {
			continue
		}

		severity := a.Labels["severity"]
		if severity == "" {
			severity = "warning"
		}

		// Prefer job, then service, then app label for the service name
		service := a.Labels["job"]
		if service == "" {
			service = a.Labels["service"]
		}
		if service == "" {
			service = a.Labels["app"]
		}

		message := a.Annotations["summary"]
		if message == "" {
			message = a.Annotations["description"]
		}
		if message == "" {
			message = name
		}

		// Carry all labels except the ones already surfaced as top-level fields
		labels := make(map[string]string)
		for k, v := range a.Labels {
			if k != "alertname" && k != "severity" {
				labels[k] = v
			}
		}

		alerts = append(alerts, Alert{
			Name:      name,
			Severity:  severity,
			Message:   message,
			Service:   service,
			StartedAt: a.StartsAt,
			Labels:    labels,
		})
	}
	return alerts, nil
}
