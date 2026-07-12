package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Prometheus metrics
var (
	transactionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "branch_transactions_total",
			Help: "Total number of branch transactions",
		},
		[]string{"branch_id", "type"},
	)

	approvalsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "branch_approvals_total",
			Help: "Total number of approvals",
		},
		[]string{"branch_id", "type", "status"},
	)

	staffCount = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "branch_staff_count",
			Help: "Number of staff at branch",
		},
		[]string{"branch_id", "status"},
	)

	cashPosition = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "branch_cash_position",
			Help: "Current cash position at branch",
		},
		[]string{"branch_id"},
	)

	incidentsGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "branch_incidents",
			Help: "Number of open incidents",
		},
		[]string{"branch_id", "severity"},
	)
)

// BranchServer holds all services
type BranchServer struct {
	branchService      *BranchService
	staffService       *StaffService
	scheduleService    *ScheduleService
	approvalService    *ApprovalService
	performanceService *PerformanceService
	cashService        *CashService
	incidentService    *IncidentService
	middleware         *MiddlewareIntegration
}

// NewBranchServer creates a new server instance
func NewBranchServer() *BranchServer {
	tenantID := os.Getenv("DEFAULT_TENANT_ID")
	if tenantID == "" {
		tenantID = "default"
	}

	return &BranchServer{
		branchService:      NewBranchService(tenantID),
		staffService:       NewStaffService(tenantID),
		scheduleService:    NewScheduleService(tenantID),
		approvalService:    NewApprovalService(tenantID),
		performanceService: NewPerformanceService(tenantID),
		cashService:        NewCashService(tenantID),
		incidentService:    NewIncidentService(tenantID),
		middleware:         NewMiddlewareIntegration(tenantID),
	}
}

func main() {
	server := NewBranchServer()
	router := mux.NewRouter()

	// Middleware
	router.Use(corsMiddleware)
	router.Use(tenantMiddleware)
	router.Use(loggingMiddleware)
	router.Use(auditMiddleware)

	// Health and metrics
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.Handle("/metrics", promhttp.Handler()).Methods("GET")

	// API routes
	api := router.PathPrefix("/api/v1").Subrouter()

	// Branch Management
	api.HandleFunc("/branches", server.listBranchesHandler).Methods("GET")
	api.HandleFunc("/branches", server.createBranchHandler).Methods("POST")
	api.HandleFunc("/branches/{branch_id}", server.getBranchHandler).Methods("GET")
	api.HandleFunc("/branches/{branch_id}", server.updateBranchHandler).Methods("PUT")
	api.HandleFunc("/branches/{branch_id}/status", server.updateBranchStatusHandler).Methods("PATCH")

	// Staff Management
	api.HandleFunc("/staff", server.listStaffHandler).Methods("GET")
	api.HandleFunc("/staff", server.createStaffHandler).Methods("POST")
	api.HandleFunc("/staff/{staff_id}", server.getStaffHandler).Methods("GET")
	api.HandleFunc("/staff/{staff_id}", server.updateStaffHandler).Methods("PUT")
	api.HandleFunc("/staff/{staff_id}/status", server.updateStaffStatusHandler).Methods("PATCH")
	api.HandleFunc("/staff/{staff_id}/transfer", server.transferStaffHandler).Methods("POST")

	// Schedule Management
	api.HandleFunc("/schedules", server.listSchedulesHandler).Methods("GET")
	api.HandleFunc("/schedules", server.createScheduleHandler).Methods("POST")
	api.HandleFunc("/schedules/{schedule_id}", server.getScheduleHandler).Methods("GET")
	api.HandleFunc("/schedules/{schedule_id}", server.updateScheduleHandler).Methods("PUT")
	api.HandleFunc("/schedules/{schedule_id}/status", server.updateScheduleStatusHandler).Methods("PATCH")
	api.HandleFunc("/schedules/weekly", server.getWeeklyScheduleHandler).Methods("GET")
	api.HandleFunc("/schedules/generate", server.generateScheduleHandler).Methods("POST")

	// Leave Management
	api.HandleFunc("/leave-requests", server.listLeaveRequestsHandler).Methods("GET")
	api.HandleFunc("/leave-requests", server.createLeaveRequestHandler).Methods("POST")
	api.HandleFunc("/leave-requests/{request_id}", server.getLeaveRequestHandler).Methods("GET")
	api.HandleFunc("/leave-requests/{request_id}/approve", server.approveLeaveRequestHandler).Methods("POST")
	api.HandleFunc("/leave-requests/{request_id}/reject", server.rejectLeaveRequestHandler).Methods("POST")
	api.HandleFunc("/leave-requests/{request_id}/cancel", server.cancelLeaveRequestHandler).Methods("POST")

	// Approval Management
	api.HandleFunc("/approvals", server.listApprovalsHandler).Methods("GET")
	api.HandleFunc("/approvals", server.createApprovalHandler).Methods("POST")
	api.HandleFunc("/approvals/{request_id}", server.getApprovalHandler).Methods("GET")
	api.HandleFunc("/approvals/{request_id}/approve", server.approveRequestHandler).Methods("POST")
	api.HandleFunc("/approvals/{request_id}/reject", server.rejectRequestHandler).Methods("POST")
	api.HandleFunc("/approvals/{request_id}/escalate", server.escalateRequestHandler).Methods("POST")
	api.HandleFunc("/approvals/pending", server.listPendingApprovalsHandler).Methods("GET")
	api.HandleFunc("/approvals/urgent", server.listUrgentApprovalsHandler).Methods("GET")

	// Performance & Targets
	api.HandleFunc("/targets", server.listTargetsHandler).Methods("GET")
	api.HandleFunc("/targets", server.createTargetHandler).Methods("POST")
	api.HandleFunc("/targets/{target_id}", server.getTargetHandler).Methods("GET")
	api.HandleFunc("/targets/{target_id}", server.updateTargetHandler).Methods("PUT")
	api.HandleFunc("/performance", server.getPerformanceHandler).Methods("GET")
	api.HandleFunc("/performance/daily", server.getDailyPerformanceHandler).Methods("GET")
	api.HandleFunc("/performance/monthly", server.getMonthlyPerformanceHandler).Methods("GET")
	api.HandleFunc("/performance/compare", server.comparePerformanceHandler).Methods("GET")

	// Cash Management
	api.HandleFunc("/cash", server.getCashPositionHandler).Methods("GET")
	api.HandleFunc("/cash/daily", server.getDailyCashHandler).Methods("GET")
	api.HandleFunc("/cash/reconcile", server.reconcileCashHandler).Methods("POST")
	api.HandleFunc("/cash/requests", server.listCashRequestsHandler).Methods("GET")
	api.HandleFunc("/cash/requests", server.createCashRequestHandler).Methods("POST")
	api.HandleFunc("/cash/requests/{request_id}", server.getCashRequestHandler).Methods("GET")
	api.HandleFunc("/cash/requests/{request_id}/approve", server.approveCashRequestHandler).Methods("POST")
	api.HandleFunc("/cash/requests/{request_id}/complete", server.completeCashRequestHandler).Methods("POST")

	// Incident Management
	api.HandleFunc("/incidents", server.listIncidentsHandler).Methods("GET")
	api.HandleFunc("/incidents", server.createIncidentHandler).Methods("POST")
	api.HandleFunc("/incidents/{incident_id}", server.getIncidentHandler).Methods("GET")
	api.HandleFunc("/incidents/{incident_id}", server.updateIncidentHandler).Methods("PUT")
	api.HandleFunc("/incidents/{incident_id}/assign", server.assignIncidentHandler).Methods("POST")
	api.HandleFunc("/incidents/{incident_id}/resolve", server.resolveIncidentHandler).Methods("POST")
	api.HandleFunc("/incidents/{incident_id}/close", server.closeIncidentHandler).Methods("POST")

	// Dashboard
	api.HandleFunc("/dashboard", server.getDashboardHandler).Methods("GET")
	api.HandleFunc("/dashboard/summary", server.getDashboardSummaryHandler).Methods("GET")
	api.HandleFunc("/dashboard/queue", server.getQueueStatusHandler).Methods("GET")

	// Reports
	api.HandleFunc("/reports/daily", server.getDailyReportHandler).Methods("GET")
	api.HandleFunc("/reports/weekly", server.getWeeklyReportHandler).Methods("GET")
	api.HandleFunc("/reports/monthly", server.getMonthlyReportHandler).Methods("GET")
	api.HandleFunc("/reports/staff-performance", server.getStaffPerformanceReportHandler).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8125"
	}

	log.Printf("Branch Manager Service starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
}

// Middleware functions
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-Branch-ID, x-keycloak-id")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func tenantMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}
		r.Header.Set("X-Tenant-ID", tenantID)
		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s %v", r.Method, r.RequestURI, r.Header.Get("X-Tenant-ID"), time.Since(start))
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "branch-manager-service"})
}

// Helper functions
func getTenantID(r *http.Request) string {
	return r.Header.Get("X-Tenant-ID")
}

func getBranchID(r *http.Request) string {
	branchID := r.Header.Get("X-Branch-ID")
	if branchID == "" {
		branchID = mux.Vars(r)["branch_id"]
	}
	return branchID
}

func getUserID(r *http.Request) string {
	userID := r.Header.Get("x-keycloak-id")
	if userID == "" {
		userID = "system"
	}
	return userID
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// Branch handlers
func (s *BranchServer) listBranchesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	region := r.URL.Query().Get("region")
	status := r.URL.Query().Get("status")

	branches := s.branchService.ListBranches(tenantID, region, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"branches": branches})
}

func (s *BranchServer) createBranchHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)

	var req CreateBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	branch, err := s.branchService.CreateBranch(tenantID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, branch)
}

func (s *BranchServer) getBranchHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	branchID := vars["branch_id"]
	tenantID := getTenantID(r)

	branch, err := s.branchService.GetBranch(tenantID, branchID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Branch not found")
		return
	}

	respondJSON(w, http.StatusOK, branch)
}

func (s *BranchServer) updateBranchHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	branchID := vars["branch_id"]
	tenantID := getTenantID(r)

	var branch Branch
	if err := json.NewDecoder(r.Body).Decode(&branch); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	branch.BranchID = branchID
	branch.TenantID = tenantID

	if err := s.branchService.UpdateBranch(&branch); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, branch)
}

func (s *BranchServer) updateBranchStatusHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	branchID := vars["branch_id"]
	tenantID := getTenantID(r)

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.branchService.UpdateBranchStatus(tenantID, branchID, req.Status); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// Staff handlers
func (s *BranchServer) listStaffHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	role := r.URL.Query().Get("role")
	status := r.URL.Query().Get("status")

	staff := s.staffService.ListStaff(tenantID, branchID, role, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"staff": staff})
}

func (s *BranchServer) createStaffHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)

	var req CreateStaffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	staff, err := s.staffService.CreateStaff(tenantID, branchID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	staffCount.WithLabelValues(branchID, "active").Inc()
	respondJSON(w, http.StatusCreated, staff)
}

func (s *BranchServer) getStaffHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	staffID := vars["staff_id"]
	tenantID := getTenantID(r)

	staff, err := s.staffService.GetStaff(tenantID, staffID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Staff not found")
		return
	}

	respondJSON(w, http.StatusOK, staff)
}

func (s *BranchServer) updateStaffHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	staffID := vars["staff_id"]
	tenantID := getTenantID(r)

	var staff BranchStaff
	if err := json.NewDecoder(r.Body).Decode(&staff); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	staff.StaffID = staffID
	staff.TenantID = tenantID

	if err := s.staffService.UpdateStaff(&staff); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, staff)
}

func (s *BranchServer) updateStaffStatusHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	staffID := vars["staff_id"]
	tenantID := getTenantID(r)

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.staffService.UpdateStaffStatus(tenantID, staffID, req.Status); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (s *BranchServer) transferStaffHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	staffID := vars["staff_id"]
	tenantID := getTenantID(r)

	var req struct {
		ToBranchID string `json:"toBranchID"`
		Reason     string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.staffService.TransferStaff(tenantID, staffID, req.ToBranchID, req.Reason); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "transferred"})
}

// Schedule handlers
func (s *BranchServer) listSchedulesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	date := r.URL.Query().Get("date")

	schedules := s.scheduleService.ListSchedules(tenantID, branchID, date)
	respondJSON(w, http.StatusOK, map[string]interface{}{"schedules": schedules})
}

func (s *BranchServer) createScheduleHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	userID := getUserID(r)

	var req CreateScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	schedule, err := s.scheduleService.CreateSchedule(tenantID, branchID, userID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, schedule)
}

func (s *BranchServer) getScheduleHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	scheduleID := vars["schedule_id"]
	tenantID := getTenantID(r)

	schedule, err := s.scheduleService.GetSchedule(tenantID, scheduleID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Schedule not found")
		return
	}

	respondJSON(w, http.StatusOK, schedule)
}

func (s *BranchServer) updateScheduleHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	scheduleID := vars["schedule_id"]
	tenantID := getTenantID(r)

	var schedule StaffSchedule
	if err := json.NewDecoder(r.Body).Decode(&schedule); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	schedule.ScheduleID = scheduleID
	schedule.TenantID = tenantID

	if err := s.scheduleService.UpdateSchedule(&schedule); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, schedule)
}

func (s *BranchServer) updateScheduleStatusHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	scheduleID := vars["schedule_id"]
	tenantID := getTenantID(r)

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.scheduleService.UpdateScheduleStatus(tenantID, scheduleID, req.Status); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (s *BranchServer) getWeeklyScheduleHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	startDate := r.URL.Query().Get("start_date")

	schedule := s.scheduleService.GetWeeklySchedule(tenantID, branchID, startDate)
	respondJSON(w, http.StatusOK, schedule)
}

func (s *BranchServer) generateScheduleHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	userID := getUserID(r)

	var req struct {
		StartDate string `json:"startDate"`
		EndDate   string `json:"endDate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	schedules, err := s.scheduleService.GenerateSchedule(tenantID, branchID, userID, req.StartDate, req.EndDate, s.staffService)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{"schedules": schedules})
}

// Leave request handlers
func (s *BranchServer) listLeaveRequestsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	status := r.URL.Query().Get("status")

	requests := s.scheduleService.ListLeaveRequests(tenantID, branchID, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"leaveRequests": requests})
}

func (s *BranchServer) createLeaveRequestHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)

	var req CreateLeaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	leaveReq, err := s.scheduleService.CreateLeaveRequest(tenantID, branchID, &req, s.staffService)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, leaveReq)
}

func (s *BranchServer) getLeaveRequestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["request_id"]
	tenantID := getTenantID(r)

	leaveReq, err := s.scheduleService.GetLeaveRequest(tenantID, requestID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Leave request not found")
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}

func (s *BranchServer) approveLeaveRequestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["request_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	leaveReq, err := s.scheduleService.ApproveLeaveRequest(tenantID, requestID, userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}

func (s *BranchServer) rejectLeaveRequestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["request_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	leaveReq, err := s.scheduleService.RejectLeaveRequest(tenantID, requestID, userID, req.Reason)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}

func (s *BranchServer) cancelLeaveRequestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["request_id"]
	tenantID := getTenantID(r)

	leaveReq, err := s.scheduleService.CancelLeaveRequest(tenantID, requestID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}

// Approval handlers
func (s *BranchServer) listApprovalsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	status := r.URL.Query().Get("status")
	requestType := r.URL.Query().Get("type")

	approvals := s.approvalService.ListApprovals(tenantID, branchID, status, requestType)
	respondJSON(w, http.StatusOK, map[string]interface{}{"approvals": approvals})
}

func (s *BranchServer) createApprovalHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	userID := getUserID(r)

	var req CreateApprovalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	approval, err := s.approvalService.CreateApproval(tenantID, branchID, userID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	approvalsTotal.WithLabelValues(branchID, req.RequestType, "pending").Inc()
	respondJSON(w, http.StatusCreated, approval)
}

func (s *BranchServer) getApprovalHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["request_id"]
	tenantID := getTenantID(r)

	approval, err := s.approvalService.GetApproval(tenantID, requestID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Approval request not found")
		return
	}

	respondJSON(w, http.StatusOK, approval)
}

func (s *BranchServer) approveRequestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["request_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req ApproveRequestPayload
	json.NewDecoder(r.Body).Decode(&req)
	req.RequestID = requestID

	approval, err := s.approvalService.ApproveRequest(tenantID, userID, &req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	approvalsTotal.WithLabelValues(approval.BranchID, approval.RequestType, "approved").Inc()
	respondJSON(w, http.StatusOK, approval)
}

func (s *BranchServer) rejectRequestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["request_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req RejectRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.RequestID = requestID

	approval, err := s.approvalService.RejectRequest(tenantID, userID, &req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	approvalsTotal.WithLabelValues(approval.BranchID, approval.RequestType, "rejected").Inc()
	respondJSON(w, http.StatusOK, approval)
}

func (s *BranchServer) escalateRequestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["request_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req struct {
		EscalateTo string `json:"escalateTo"`
		Reason     string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	approval, err := s.approvalService.EscalateRequest(tenantID, requestID, userID, req.EscalateTo, req.Reason)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, approval)
}

func (s *BranchServer) listPendingApprovalsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)

	approvals := s.approvalService.ListApprovals(tenantID, branchID, "pending", "")
	respondJSON(w, http.StatusOK, map[string]interface{}{"approvals": approvals})
}

func (s *BranchServer) listUrgentApprovalsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)

	approvals := s.approvalService.ListUrgentApprovals(tenantID, branchID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"approvals": approvals})
}

// Performance handlers
func (s *BranchServer) listTargetsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	period := r.URL.Query().Get("period")

	targets := s.performanceService.ListTargets(tenantID, branchID, period)
	respondJSON(w, http.StatusOK, map[string]interface{}{"targets": targets})
}

func (s *BranchServer) createTargetHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)

	var req CreateTargetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	target, err := s.performanceService.CreateTarget(tenantID, branchID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, target)
}

func (s *BranchServer) getTargetHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	targetID := vars["target_id"]
	tenantID := getTenantID(r)

	target, err := s.performanceService.GetTarget(tenantID, targetID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Target not found")
		return
	}

	respondJSON(w, http.StatusOK, target)
}

func (s *BranchServer) updateTargetHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	targetID := vars["target_id"]
	tenantID := getTenantID(r)

	var target BranchTarget
	if err := json.NewDecoder(r.Body).Decode(&target); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	target.TargetID = targetID
	target.TenantID = tenantID

	if err := s.performanceService.UpdateTarget(&target); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, target)
}

func (s *BranchServer) getPerformanceHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	period := r.URL.Query().Get("period")

	performance := s.performanceService.GetPerformance(tenantID, branchID, period)
	respondJSON(w, http.StatusOK, performance)
}

func (s *BranchServer) getDailyPerformanceHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	date := r.URL.Query().Get("date")

	performance := s.performanceService.GetDailyPerformance(tenantID, branchID, date)
	respondJSON(w, http.StatusOK, performance)
}

func (s *BranchServer) getMonthlyPerformanceHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	month := r.URL.Query().Get("month")
	year := r.URL.Query().Get("year")

	performance := s.performanceService.GetMonthlyPerformance(tenantID, branchID, month, year)
	respondJSON(w, http.StatusOK, performance)
}

func (s *BranchServer) comparePerformanceHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	compareTo := r.URL.Query().Get("compare_to")
	period := r.URL.Query().Get("period")

	comparison := s.performanceService.ComparePerformance(tenantID, branchID, compareTo, period)
	respondJSON(w, http.StatusOK, comparison)
}

// Cash management handlers
func (s *BranchServer) getCashPositionHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)

	position := s.cashService.GetCashPosition(tenantID, branchID)
	cashPosition.WithLabelValues(branchID).Set(float64(position.ClosingBalance))
	respondJSON(w, http.StatusOK, position)
}

func (s *BranchServer) getDailyCashHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	date := r.URL.Query().Get("date")

	cash := s.cashService.GetDailyCash(tenantID, branchID, date)
	respondJSON(w, http.StatusOK, cash)
}

func (s *BranchServer) reconcileCashHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	userID := getUserID(r)

	var req struct {
		Date  string `json:"date"`
		Notes string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	cash, err := s.cashService.ReconcileCash(tenantID, branchID, userID, req.Date, req.Notes)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, cash)
}

func (s *BranchServer) listCashRequestsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	status := r.URL.Query().Get("status")

	requests := s.cashService.ListCashRequests(tenantID, branchID, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"cashRequests": requests})
}

func (s *BranchServer) createCashRequestHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	userID := getUserID(r)

	var req CreateCashRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	cashReq, err := s.cashService.CreateCashRequest(tenantID, branchID, userID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, cashReq)
}

func (s *BranchServer) getCashRequestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["request_id"]
	tenantID := getTenantID(r)

	cashReq, err := s.cashService.GetCashRequest(tenantID, requestID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Cash request not found")
		return
	}

	respondJSON(w, http.StatusOK, cashReq)
}

func (s *BranchServer) approveCashRequestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["request_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	cashReq, err := s.cashService.ApproveCashRequest(tenantID, requestID, userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, cashReq)
}

func (s *BranchServer) completeCashRequestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["request_id"]
	tenantID := getTenantID(r)

	var req struct {
		Notes string `json:"notes"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	cashReq, err := s.cashService.CompleteCashRequest(tenantID, requestID, req.Notes)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, cashReq)
}

// Incident handlers
func (s *BranchServer) listIncidentsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	status := r.URL.Query().Get("status")
	severity := r.URL.Query().Get("severity")

	incidents := s.incidentService.ListIncidents(tenantID, branchID, status, severity)
	respondJSON(w, http.StatusOK, map[string]interface{}{"incidents": incidents})
}

func (s *BranchServer) createIncidentHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	userID := getUserID(r)

	var req CreateIncidentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	incident, err := s.incidentService.CreateIncident(tenantID, branchID, userID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	incidentsGauge.WithLabelValues(branchID, req.Severity).Inc()
	respondJSON(w, http.StatusCreated, incident)
}

func (s *BranchServer) getIncidentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["incident_id"]
	tenantID := getTenantID(r)

	incident, err := s.incidentService.GetIncident(tenantID, incidentID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Incident not found")
		return
	}

	respondJSON(w, http.StatusOK, incident)
}

func (s *BranchServer) updateIncidentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["incident_id"]
	tenantID := getTenantID(r)

	var incident BranchIncident
	if err := json.NewDecoder(r.Body).Decode(&incident); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	incident.IncidentID = incidentID
	incident.TenantID = tenantID

	if err := s.incidentService.UpdateIncident(&incident); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, incident)
}

func (s *BranchServer) assignIncidentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["incident_id"]
	tenantID := getTenantID(r)

	var req struct {
		AssignTo string `json:"assignTo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	incident, err := s.incidentService.AssignIncident(tenantID, incidentID, req.AssignTo)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, incident)
}

func (s *BranchServer) resolveIncidentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["incident_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req struct {
		Resolution string `json:"resolution"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	incident, err := s.incidentService.ResolveIncident(tenantID, incidentID, userID, req.Resolution)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	incidentsGauge.WithLabelValues(incident.BranchID, incident.Severity).Dec()
	respondJSON(w, http.StatusOK, incident)
}

func (s *BranchServer) closeIncidentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["incident_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	incident, err := s.incidentService.CloseIncident(tenantID, incidentID, userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, incident)
}

// Dashboard handlers
func (s *BranchServer) getDashboardHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)

	dashboard := s.getDashboard(tenantID, branchID)
	respondJSON(w, http.StatusOK, dashboard)
}

func (s *BranchServer) getDashboardSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)

	summary := s.getDashboardSummary(tenantID, branchID)
	respondJSON(w, http.StatusOK, summary)
}

func (s *BranchServer) getQueueStatusHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)

	queue := s.performanceService.GetQueueStatus(tenantID, branchID)
	respondJSON(w, http.StatusOK, queue)
}

func (s *BranchServer) getDashboard(tenantID, branchID string) *BranchDashboard {
	branch, _ := s.branchService.GetBranch(tenantID, branchID)

	dashboard := &BranchDashboard{
		BranchID: branchID,
	}

	if branch != nil {
		dashboard.BranchName = branch.BranchName
	}

	// Staff summary
	staff := s.staffService.ListStaff(tenantID, branchID, "", "")
	dashboard.TotalStaff = len(staff)
	for _, st := range staff {
		if st.Status == "active" {
			dashboard.PresentToday++
		} else if st.Status == "on_leave" {
			dashboard.OnLeave++
		}
	}

	// Pending approvals
	approvals := s.approvalService.ListApprovals(tenantID, branchID, "pending", "")
	dashboard.PendingApprovals = len(approvals)
	for _, a := range approvals {
		if a.Priority == "urgent" {
			dashboard.UrgentApprovals++
		}
	}

	// Leave requests
	leaveRequests := s.scheduleService.ListLeaveRequests(tenantID, branchID, "pending")
	dashboard.PendingLeaveRequests = len(leaveRequests)

	// Cash position
	cashPos := s.cashService.GetCashPosition(tenantID, branchID)
	if cashPos != nil {
		dashboard.CurrentCashPosition = cashPos.ClosingBalance
		dashboard.CashLimit = cashPos.CashLimit
		if cashPos.CashLimit > 0 {
			dashboard.CashUtilization = float64(cashPos.ClosingBalance) / float64(cashPos.CashLimit) * 100
		}
	}

	// Incidents
	incidents := s.incidentService.ListIncidents(tenantID, branchID, "open", "")
	dashboard.OpenIncidents = len(incidents)
	for _, inc := range incidents {
		if inc.Severity == "critical" {
			dashboard.CriticalIncidents++
		}
	}

	// Performance
	performance := s.performanceService.GetDailyPerformance(tenantID, branchID, "")
	if performance != nil {
		dashboard.TodayTransactions = performance.TotalTransactions
		dashboard.TodayDeposits = performance.TotalDepositAmount
		dashboard.TodayWithdrawals = performance.TotalWithdrawalAmount
		dashboard.TodayNewAccounts = performance.NewAccountsOpened
		dashboard.TodayCustomersServed = performance.CustomersServed
		dashboard.CustomerSatisfaction = performance.CustomerSatisfaction
	}

	// Queue status
	queue := s.performanceService.GetQueueStatus(tenantID, branchID)
	if queueLen, ok := queue["currentQueueLength"].(int); ok {
		dashboard.CurrentQueueLength = queueLen
	}
	if avgWait, ok := queue["avgWaitTime"].(float64); ok {
		dashboard.AvgWaitTime = avgWait
	}

	return dashboard
}

func (s *BranchServer) getDashboardSummary(tenantID, branchID string) map[string]interface{} {
	dashboard := s.getDashboard(tenantID, branchID)
	return map[string]interface{}{
		"branchID":          dashboard.BranchID,
		"branchName":        dashboard.BranchName,
		"todayTransactions": dashboard.TodayTransactions,
		"pendingApprovals":  dashboard.PendingApprovals,
		"openIncidents":     dashboard.OpenIncidents,
		"staffPresent":      dashboard.PresentToday,
	}
}

// Report handlers
func (s *BranchServer) getDailyReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	date := r.URL.Query().Get("date")

	report := s.performanceService.GetDailyReport(tenantID, branchID, date)
	respondJSON(w, http.StatusOK, report)
}

func (s *BranchServer) getWeeklyReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	startDate := r.URL.Query().Get("start_date")

	report := s.performanceService.GetWeeklyReport(tenantID, branchID, startDate)
	respondJSON(w, http.StatusOK, report)
}

func (s *BranchServer) getMonthlyReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	month := r.URL.Query().Get("month")
	year := r.URL.Query().Get("year")

	report := s.performanceService.GetMonthlyReport(tenantID, branchID, month, year)
	respondJSON(w, http.StatusOK, report)
}

func (s *BranchServer) getStaffPerformanceReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	branchID := getBranchID(r)
	period := r.URL.Query().Get("period")

	report := s.performanceService.GetStaffPerformanceReport(tenantID, branchID, period, s.staffService)
	respondJSON(w, http.StatusOK, report)
}
