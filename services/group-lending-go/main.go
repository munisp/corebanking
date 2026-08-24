package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	svc := os.Getenv("SERVICE_NAME")
	if svc == "" {
		svc = "group-lending-go"
	}

	http.HandleFunc("/healthz", healthHandler)

	http.HandleFunc("/", rootHandler)

	log.Printf("[%s] listening on :%s", svc, port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

// healthHandler serves /healthz (extracted from the inline closure in main; behavior unchanged).
func healthHandler(w http.ResponseWriter, r *http.Request) {
	svc := os.Getenv("SERVICE_NAME")
	if svc == "" {
		svc = "group-lending-go"
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": svc})
}

// rootHandler serves / (extracted from the inline closure in main; behavior unchanged).
func rootHandler(w http.ResponseWriter, r *http.Request) {
	svc := os.Getenv("SERVICE_NAME")
	if svc == "" {
		svc = "group-lending-go"
	}
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"service":"%s","status":"running"}`, svc)
}
