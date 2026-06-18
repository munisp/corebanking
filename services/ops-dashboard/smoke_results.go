package main

import (
	"database/sql"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

type SmokeResult struct {
	ServiceName string    `json:"service_name"`
	Status      string    `json:"status"`
	ErrorDetail *string   `json:"error_detail,omitempty"`
	CheckedAt   time.Time `json:"checked_at"`
}

func openSmokeDB(rawURL string) *sql.DB {
	if rawURL == "" {
		return nil
	}
	// Ensure sslmode=require for DigitalOcean Managed Postgres
	dsn := rawURL
	if !strings.Contains(dsn, "sslmode") {
		if strings.Contains(dsn, "?") {
			dsn += "&sslmode=require"
		} else {
			dsn += "?sslmode=require"
		}
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("smoke-results: failed to open DB: %v", err)
		return nil
	}
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	return db
}

func (od *OpsDashboard) getSmokeResults(c *gin.Context) {
	if od.smokeDB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "database not configured",
			"results": []SmokeResult{},
			"total":   0,
		})
		return
	}

	rows, err := od.smokeDB.QueryContext(c.Request.Context(), `
		SELECT DISTINCT ON (service_name)
			service_name, status, error_detail, created_at
		FROM smoke_test
		ORDER BY service_name, created_at DESC
	`)
	if err != nil {
		log.Printf("smoke-results: query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	results := make([]SmokeResult, 0, 64)
	for rows.Next() {
		var r SmokeResult
		if err := rows.Scan(&r.ServiceName, &r.Status, &r.ErrorDetail, &r.CheckedAt); err != nil {
			log.Printf("smoke-results: scan error: %v", err)
			continue
		}
		results = append(results, r)
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].ServiceName < results[j].ServiceName
	})
	c.JSON(http.StatusOK, gin.H{"results": results, "total": len(results)})
}
