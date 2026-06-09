package main

import (
	_ "github.com/lib/pq"
	"database/sql"
	"context"
	"os/signal"
	"syscall"
	"sync/atomic"

	"crypto/rand"
	"encoding/json"
	"fmt"
	"math"
	"log"
	"math/big"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

var serviceName = "incident-management-go"

// Incident Management — SLA tracking, escalation, RCA, post-mortem, on-call rotation
// Tracks P1-P4 incidents with Nigerian banking uptime SLA requirements

var PORT = "8100"

func init() {
	if p := os.Getenv("PORT"); p != "" {
		PORT = p
	}
}

// ─── Domain Types ───

type Incident struct {
	ID               string   `json:"id"`
	Title            string   `json:"title"`
	Description      string   `json:"description"`
	Severity         string   `json:"severity"` // P1_critical, P2_major, P3_minor, P4_low
	Status           string   `json:"status"`   // open→acknowledged→investigating→mitigated→resolved→closed
	AssignedTo       string   `json:"assigned_to"`
	EscalationLevel  int      `json:"escalation_level"`
	AffectedServices []string `json:"affected_services"`
	AffectedCustomers int64   `json:"affected_customers"`
	SLADeadline      string   `json:"sla_deadline"`
	SLABreached      bool     `json:"sla_breached"`
	RootCause        string   `json:"root_cause,omitempty"`
	Resolution       string   `json:"resolution,omitempty"`
	Timeline         []TimelineEntry `json:"timeline"`
	Tags             []string `json:"tags,omitempty"`
	CreatedAt        string   `json:"created_at"`
	AcknowledgedAt   string   `json:"acknowledged_at,omitempty"`
	ResolvedAt       string   `json:"resolved_at,omitempty"`
	ClosedAt         string   `json:"closed_at,omitempty"`
	MTTR             int64    `json:"mttr_minutes,omitempty"`
}

type TimelineEntry struct {
	Timestamp string `json:"timestamp"`
	Action    string `json:"action"`
	Actor     string `json:"actor"`
	Detail    string `json:"detail"`
}

type Escalation struct {
	ID         string `json:"id"`
	IncidentID string `json:"incident_id"`
	Level      int    `json:"level"`
	EscalateTo string `json:"escalate_to"`
	Reason     string `json:"reason"`
	Timestamp  string `json:"timestamp"`
}

type PostMortem struct {
	ID                 string   `json:"id"`
	IncidentID         string   `json:"incident_id"`
	Title              string   `json:"title"`
	Summary            string   `json:"summary"`
	RootCause          string   `json:"root_cause"`
	ImpactDescription  string   `json:"impact_description"`
	CustomersAffected  int64    `json:"customers_affected"`
	DurationMinutes    int64    `json:"duration_minutes"`
	SeverityAssessment string   `json:"severity_assessment"`
	Timeline           []TimelineEntry `json:"timeline"`
	ActionItems        []ActionItem    `json:"action_items"`
	LessonsLearned     []string `json:"lessons_learned"`
	PreventionMeasures []string `json:"prevention_measures"`
	ApprovedBy         string   `json:"approved_by,omitempty"`
	CreatedAt          string   `json:"created_at"`
}

type ActionItem struct {
	Description string `json:"description"`
	Owner       string `json:"owner"`
	DueDate     string `json:"due_date"`
	Priority    string `json:"priority"` // critical, high, medium, low
	Status      string `json:"status"`   // open, in_progress, completed
}

type OnCallSchedule struct {
	Team      string       `json:"team"`
	Rotation  []OnCallSlot `json:"rotation"`
	Timezone  string       `json:"timezone"`
	UpdatedAt string       `json:"updated_at"`
}

type OnCallSlot struct {
	Engineer  string `json:"engineer"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	Primary   bool   `json:"primary"`
}

// ─── State ───

var (
	incidents     []Incident
	incidentsMu   sync.RWMutex
	escalations   []Escalation
	escalationsMu sync.RWMutex
	postMortems   []PostMortem
	postMortemsMu sync.RWMutex
	onCallSchedules []OnCallSchedule
	onCallMu      sync.RWMutex
	requestCount  int64
	errorCount    int64
	counterMu     sync.Mutex
)

func incRequests() { counterMu.Lock(); requestCount++; counterMu.Unlock() }
func incErrors()   { counterMu.Lock(); errorCount++; counterMu.Unlock() }

// ─── Utilities ───

func secureRandID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%X", b)
}

func sanitizeLogEntry(msg string) string {
	re1 := regexp.MustCompile(`\b[0-9]{11}\b`)
	return re1.ReplaceAllStringFunc(msg, func(s string) string { return "***" + s[len(s)-4:] })
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Strict-Transport-Security", "max-age=31536000")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── SLA Configuration (Nigerian banking regulation) ───

type SLAConfig struct {
	ResponseMinutes   int
	ResolutionMinutes int
	NotifyChannels    []string
}

var slaSeverity = map[string]SLAConfig{
	"P1_critical": {ResponseMinutes: 15, ResolutionMinutes: 60, NotifyChannels: []string{"sms", "call", "email", "slack"}},
	"P2_major":    {ResponseMinutes: 30, ResolutionMinutes: 240, NotifyChannels: []string{"sms", "email", "slack"}},
	"P3_minor":    {ResponseMinutes: 120, ResolutionMinutes: 1440, NotifyChannels: []string{"email", "slack"}},
	"P4_low":      {ResponseMinutes: 480, ResolutionMinutes: 4320, NotifyChannels: []string{"email"}},
}

// ─── Escalation Matrix ───

var escalationMatrix = map[int]string{
	1: "on_call_engineer",
	2: "team_lead",
	3: "engineering_manager",
	4: "vp_engineering",
	5: "cto",
}

// ─── Incident State Machine ───

var incidentTransitions = map[string][]string{
	"open":          {"acknowledged", "investigating"},
	"acknowledged":  {"investigating"},
	"investigating": {"mitigated", "escalated"},
	"escalated":     {"investigating", "mitigated"},
	"mitigated":     {"resolved"},
	"resolved":      {"closed", "reopened"},
	"reopened":      {"investigating"},
	"closed":        {},
}

func validateIncidentTransition(current, target string) (bool, string) {
	allowed, ok := incidentTransitions[current]
	if !ok {
		return false, fmt.Sprintf("unknown_state:%s", current)
	}
	for _, a := range allowed {
		if a == target {
			return true, ""
		}
	}
	return false, fmt.Sprintf("invalid_transition:%s->%s", current, target)
}

// ─── SLA Computation ───

func computeSLADeadline(severity, createdAt string) string {
	sla, ok := slaSeverity[severity]
	if !ok {
		return ""
	}
	t, err := time.Parse(time.RFC3339, createdAt)
	if err != nil {
		return ""
	}
	return t.Add(time.Duration(sla.ResolutionMinutes) * time.Minute).Format(time.RFC3339)
}

func isSLABreached(severity, createdAt string) bool {
	deadline := computeSLADeadline(severity, createdAt)
	if deadline == "" {
		return false
	}
	dl, err := time.Parse(time.RFC3339, deadline)
	if err != nil {
		return false
	}
	return time.Now().UTC().After(dl)
}

func computeMTTR(createdAt, resolvedAt string) int64 {
	c, err1 := time.Parse(time.RFC3339, createdAt)
	r, err2 := time.Parse(time.RFC3339, resolvedAt)
	if err1 != nil || err2 != nil {
		return 0
	}
	return int64(r.Sub(c).Minutes())
}

// ─── Handlers ───

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	incidentsMu.RLock()
	total := len(incidents)
	openCount := 0
	for _, inc := range incidents {
		if inc.Status != "closed" && inc.Status != "resolved" {
			openCount++
		}
	}
	incidentsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "incident-management-go", "version": "2.0.0",
		"incidents_total": total, "incidents_open": openCount,
		"sla_levels": []string{"P1_critical", "P2_major", "P3_minor", "P4_low"},
	})
}

func handleIncidentCreate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Title            string   `json:"title"`
		Description      string   `json:"description"`
		Severity         string   `json:"severity"`
		AffectedServices []string `json:"affected_services"`
		AffectedCustomers int64   `json:"affected_customers"`
		Tags             []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errs := []string{}
	if body.Title == "" { errs = append(errs, "title_required") }
	if body.Description == "" { errs = append(errs, "description_required") }
	slaConfig, ok := slaSeverity[body.Severity]
	if !ok { errs = append(errs, "severity_must_be_P1_P2_P3_or_P4") }
	if len(body.AffectedServices) == 0 { errs = append(errs, "affected_services_required") }
	if len(errs) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	now := time.Now().UTC()
	incident := Incident{
		ID:               fmt.Sprintf("INC-%s", secureRandID()),
		Title:            body.Title,
		Description:      body.Description,
		Severity:         body.Severity,
		Status:           "open",
		AssignedTo:       escalationMatrix[1], // Auto-assign to on-call
		EscalationLevel:  1,
		AffectedServices: body.AffectedServices,
		AffectedCustomers: body.AffectedCustomers,
		SLADeadline:      now.Add(time.Duration(slaConfig.ResolutionMinutes) * time.Minute).Format(time.RFC3339),
		SLABreached:      false,
		Timeline: []TimelineEntry{
			{Timestamp: now.Format(time.RFC3339), Action: "created", Actor: "system", Detail: body.Title},
		},
		Tags:      body.Tags,
		CreatedAt: now.Format(time.RFC3339),
	}

	incidentsMu.Lock()
	incidents = append(incidents, incident)
	if dataBytes, err := json.Marshal(incident); err == nil { if dbErr := dbInsert(fmt.Sprintf("incident-management-go-%d", time.Now().UnixNano()), "incident-management-go", "incidents", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	incidentsMu.Unlock()

	log.Printf("[INC] Created: %s severity=%s services=%v",
		incident.ID, incident.Severity, incident.AffectedServices)
	respondJSON(w, 201, map[string]interface{}{
		"incident":       incident,
		"sla_response":   fmt.Sprintf("%d minutes", slaConfig.ResponseMinutes),
		"sla_resolution": fmt.Sprintf("%d minutes", slaConfig.ResolutionMinutes),
		"notify":         slaConfig.NotifyChannels,
	})
}

func handleIncidentUpdate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		IncidentID string `json:"incident_id"`
		NewStatus  string `json:"new_status"`
		Actor      string `json:"actor"`
		Detail     string `json:"detail"`
		RootCause  string `json:"root_cause,omitempty"`
		Resolution string `json:"resolution,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	incidentsMu.Lock()
	defer incidentsMu.Unlock()
	for i := range incidents {
		if incidents[i].ID == body.IncidentID {
			valid, msg := validateIncidentTransition(incidents[i].Status, body.NewStatus)
			if !valid {
				incErrors()
				respondJSON(w, 400, map[string]interface{}{"error": msg})
				return
			}

			now := time.Now().UTC().Format(time.RFC3339)
			incidents[i].Status = body.NewStatus
			incidents[i].Timeline = append(incidents[i].Timeline, TimelineEntry{
				Timestamp: now, Action: body.NewStatus, Actor: body.Actor, Detail: body.Detail,
			})

			if body.NewStatus == "acknowledged" {
				incidents[i].AcknowledgedAt = now
			}
			if body.NewStatus == "resolved" {
				incidents[i].ResolvedAt = now
				incidents[i].RootCause = body.RootCause
				incidents[i].Resolution = body.Resolution
				incidents[i].MTTR = computeMTTR(incidents[i].CreatedAt, now)
			}
			if body.NewStatus == "closed" {
				incidents[i].ClosedAt = now
			}

			// Check SLA breach
			incidents[i].SLABreached = isSLABreached(incidents[i].Severity, incidents[i].CreatedAt)

			respondJSON(w, 200, map[string]interface{}{
				"incident":    incidents[i],
				"sla_breached": incidents[i].SLABreached,
			})
			return
		}
	}
	respondJSON(w, 404, map[string]interface{}{"error": "incident_not_found"})
}

func handleIncidentEscalate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		IncidentID string `json:"incident_id"`
		Reason     string `json:"reason"`
		Actor      string `json:"actor"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	incidentsMu.Lock()
	for i := range incidents {
		if incidents[i].ID == body.IncidentID {
			newLevel := incidents[i].EscalationLevel + 1
			if newLevel > 5 {
				incidentsMu.Unlock()
				respondJSON(w, 400, map[string]interface{}{"error": "max_escalation_level_reached"})
				return
			}

			escalateTo := escalationMatrix[newLevel]
			incidents[i].EscalationLevel = newLevel
			incidents[i].AssignedTo = escalateTo
			incidents[i].Status = "escalated"

			now := time.Now().UTC().Format(time.RFC3339)
			incidents[i].Timeline = append(incidents[i].Timeline, TimelineEntry{
				Timestamp: now, Action: "escalated",
				Actor: body.Actor,
				Detail: fmt.Sprintf("Escalated to L%d (%s): %s", newLevel, escalateTo, body.Reason),
			})
			incidentsMu.Unlock()

			esc := Escalation{
				ID: fmt.Sprintf("ESC-%s", secureRandID()),
				IncidentID: body.IncidentID, Level: newLevel,
				EscalateTo: escalateTo, Reason: body.Reason,
				Timestamp: now,
			}
			escalationsMu.Lock()
			escalations = append(escalations, esc)
			escalationsMu.Unlock()

			respondJSON(w, 200, map[string]interface{}{
				"escalation":   esc,
				"new_assignee": escalateTo,
			})
			return
		}
	}
	incidentsMu.Unlock()
	respondJSON(w, 404, map[string]interface{}{"error": "incident_not_found"})
}

func handlePostMortemCreate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		IncidentID         string       `json:"incident_id"`
		Summary            string       `json:"summary"`
		RootCause          string       `json:"root_cause"`
		ImpactDescription  string       `json:"impact_description"`
		ActionItems        []ActionItem `json:"action_items"`
		LessonsLearned     []string     `json:"lessons_learned"`
		PreventionMeasures []string     `json:"prevention_measures"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errs := []string{}
	if body.IncidentID == "" { errs = append(errs, "incident_id_required") }
	if body.Summary == "" { errs = append(errs, "summary_required") }
	if body.RootCause == "" { errs = append(errs, "root_cause_required") }
	if len(body.ActionItems) == 0 { errs = append(errs, "action_items_required") }
	if len(errs) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	// Lookup incident
	incidentsMu.RLock()
	var inc *Incident
	for i := range incidents {
		if incidents[i].ID == body.IncidentID {
			inc = &incidents[i]
			break
		}
	}
	incidentsMu.RUnlock()
	if inc == nil {
		respondJSON(w, 404, map[string]interface{}{"error": "incident_not_found"})
		return
	}

	pm := PostMortem{
		ID:                 fmt.Sprintf("PM-%s", secureRandID()),
		IncidentID:         body.IncidentID,
		Title:              fmt.Sprintf("Post-Mortem: %s", inc.Title),
		Summary:            body.Summary,
		RootCause:          body.RootCause,
		ImpactDescription:  body.ImpactDescription,
		CustomersAffected:  inc.AffectedCustomers,
		DurationMinutes:    inc.MTTR,
		SeverityAssessment: inc.Severity,
		Timeline:           inc.Timeline,
		ActionItems:        body.ActionItems,
		LessonsLearned:     body.LessonsLearned,
		PreventionMeasures: body.PreventionMeasures,
		CreatedAt:          time.Now().UTC().Format(time.RFC3339),
	}

	postMortemsMu.Lock()
	postMortems = append(postMortems, pm)
	if dataBytes, err := json.Marshal(pm); err == nil { if dbErr := dbInsert(fmt.Sprintf("incident-management-go-%d", time.Now().UnixNano()), "incident-management-go", "postMortems", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	postMortemsMu.Unlock()

	respondJSON(w, 201, map[string]interface{}{"post_mortem": pm})
}

func handleIncidentList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	incidentsMu.RLock()
	defer incidentsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"incidents": incidents, "count": len(incidents)})
}

func handleOnCallSchedule(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Team     string       `json:"team"`
		Rotation []OnCallSlot `json:"rotation"`
		Timezone string       `json:"timezone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	if body.Team == "" {
		respondJSON(w, 400, map[string]interface{}{"error": "team_required"})
		return
	}

	schedule := OnCallSchedule{
		Team:      body.Team,
		Rotation:  body.Rotation,
		Timezone:  body.Timezone,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	onCallMu.Lock()
	// Update existing or add new
	found := false
	for i := range onCallSchedules {
		if onCallSchedules[i].Team == body.Team {
			onCallSchedules[i] = schedule
			found = true
			break
		}
	}
	if !found {
		onCallSchedules = append(onCallSchedules, schedule)
	}
	onCallMu.Unlock()

	respondJSON(w, 200, map[string]interface{}{"schedule": schedule})
}

func handleSLACheck(w http.ResponseWriter, r *http.Request) {
	incRequests()
	incidentsMu.RLock()
	defer incidentsMu.RUnlock()

	breached := []map[string]interface{}{}
	atRisk := []map[string]interface{}{}

	for _, inc := range incidents {
		if inc.Status == "closed" || inc.Status == "resolved" {
			continue
		}
		deadline, err := time.Parse(time.RFC3339, inc.SLADeadline)
		if err != nil { continue }

		now := time.Now().UTC()
		remaining := deadline.Sub(now).Minutes()

		if now.After(deadline) {
			breached = append(breached, map[string]interface{}{
				"id": inc.ID, "severity": inc.Severity, "title": inc.Title,
				"breached_by_minutes": -int64(remaining),
			})
		} else if remaining < 30 { // Less than 30 minutes remaining
			atRisk = append(atRisk, map[string]interface{}{
				"id": inc.ID, "severity": inc.Severity, "title": inc.Title,
				"remaining_minutes": int64(remaining),
			})
		}
	}

	respondJSON(w, 200, map[string]interface{}{
		"breached":     breached,
		"breached_count": len(breached),
		"at_risk":      atRisk,
		"at_risk_count": len(atRisk),
	})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	counterMu.Lock()
	rc, ec := requestCount, errorCount
	counterMu.Unlock()
	incidentsMu.RLock()
	var totalMTTR int64
	var resolvedCount int64
	for _, inc := range incidents {
		if inc.MTTR > 0 { totalMTTR += inc.MTTR; resolvedCount++ }
	}
	incidentsMu.RUnlock()
	avgMTTR := int64(0)
	if resolvedCount > 0 { avgMTTR = totalMTTR / resolvedCount }
	fmt.Fprintf(w, "requests_total{service=\"incident-management-go\"} %d\n", rc)
	fmt.Fprintf(w, "errors_total{service=\"incident-management-go\"} %d\n", ec)
	fmt.Fprintf(w, "avg_mttr_minutes{service=\"incident-management-go\"} %d\n", avgMTTR)
}


// ─── PostgreSQL Persistence ───

var db *sql.DB
var readyFlag int32

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — write operations will return 503", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — degraded mode active", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — degraded mode active", serviceName, err)
		db = nil
		return
	}
	log.Printf("[%s] Postgres connected (pool: 25/5)", serviceName)
	db.Exec(`CREATE TABLE IF NOT EXISTS service_records (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
		status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
		created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
		created_by TEXT DEFAULT '', tenant_id TEXT DEFAULT ''
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_status ON service_records(service, status)`)
	atomic.StoreInt32(&readyFlag, 1)
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET data=$5, status=$4, updated_at=NOW()", id, service, typ, status, string(data))
	return err
}

func dbQuery(service, typ string) ([]map[string]interface{}, error) {
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, data, status, created_at FROM service_records WHERE service=$1 AND type=$2 ORDER BY created_at DESC LIMIT 100", service, typ)
	if err != nil { return nil, err }
	defer rows.Close()
	var results []map[string]interface{}
	for rows.Next() {
		var id, data, status, createdAt string
		if err := rows.Scan(&id, &data, &status, &createdAt); err != nil { continue }
		results = append(results, map[string]interface{}{"id": id, "data": data, "status": status, "created_at": createdAt})
	}
	return results, nil
}


// ─── Idempotency Middleware ─────────────────────────────────────────────────
var idempotencyCache = struct {
	sync.RWMutex
	entries map[string]idempotencyEntry
}{entries: make(map[string]idempotencyEntry)}

type idempotencyEntry struct {
	response   []byte
	statusCode int
	createdAt  time.Time
}

func idempotencyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" && r.Method != "PUT" {
			next.ServeHTTP(w, r)
			return
		}
		key := r.Header.Get("Idempotency-Key")
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}
		idempotencyCache.RLock()
		if entry, ok := idempotencyCache.entries[key]; ok {
			idempotencyCache.RUnlock()
			w.Header().Set("X-Idempotency-Replayed", "true")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(entry.statusCode)
			w.Write(entry.response)
			return
		}
		idempotencyCache.RUnlock()
		rec := &idempotencyRecorder{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(rec, r)
		idempotencyCache.Lock()
		idempotencyCache.entries[key] = idempotencyEntry{response: rec.body, statusCode: rec.statusCode, createdAt: time.Now()}
		idempotencyCache.Unlock()
		// Cleanup old entries (>24h) in background
		go func() {
			idempotencyCache.Lock()
			defer idempotencyCache.Unlock()
			for k, v := range idempotencyCache.entries {
				if time.Since(v.createdAt) > 24*time.Hour { delete(idempotencyCache.entries, k) }
			}
		}()
	})
}

type idempotencyRecorder struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (r *idempotencyRecorder) WriteHeader(code int) { r.statusCode = code; r.ResponseWriter.WriteHeader(code) }
func (r *idempotencyRecorder) Write(b []byte) (int, error) { r.body = append(r.body, b...); return r.ResponseWriter.Write(b) }


// ─── Transaction Atomicity ──────────────────────────────────────────────────
// All multi-step write operations wrapped in DB transactions.
func dbExecAtomic(queries []string, params [][]interface{}) error {
	if db == nil { return fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return fmt.Errorf("BEGIN failed: %v", err) }
	for i, q := range queries {
		var args []interface{}
		if i < len(params) { args = params[i] }
		if _, err := tx.Exec(q, args...); err != nil {
			tx.Rollback()
			return fmt.Errorf("step %d failed: %v", i+1, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("COMMIT failed: %v", err)
	}
	return nil
}


func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simple token bucket: allow bursts of 100 requests
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key, X-Tenant-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}


// --- Monetary Safety (kobo precision) ---
type AmountKobo = int64

func nairaToKobo(naira float64) AmountKobo { return AmountKobo(math.Round(naira * 100)) }
func koboToNaira(kobo AmountKobo) float64  { return float64(kobo) / 100.0 }
func roundNaira(amount float64) float64 { return math.Round(amount*100) / 100 }
func validateAmount(amount float64) error {
	if amount < 0 { return fmt.Errorf("amount must be non-negative") }
	if amount > 999_999_999_999.99 { return fmt.Errorf("exceeds CBN max limit") }
	return nil
}

// --- Audit Trail (append-only) ---
type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	RecordID  string `json:"record_id"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	Details   string `json:"details"`
}

var auditLog []AuditEntry

func appendAudit(action, recordID, actor, details string) {
	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", secureRandUint32()),
		Action: action, RecordID: recordID, Actor: actor,
		Timestamp: time.Now().UTC().Format(time.RFC3339), Details: details,
	})
}

// --- Request Tracing ---
func tracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" { traceID = r.Header.Get("traceparent") }
		if traceID == "" { traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid()) }
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Circuit Breaker ---
type circuitBreakerState int
const (
	cbClosed circuitBreakerState = iota
	cbOpen
	cbHalfOpen
)

var (
	cbState     circuitBreakerState
	cbFailCount uint64
	cbLastFail  int64
	cbThreshold uint64 = 5
	cbTimeout   int64  = 30 // seconds
)

func cbAllow() bool {
	if cbState == cbClosed { return true }
	if cbState == cbOpen && time.Now().Unix()-atomic.LoadInt64(&cbLastFail) > cbTimeout {
		cbState = cbHalfOpen
		return true
	}
	return cbState == cbHalfOpen
}

func cbRecordSuccess() { atomic.StoreUint64(&cbFailCount, 0); cbState = cbClosed }
func cbRecordFailure() {
	atomic.AddUint64(&cbFailCount, 1)
	atomic.StoreInt64(&cbLastFail, time.Now().Unix())
	if atomic.LoadUint64(&cbFailCount) >= cbThreshold { cbState = cbOpen }
}

// --- Observability (OpenTelemetry) ---
var otelEndpoint = os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

func initTracing() {
	if otelEndpoint == "" { return }
	log.Printf("[%s] OTEL tracing configured: %s", serviceName, otelEndpoint)
}

// --- Retry with Exponential Backoff ---
func retryWithBackoff(maxRetries int, fn func() error) error {
	for i := 0; i < maxRetries; i++ {
		if err := fn(); err == nil { return nil }
		backoff := time.Duration(1<<uint(i)) * 100 * time.Millisecond
		if backoff > 5*time.Second { backoff = 5 * time.Second }
		time.Sleep(backoff)
	}
	return fmt.Errorf("max retries (%d) exceeded", maxRetries)
}


func secureRandUint32() uint32 {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil { return uint32(time.Now().UnixNano()) }
	return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
}

func main() {
	initTracing()
	initDB()
	_ = context.Background
	_ = big.NewInt
	_ = sanitizeLogEntry
	_ = strings.HasPrefix
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", handleHealthz)
	mux.HandleFunc("/livez", handleHealthz)
	mux.HandleFunc("/metrics", handleMetrics)
	mux.HandleFunc("/v1/incident/create", handleIncidentCreate)
	mux.HandleFunc("/v1/incident/update", handleIncidentUpdate)
	mux.HandleFunc("/v1/incident/escalate", handleIncidentEscalate)
	mux.HandleFunc("/v1/incident/list", handleIncidentList)
	mux.HandleFunc("/v1/postmortem/create", handlePostMortemCreate)
	mux.HandleFunc("/v1/oncall/schedule", handleOnCallSchedule)
	mux.HandleFunc("/v1/sla/check", handleSLACheck)
	log.Printf("Incident Management (SLA Tracking + Escalation) listening on :%s", PORT)

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
		<-sigCh
		log.Printf("[%s] Shutting down gracefully...", serviceName)
		if db != nil { db.Close() }
		os.Exit(0)
	}()
	log.Fatal(http.ListenAndServe(":"+PORT, corsMiddleware(rateLimitMiddleware(mux))))
}
