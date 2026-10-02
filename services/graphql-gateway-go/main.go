package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	svc := os.Getenv("SERVICE_NAME")
	if svc == "" {
		svc = "graphql-gateway-go"
	}

	http.HandleFunc("/healthz", healthHandler)

	http.HandleFunc("/", rootHandler)

	log.Printf("[%s] listening on :%s", svc, port)
	if err := (&http.Server{Addr: ":" + port, Handler: nil, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

// healthHandler serves /healthz (extracted from the inline closure in main; behavior unchanged).
func healthHandler(w http.ResponseWriter, r *http.Request) {
	svc := os.Getenv("SERVICE_NAME")
	if svc == "" {
		svc = "graphql-gateway-go"
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": svc})
}

// rootHandler serves / (extracted from the inline closure in main; behavior unchanged).
func rootHandler(w http.ResponseWriter, r *http.Request) {
	svc := os.Getenv("SERVICE_NAME")
	if svc == "" {
		svc = "graphql-gateway-go"
	}
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"service":"%s","status":"running"}`, svc)
}
