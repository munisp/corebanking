// graphql-gateway-go — DECLARED STUB (W13-RISK-10).
//
// Disposition: this service is a PLACEHOLDER. A GraphQL gateway is legitimately
// stateless (no domain persistence — its correct form is a proxy/federation
// layer), but this build contains NO proxy, resolver, or schema-federation
// implementation at all: only /healthz and /. It must NOT be routed client
// GraphQL traffic. The stub status is intentionally explicit (startup log +
// health/root payloads) so the placeholder cannot be mistaken for a working
// gateway. There is no data-loss risk from persistence because a gateway owns
// no domain state; the risk is misrouting, which the explicit labeling
// addresses.
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

	log.Printf("[%s] WARNING: STUB gateway — no GraphQL proxy/resolver implementation; do not route client traffic (W13-RISK-10)", svc)
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
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": svc, "mode": "stub"})
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
	fmt.Fprintf(w, `{"service":"%s","status":"running","mode":"stub","detail":"no GraphQL proxy/resolver implemented — do not route client traffic (W13-RISK-10)"}`, svc)
}
