package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	ginAuditSvcURL      = os.Getenv("AUDIT_SVC_URL")
	ginAuditIngestToken = os.Getenv("AUDIT_INGEST_TOKEN") // AU-01
	ginSkipPrefixes     = []string{"/health", "/metrics", "/dapr", "/docs", "/ready"}
	ginAuditUUIDRE      = regexp.MustCompile(`/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)
	ginAuditIntRE       = regexp.MustCompile(`/[0-9]+`)
)

// auditShipFailures implements the w9 alerting contract counter
// audit_ship_failures_total{service,tenant_id} for audit shipping failures.
var auditShipFailures = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "audit_ship_failures_total",
		Help: "Audit event shipping failures (w9 alerting contract).",
	},
	[]string{"service", "tenant_id"},
)

func init() {
	if ginAuditSvcURL == "" {
		ginAuditSvcURL = "http://audit-service:8000"
	}
}

func ginAuditPathToEventType(method, path string) string {
	clean := ginAuditUUIDRE.ReplaceAllString(path, "/{id}")
	clean = ginAuditIntRE.ReplaceAllString(clean, "/{id}")
	return fmt.Sprintf("%s:%s", method, clean)
}

func ginSendAuditEvent(actorID, tenantID, eventType string, eventData map[string]interface{}) {
	payload, err := json.Marshal(map[string]interface{}{
		"actor_id":   actorID,
		"tenant_id":  tenantID,
		"event_type": eventType,
		"event_data": eventData,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return
	}
	req, err := http.NewRequest("POST", ginAuditSvcURL+"/audits", bytes.NewBuffer(payload))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-tenant-id", tenantID)
	req.Header.Set("x-keycloak-id", "system")
	if ginAuditIngestToken != "" {
		// AU-01 (F15-1): shared ingest credential; audit-service fails closed without it.
		req.Header.Set("X-Audit-Ingest-Token", ginAuditIngestToken)
	}
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		auditShipFailures.WithLabelValues("mortgage-service", tenantID).Inc()
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		auditShipFailures.WithLabelValues("mortgage-service", tenantID).Inc()
	}
}

func auditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		if method == "GET" || method == "HEAD" || method == "OPTIONS" {
			c.Next()
			return
		}
		path := c.Request.URL.Path
		for _, p := range ginSkipPrefixes {
			if strings.HasPrefix(path, p) {
				c.Next()
				return
			}
		}

		c.Next()

		actorID := c.GetHeader("X-Keycloak-ID")
		if actorID == "" {
			actorID = c.GetHeader("x-keycloak-id")
		}
		if actorID == "" {
			actorID = "unknown"
		}
		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "unknown"
		}
		eventData := map[string]interface{}{
			"method":      method,
			"path":        path,
			"status_code": c.Writer.Status(),
		}
		if c.Request.URL.RawQuery != "" {
			eventData["query"] = c.Request.URL.RawQuery
		}

		go ginSendAuditEvent(actorID, tenantID, ginAuditPathToEventType(method, path), eventData)
	}
}
