package main
import ("encoding/json";"fmt";"net/http";"os")
func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8333" }
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(map[string]interface{}{"status":"healthy","service":"debt-collection-go","port":port}) })
	http.HandleFunc("/api/debt-collection/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"service":"Debt Collection","port":port,"status":"active"})
	})
	http.HandleFunc("/api/debt-collection/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"kafka":map[string]interface{}{"topics":[]string{"debt-collection.events"}},"dapr":map[string]interface{}{"stateStore":"debt-collection-state"},"fluvio":map[string]interface{}{"topics":[]string{"debt-collection-stream"}},"temporal":map[string]interface{}{"workflows":[]string{"debt-collection-workflow"}},"postgres":map[string]interface{}{"tables":[]string{"debt-collection_config"}},"keycloak":map[string]interface{}{"roles":[]string{"debt-collection-admin"}},"permify":map[string]interface{}{"relations":[]string{"debt-collection:can_manage"}},"redis":map[string]interface{}{"keys":[]string{"debt-collection:cache"}},"mojaloop":map[string]interface{}{"oracle":"debt-collection-oracle"},"opensearch":map[string]interface{}{"indices":[]string{"debt-collection-events"}},"openappsec":map[string]interface{}{"policy":"debt-collection-protection"},"apisix":map[string]interface{}{"route":"/api/debt-collection/*"},"tigerbeetle":map[string]interface{}{"accounts":[]string{}},"lakehouse":map[string]interface{}{"tables":[]string{"debt-collection_analytics"}}})
	})
	fmt.Printf("Debt Collection on :%s\n", port); http.ListenAndServe(":"+port, nil)
}
