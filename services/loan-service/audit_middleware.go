package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	ginAuditSvcURL  = os.Getenv("AUDIT_SVC_URL")
	ginSkipPrefixes = []string{"/health", "/metrics", "/dapr", "/docs", "/ready"}
	ginAuditUUIDRE  = regexp.MustCompile(`/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)
	ginAuditIntRE   = regexp.MustCompile(`/[0-9]+`)
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
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
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
