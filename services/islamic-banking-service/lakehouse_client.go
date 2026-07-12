package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type LakehouseClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

type LakehouseEvent struct {
	EventType string                 `json:"event_type"`
	Timestamp time.Time              `json:"timestamp"`
	Service   string                 `json:"service"`
	Data      map[string]interface{} `json:"data"`
}

func NewLakehouseClient() *LakehouseClient {
	baseURL := os.Getenv("LAKEHOUSE_URL")
	if baseURL == "" {
		baseURL = "http://lakehouse-service:8080"
	}

	return &LakehouseClient{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *LakehouseClient) PublishEvent(eventType string, data map[string]interface{}, service string) error {
	if c == nil {
		log.Printf("Lakehouse client not initialized, skipping event: %s", eventType)
		return nil
	}

	event := LakehouseEvent{
		EventType: eventType,
		Timestamp: time.Now(),
		Service:   service,
		Data:      data,
	}

	jsonData, err := json.Marshal(event)
	if err != nil {
		log.Printf("Error marshaling event: %v", err)
		return err
	}

	endpoint := fmt.Sprintf("%s/api/v1/events", c.BaseURL)
	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Error creating request: %v", err)
		return err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		log.Printf("Error publishing event to lakehouse: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		log.Printf("Lakehouse returned non-success status: %d", resp.StatusCode)
		return fmt.Errorf("lakehouse returned status: %d", resp.StatusCode)
	}

	log.Printf("Event published to lakehouse: %s", eventType)
	return nil
}
