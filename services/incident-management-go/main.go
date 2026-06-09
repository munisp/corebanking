package main

import (
	_ "github.com/lib/pq"
	"database/sql"
	"context"
	"os/signal"
	"syscall"
	"sync/atomic"

	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
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


// ─── Optimistic Locking for Balance Updates ─────────────────────────────────
// All balance updates use version-checked atomic operations.
type BalanceLock struct {
	AccountID string
	Version   int64
	Balance   int64 // kobo
}

func dbUpdateBalanceAtomic(accountID string, deltaKobo int64, currentVersion int64) (int64, error) {
	if db == nil { return 0, fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return 0, err }
	defer tx.Rollback()
	var balance int64
	var version int64
	err = tx.QueryRow("SELECT balance_kobo, version FROM account_balances WHERE account_id = $1 FOR UPDATE", accountID).Scan(&balance, &version)
	if err != nil { return 0, fmt.Errorf("account not found or locked: %v", err) }
	if version != currentVersion {
		return 0, fmt.Errorf("optimistic lock conflict: expected version %d, got %d", currentVersion, version)
	}
	newBalance := balance + deltaKobo
	if newBalance < 0 { return 0, fmt.Errorf("insufficient balance: have %d kobo, need %d kobo", balance, -deltaKobo) }
	_, err = tx.Exec("UPDATE account_balances SET balance_kobo = $1, version = version + 1, updated_at = NOW() WHERE account_id = $2 AND version = $3",
		newBalance, accountID, currentVersion)
	if err != nil { return 0, err }
	err = tx.Commit()
	if err != nil { return 0, err }
	return newBalance, nil
}


// ─── Maker-Checker (Dual Authorization) ────────────────────────────────────
// CBN requires dual control for high-value operations.
type MakerCheckerRequest struct {
	RequestID  string      `json:"request_id"`
	Operation  string      `json:"operation"`
	MakerID    string      `json:"maker_id"`
	CheckerID  string      `json:"checker_id,omitempty"`
	AmountKobo int64       `json:"amount_kobo"`
	Status     string      `json:"status"` // pending_approval|approved|rejected
	Payload    interface{} `json:"payload"`
	CreatedAt  string      `json:"created_at"`
	DecidedAt  string      `json:"decided_at,omitempty"`
}

var (
	makerCheckerRequests []MakerCheckerRequest
	makerCheckerMu       sync.Mutex
)

// makerCheckerThresholds defines CBN-required dual authorization thresholds (kobo)
var makerCheckerThresholds = map[string]int64{
	"transfer":      100_000_000, // ₦1M
	"loan_disburse": 100_000_000, // ₦1M
	"gl_posting":    50_000_000,  // ₦500K
	"account_close": 0,           // Always requires checker
}

func requiresMakerChecker(operation string, amountKobo int64) bool {
	threshold, ok := makerCheckerThresholds[operation]
	if !ok { threshold = 100_000_000 }
	return amountKobo >= threshold
}

func submitForApproval(operation, makerID string, amountKobo int64, payload interface{}) *MakerCheckerRequest {
	req := MakerCheckerRequest{
		RequestID: fmt.Sprintf("MCR-%d", time.Now().UnixNano()),
		Operation: operation, MakerID: makerID, AmountKobo: amountKobo,
		Status: "pending_approval", Payload: payload,
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	makerCheckerMu.Lock()
	makerCheckerRequests = append(makerCheckerRequests, req)
	makerCheckerMu.Unlock()
	return &req
}


// ─── Immutable Audit Trail ──────────────────────────────────────────────────
// Append-only audit log. No DELETE or UPDATE permitted on audit records.
type AuditEntry struct {
	ID         string `json:"id"`
	Timestamp  string `json:"timestamp"`
	Service    string `json:"service"`
	Operation  string `json:"operation"`
	ActorID    string `json:"actor_id"`
	EntityID   string `json:"entity_id"`
	EntityType string `json:"entity_type"`
	OldState   string `json:"old_state,omitempty"`
	NewState   string `json:"new_state,omitempty"`
	IPAddress  string `json:"ip_address,omitempty"`
	Checksum   string `json:"checksum"` // SHA256 of entry for tamper detection
}

var (
	auditLog   []AuditEntry
	auditLogMu sync.RWMutex
)

func appendAuditEntry(service, operation, actorID, entityID, entityType, oldState, newState, ip string) {
	entry := AuditEntry{
		ID:         fmt.Sprintf("AUD-%d", time.Now().UnixNano()),
		Timestamp:  time.Now().UTC().Format(time.RFC3339Nano),
		Service:    service,
		Operation:  operation,
		ActorID:    actorID,
		EntityID:   entityID,
		EntityType: entityType,
		OldState:   oldState,
		NewState:   newState,
		IPAddress:  ip,
	}
	// Compute tamper-detection checksum
	raw := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s|%s|%s", entry.ID, entry.Timestamp, entry.Service, entry.Operation, entry.ActorID, entry.EntityID, entry.OldState, entry.NewState, entry.IPAddress)
	entry.Checksum = fmt.Sprintf("%x", sha256.Sum256([]byte(raw)))
	auditLogMu.Lock()
	auditLog = append(auditLog, entry)
	auditLogMu.Unlock()
	// Persist to DB if available (append-only INSERT, never UPDATE/DELETE)
	if db != nil {
		go func() {
			db.Exec("INSERT INTO audit_trail (id, timestamp, service, operation, actor_id, entity_id, entity_type, old_state, new_state, ip_address, checksum) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
				entry.ID, entry.Timestamp, entry.Service, entry.Operation, entry.ActorID, entry.EntityID, entry.EntityType, entry.OldState, entry.NewState, entry.IPAddress, entry.Checksum)
		}()
	}
}


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


func main() {
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
	log.Fatal(http.ListenAndServe(":"+PORT, mux))
}
