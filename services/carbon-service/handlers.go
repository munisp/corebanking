package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// Kafka client instance
var carbonKafkaClient = NewCarbonKafkaClient()

func registerRoutes(router *gin.Engine) {
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy", "service": "carbon-service"})
	})

	api := router.Group("/api/v1/carbon")
	{
		// Project endpoints
		api.POST("/projects", createProject)
		api.GET("/projects", listProjects)
		api.GET("/projects/:id", getProject)
		api.PUT("/projects/:id", updateProject)

		// Credit endpoints
		api.POST("/credits/issue", issueCredits)
		api.GET("/credits", listCredits)
		api.GET("/credits/:id", getCredit)
		api.POST("/credits/:id/retire", retireCredit)

		// Trading endpoints
		api.POST("/trades", createTrade)
		api.GET("/trades", listTrades)
		api.GET("/trades/:id", getTrade)
		api.POST("/trades/:id/settle", settleTrade)

		// Footprint endpoints
		api.POST("/footprints", calculateFootprint)
		api.GET("/footprints", listFootprints)
		api.GET("/footprints/:id", getFootprint)
	}
}

func createProject(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	if tenantID == "" {
		c.JSON(400, gin.H{"error": "X-Tenant-ID header is required"})
		return
	}

	var req struct {
		ProjectName          string  `json:"project_name" binding:"required"`
		ProjectType          string  `json:"project_type" binding:"required"`
		Location             string  `json:"location"`
		Registry             string  `json:"registry"`
		RegistryID           string  `json:"registry_id"`
		TotalCredits         float64 `json:"total_credits" binding:"required"`
		VerificationStandard string  `json:"verification_standard"`
		VintageYear          int     `json:"vintage_year"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	projectID := generateID("PRJ")

	query := `
		INSERT INTO carbon_projects (
			project_id, tenant_id, project_name, project_type, location,
			registry, registry_id, total_credits, verification_standard, vintage_year
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at
	`

	var id int
	var createdAt time.Time
	err := db.QueryRow(query, projectID, tenantID, req.ProjectName, req.ProjectType,
		req.Location, req.Registry, req.RegistryID, req.TotalCredits,
		req.VerificationStandard, req.VintageYear).Scan(&id, &createdAt)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to create project", "details": err.Error()})
		return
	}

	// Publish Kafka event for project creation
	event := CarbonEvent{
		Type:      "project.created",
		EntityID:  projectID,
		TenantID:  tenantID,
		Timestamp: time.Now(),
		Metadata: map[string]interface{}{
			"project_name":  req.ProjectName,
			"project_type":  req.ProjectType,
			"location":      req.Location,
			"registry":      req.Registry,
			"registry_id":   req.RegistryID,
			"total_credits": req.TotalCredits,
		},
	}
	carbonKafkaClient.PublishEvent("carbon.project", event)

	c.JSON(201, gin.H{
		"project_id":            projectID,
		"project_name":          req.ProjectName,
		"project_type":          req.ProjectType,
		"total_credits":         req.TotalCredits,
		"status":                "active",
		"verification_standard": req.VerificationStandard,
		"created_at":            createdAt,
	})
}

func listProjects(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	status := c.Query("status")

	query := `
		SELECT project_id, project_name, project_type, location, registry,
			total_credits, issued_credits, retired_credits, status, vintage_year, created_at
		FROM carbon_projects
		WHERE tenant_id = $1
	`
	args := []interface{}{tenantID}

	if status != "" {
		query += " AND status = $2"
		args = append(args, status)
	}

	query += " ORDER BY created_at DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch projects", "details": err.Error()})
		return
	}
	defer rows.Close()

	projects := []map[string]interface{}{}
	for rows.Next() {
		var projID, projName, projType, location, registry, status string
		var totalCredits, issuedCredits, retiredCredits float64
		var vintageYear int
		var createdAt time.Time

		err := rows.Scan(&projID, &projName, &projType, &location, &registry,
			&totalCredits, &issuedCredits, &retiredCredits, &status, &vintageYear, &createdAt)
		if err != nil {
			continue
		}

		projects = append(projects, map[string]interface{}{
			"project_id":      projID,
			"project_name":    projName,
			"project_type":    projType,
			"location":        location,
			"registry":        registry,
			"total_credits":   totalCredits,
			"issued_credits":  issuedCredits,
			"retired_credits": retiredCredits,
			"status":          status,
			"vintage_year":    vintageYear,
			"created_at":      createdAt,
		})
	}

	c.JSON(200, gin.H{
		"projects": projects,
		"total":    len(projects),
	})
}

func getProject(c *gin.Context) {
	projectID := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	query := `
		SELECT project_id, project_name, project_type, location, registry, registry_id,
			total_credits, issued_credits, retired_credits, status,
			verification_standard, vintage_year, created_at, updated_at
		FROM carbon_projects
		WHERE project_id = $1 AND tenant_id = $2
	`

	var projID, projName, projType, location, registry, registryID, status, verStandard string
	var totalCredits, issuedCredits, retiredCredits float64
	var vintageYear int
	var createdAt, updatedAt time.Time

	err := db.QueryRow(query, projectID, tenantID).Scan(
		&projID, &projName, &projType, &location, &registry, &registryID,
		&totalCredits, &issuedCredits, &retiredCredits, &status,
		&verStandard, &vintageYear, &createdAt, &updatedAt)

	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "Project not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch project", "details": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"project_id":            projID,
		"project_name":          projName,
		"project_type":          projType,
		"location":              location,
		"registry":              registry,
		"registry_id":           registryID,
		"total_credits":         totalCredits,
		"issued_credits":        issuedCredits,
		"retired_credits":       retiredCredits,
		"available_credits":     totalCredits - issuedCredits,
		"status":                status,
		"verification_standard": verStandard,
		"vintage_year":          vintageYear,
		"created_at":            createdAt,
		"updated_at":            updatedAt,
	})
}

func updateProject(c *gin.Context) {
	projectID := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	query := `
		UPDATE carbon_projects
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE project_id = $2 AND tenant_id = $3
	`

	_, err := db.Exec(query, req.Status, projectID, tenantID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to update project", "details": err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "updated", "project_id": projectID})
}

func issueCredits(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	var req struct {
		ProjectID    string  `json:"project_id" binding:"required"`
		Quantity     float64 `json:"quantity" binding:"required"`
		OwnerID      string  `json:"owner_id" binding:"required"`
		PricePerUnit float64 `json:"price_per_unit"`
		Currency     string  `json:"currency"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var totalCredits, issuedCredits float64
	err := db.QueryRow("SELECT total_credits, issued_credits FROM carbon_projects WHERE project_id = $1 AND tenant_id = $2",
		req.ProjectID, tenantID).Scan(&totalCredits, &issuedCredits)

	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "Project not found"})
		return
	}

	if issuedCredits+req.Quantity > totalCredits {
		c.JSON(400, gin.H{"error": "Insufficient credits available in project"})
		return
	}

	creditID := generateID("CRD")
	serialNumber := fmt.Sprintf("%s-%s-%d", req.ProjectID, creditID, time.Now().Unix())

	if req.Currency == "" {
		req.Currency = "USD"
	}

	query := `
		INSERT INTO carbon_credits (
			credit_id, tenant_id, project_id, serial_number, quantity,
			owner_id, price_per_unit, currency
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING issued_at
	`

	var issuedAt time.Time
	err = db.QueryRow(query, creditID, tenantID, req.ProjectID, serialNumber,
		req.Quantity, req.OwnerID, req.PricePerUnit, req.Currency).Scan(&issuedAt)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to issue credits", "details": err.Error()})
		return
	}

	db.Exec("UPDATE carbon_projects SET issued_credits = issued_credits + $1 WHERE project_id = $2",
		req.Quantity, req.ProjectID)

	c.JSON(201, gin.H{
		"credit_id":      creditID,
		"serial_number":  serialNumber,
		"project_id":     req.ProjectID,
		"quantity":       req.Quantity,
		"owner_id":       req.OwnerID,
		"price_per_unit": req.PricePerUnit,
		"currency":       req.Currency,
		"status":         "issued",
		"issued_at":      issuedAt,
	})
}

func listCredits(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	status := c.Query("status")
	ownerID := c.Query("owner_id")
	projectID := c.Query("project_id")

	query := `
		SELECT credit_id, project_id, serial_number, quantity, unit, status,
			owner_id, price_per_unit, currency, issued_at
		FROM carbon_credits
		WHERE tenant_id = $1
	`
	args := []interface{}{tenantID}
	argCount := 2

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argCount)
		args = append(args, status)
		argCount++
	}
	if ownerID != "" {
		query += fmt.Sprintf(" AND owner_id = $%d", argCount)
		args = append(args, ownerID)
		argCount++
	}
	if projectID != "" {
		query += fmt.Sprintf(" AND project_id = $%d", argCount)
		args = append(args, projectID)
	}

	query += " ORDER BY issued_at DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch credits", "details": err.Error()})
		return
	}
	defer rows.Close()

	credits := []map[string]interface{}{}
	for rows.Next() {
		var creditID, projectID, serialNum, unit, status, ownerID, currency string
		var quantity, pricePerUnit float64
		var issuedAt time.Time

		err := rows.Scan(&creditID, &projectID, &serialNum, &quantity, &unit, &status,
			&ownerID, &pricePerUnit, &currency, &issuedAt)
		if err != nil {
			continue
		}

		credits = append(credits, map[string]interface{}{
			"credit_id":      creditID,
			"project_id":     projectID,
			"serial_number":  serialNum,
			"quantity":       quantity,
			"unit":           unit,
			"status":         status,
			"owner_id":       ownerID,
			"price_per_unit": pricePerUnit,
			"currency":       currency,
			"issued_at":      issuedAt,
		})
	}

	c.JSON(200, gin.H{
		"credits": credits,
		"total":   len(credits),
	})
}

func getCredit(c *gin.Context) {
	creditID := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	query := `
		SELECT credit_id, project_id, serial_number, quantity, unit, status,
			owner_id, price_per_unit, currency, issued_at, retired_at, retirement_reason
		FROM carbon_credits
		WHERE credit_id = $1 AND tenant_id = $2
	`

	var credID, projID, serialNum, unit, status, ownerID, currency string
	var quantity, pricePerUnit float64
	var issuedAt time.Time
	var retiredAt sql.NullTime
	var retirementReason sql.NullString

	err := db.QueryRow(query, creditID, tenantID).Scan(
		&credID, &projID, &serialNum, &quantity, &unit, &status,
		&ownerID, &pricePerUnit, &currency, &issuedAt, &retiredAt, &retirementReason)

	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "Credit not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch credit", "details": err.Error()})
		return
	}

	result := gin.H{
		"credit_id":      credID,
		"project_id":     projID,
		"serial_number":  serialNum,
		"quantity":       quantity,
		"unit":           unit,
		"status":         status,
		"owner_id":       ownerID,
		"price_per_unit": pricePerUnit,
		"currency":       currency,
		"issued_at":      issuedAt,
	}

	if retiredAt.Valid {
		result["retired_at"] = retiredAt.Time
	}
	if retirementReason.Valid {
		result["retirement_reason"] = retirementReason.String
	}

	c.JSON(200, result)
}

func retireCredit(c *gin.Context) {
	creditID := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	var req struct {
		Quantity         float64 `json:"quantity" binding:"required"`
		RetirementReason string  `json:"retirement_reason" binding:"required"`
		Beneficiary      string  `json:"beneficiary"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var currentQuantity float64
	var status, ownerID, projectID string
	err := db.QueryRow("SELECT quantity, status, owner_id, project_id FROM carbon_credits WHERE credit_id = $1 AND tenant_id = $2",
		creditID, tenantID).Scan(&currentQuantity, &status, &ownerID, &projectID)

	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "Credit not found"})
		return
	}

	if status == "retired" {
		c.JSON(400, gin.H{"error": "Credit is already retired"})
		return
	}

	if req.Quantity > currentQuantity {
		c.JSON(400, gin.H{"error": "Insufficient credit quantity"})
		return
	}

	retirementID := generateID("RET")

	query := `
		INSERT INTO carbon_retirements (
			retirement_id, tenant_id, credit_id, quantity, retired_by,
			retirement_reason, beneficiary
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING retirement_date
	`

	var retirementDate time.Time
	err = db.QueryRow(query, retirementID, tenantID, creditID, req.Quantity,
		ownerID, req.RetirementReason, req.Beneficiary).Scan(&retirementDate)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to retire credit", "details": err.Error()})
		return
	}

	if req.Quantity == currentQuantity {
		db.Exec("UPDATE carbon_credits SET status = 'retired', retired_at = CURRENT_TIMESTAMP, retirement_reason = $1 WHERE credit_id = $2",
			req.RetirementReason, creditID)
	} else {
		db.Exec("UPDATE carbon_credits SET quantity = quantity - $1 WHERE credit_id = $2",
			req.Quantity, creditID)
	}

	db.Exec("UPDATE carbon_projects SET retired_credits = retired_credits + $1 WHERE project_id = $2",
		req.Quantity, projectID)

	c.JSON(200, gin.H{
		"retirement_id":     retirementID,
		"credit_id":         creditID,
		"quantity":          req.Quantity,
		"retirement_reason": req.RetirementReason,
		"beneficiary":       req.Beneficiary,
		"retirement_date":   retirementDate,
	})
}

func createTrade(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	var req struct {
		CreditID     string  `json:"credit_id" binding:"required"`
		SellerID     string  `json:"seller_id" binding:"required"`
		BuyerID      string  `json:"buyer_id" binding:"required"`
		Quantity     float64 `json:"quantity" binding:"required"`
		PricePerUnit float64 `json:"price_per_unit" binding:"required"`
		Currency     string  `json:"currency"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if req.Currency == "" {
		req.Currency = "USD"
	}

	var ownerID string
	var quantity float64
	err := db.QueryRow("SELECT owner_id, quantity FROM carbon_credits WHERE credit_id = $1 AND tenant_id = $2",
		req.CreditID, tenantID).Scan(&ownerID, &quantity)

	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "Credit not found"})
		return
	}

	if ownerID != req.SellerID {
		c.JSON(400, gin.H{"error": "Seller does not own this credit"})
		return
	}

	if req.Quantity > quantity {
		c.JSON(400, gin.H{"error": "Insufficient credit quantity"})
		return
	}

	tradeID := generateID("TRD")
	totalAmount := req.Quantity * req.PricePerUnit

	query := `
		INSERT INTO carbon_trades (
			trade_id, tenant_id, credit_id, seller_id, buyer_id,
			quantity, price_per_unit, total_amount, currency
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING trade_date
	`

	var tradeDate time.Time
	err = db.QueryRow(query, tradeID, tenantID, req.CreditID, req.SellerID, req.BuyerID,
		req.Quantity, req.PricePerUnit, totalAmount, req.Currency).Scan(&tradeDate)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to create trade", "details": err.Error()})
		return
	}

	c.JSON(201, gin.H{
		"trade_id":       tradeID,
		"credit_id":      req.CreditID,
		"seller_id":      req.SellerID,
		"buyer_id":       req.BuyerID,
		"quantity":       req.Quantity,
		"price_per_unit": req.PricePerUnit,
		"total_amount":   totalAmount,
		"currency":       req.Currency,
		"status":         "pending",
		"trade_date":     tradeDate,
	})
}

func listTrades(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	status := c.Query("status")

	query := `
		SELECT trade_id, credit_id, seller_id, buyer_id, quantity,
			price_per_unit, total_amount, currency, status, trade_date
		FROM carbon_trades
		WHERE tenant_id = $1
	`
	args := []interface{}{tenantID}

	if status != "" {
		query += " AND status = $2"
		args = append(args, status)
	}

	query += " ORDER BY trade_date DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch trades", "details": err.Error()})
		return
	}
	defer rows.Close()

	trades := []map[string]interface{}{}
	for rows.Next() {
		var tradeID, creditID, sellerID, buyerID, currency, status string
		var quantity, pricePerUnit, totalAmount float64
		var tradeDate time.Time

		err := rows.Scan(&tradeID, &creditID, &sellerID, &buyerID, &quantity,
			&pricePerUnit, &totalAmount, &currency, &status, &tradeDate)
		if err != nil {
			continue
		}

		trades = append(trades, map[string]interface{}{
			"trade_id":       tradeID,
			"credit_id":      creditID,
			"seller_id":      sellerID,
			"buyer_id":       buyerID,
			"quantity":       quantity,
			"price_per_unit": pricePerUnit,
			"total_amount":   totalAmount,
			"currency":       currency,
			"status":         status,
			"trade_date":     tradeDate,
		})
	}

	c.JSON(200, gin.H{
		"trades": trades,
		"total":  len(trades),
	})
}

func getTrade(c *gin.Context) {
	tradeID := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	query := `
		SELECT trade_id, credit_id, seller_id, buyer_id, quantity,
			price_per_unit, total_amount, currency, status, trade_date, settlement_date
		FROM carbon_trades
		WHERE trade_id = $1 AND tenant_id = $2
	`

	var trdID, creditID, sellerID, buyerID, currency, status string
	var quantity, pricePerUnit, totalAmount float64
	var tradeDate time.Time
	var settlementDate sql.NullTime

	err := db.QueryRow(query, tradeID, tenantID).Scan(
		&trdID, &creditID, &sellerID, &buyerID, &quantity,
		&pricePerUnit, &totalAmount, &currency, &status, &tradeDate, &settlementDate)

	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "Trade not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch trade", "details": err.Error()})
		return
	}

	result := gin.H{
		"trade_id":       trdID,
		"credit_id":      creditID,
		"seller_id":      sellerID,
		"buyer_id":       buyerID,
		"quantity":       quantity,
		"price_per_unit": pricePerUnit,
		"total_amount":   totalAmount,
		"currency":       currency,
		"status":         status,
		"trade_date":     tradeDate,
	}

	if settlementDate.Valid {
		result["settlement_date"] = settlementDate.Time
	}

	c.JSON(200, result)
}

func settleTrade(c *gin.Context) {
	tradeID := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	var req struct {
		Pin string `json:"pin" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	query := `
		SELECT trade_id, credit_id, seller_id, buyer_id, quantity,
			price_per_unit, total_amount, currency, status, trade_date
		FROM carbon_trades
		WHERE trade_id = $1 AND tenant_id = $2
	`

	var trdID, creditID, sellerID, buyerID, currency, status string
	var quantity, pricePerUnit, totalAmount float64
	var tradeDate time.Time

	err := db.QueryRow(query, tradeID, tenantID).Scan(
		&trdID, &creditID, &sellerID, &buyerID, &quantity,
		&pricePerUnit, &totalAmount, &currency, &status, &tradeDate)

	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "Trade not found"})
		return
	}

	if status != "pending" {
		c.JSON(400, gin.H{"error": "Trade is not pending"})
		return
	}

	var AmountString = strconv.FormatFloat(totalAmount, 'f', 2, 64)

	log.Print("Pin: ")
	log.Print(req.Pin)

	res, err := TradePayment(&TradePaymentStruct{
		Payer:  buyerID,
		Payee:  sellerID,
		Amount: AmountString,
		Note:   "CARBON_CREDITS_PAYMENT/" + AmountString,
		Pin:    req.Pin,
	})

	if err != nil {
		c.JSON(400, gin.H{"error": "Payment failed."})
		return
	}

	db.Exec("UPDATE carbon_credits SET owner_id = $1 WHERE credit_id = $2", buyerID, creditID)

	update_query := `
		UPDATE carbon_trades
		SET status = 'settled', settlement_date = CURRENT_TIMESTAMP
		WHERE trade_id = $1
		RETURNING settlement_date
	`

	var settlementDate time.Time
	err = db.QueryRow(update_query, tradeID).Scan(&settlementDate)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to settle trade", "details": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"trade_id":         tradeID,
		"status":           "settled",
		"settlement_date":  settlementDate,
		"payment_response": res,
	})
}

func calculateFootprint(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	var req struct {
		EntityID             string  `json:"entity_id" binding:"required"`
		EntityType           string  `json:"entity_type" binding:"required"`
		Scope1Emissions      float64 `json:"scope1_emissions"`
		Scope2Emissions      float64 `json:"scope2_emissions"`
		Scope3Emissions      float64 `json:"scope3_emissions"`
		CalculationMethod    string  `json:"calculation_method"`
		ReportingPeriodStart string  `json:"reporting_period_start" binding:"required"`
		ReportingPeriodEnd   string  `json:"reporting_period_end" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	footprintID := generateID("FTP")
	totalEmissions := req.Scope1Emissions + req.Scope2Emissions + req.Scope3Emissions

	query := `
		INSERT INTO carbon_footprints (
			footprint_id, tenant_id, entity_id, entity_type,
			scope1_emissions, scope2_emissions, scope3_emissions, total_emissions,
			calculation_method, reporting_period_start, reporting_period_end
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING created_at
	`

	var createdAt time.Time
	err := db.QueryRow(query, footprintID, tenantID, req.EntityID, req.EntityType,
		req.Scope1Emissions, req.Scope2Emissions, req.Scope3Emissions, totalEmissions,
		req.CalculationMethod, req.ReportingPeriodStart, req.ReportingPeriodEnd).Scan(&createdAt)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to calculate footprint", "details": err.Error()})
		return
	}

	c.JSON(201, gin.H{
		"footprint_id":           footprintID,
		"entity_id":              req.EntityID,
		"entity_type":            req.EntityType,
		"scope1_emissions":       req.Scope1Emissions,
		"scope2_emissions":       req.Scope2Emissions,
		"scope3_emissions":       req.Scope3Emissions,
		"total_emissions":        totalEmissions,
		"unit":                   "tCO2e",
		"calculation_method":     req.CalculationMethod,
		"reporting_period_start": req.ReportingPeriodStart,
		"reporting_period_end":   req.ReportingPeriodEnd,
		"created_at":             createdAt,
	})
}

func listFootprints(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	entityID := c.Query("entity_id")

	query := `
		SELECT footprint_id, entity_id, entity_type, scope1_emissions, scope2_emissions,
			scope3_emissions, total_emissions, unit, reporting_period_start,
			reporting_period_end, verified, created_at
		FROM carbon_footprints
		WHERE tenant_id = $1
	`
	args := []interface{}{tenantID}

	if entityID != "" {
		query += " AND entity_id = $2"
		args = append(args, entityID)
	}

	query += " ORDER BY created_at DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch footprints", "details": err.Error()})
		return
	}
	defer rows.Close()

	footprints := []map[string]interface{}{}
	for rows.Next() {
		var ftpID, entID, entType, unit, periodStart, periodEnd string
		var scope1, scope2, scope3, total float64
		var verified bool
		var createdAt time.Time

		err := rows.Scan(&ftpID, &entID, &entType, &scope1, &scope2, &scope3, &total,
			&unit, &periodStart, &periodEnd, &verified, &createdAt)
		if err != nil {
			continue
		}

		footprints = append(footprints, map[string]interface{}{
			"footprint_id":           ftpID,
			"entity_id":              entID,
			"entity_type":            entType,
			"scope1_emissions":       scope1,
			"scope2_emissions":       scope2,
			"scope3_emissions":       scope3,
			"total_emissions":        total,
			"unit":                   unit,
			"reporting_period_start": periodStart,
			"reporting_period_end":   periodEnd,
			"verified":               verified,
			"created_at":             createdAt,
		})
	}

	c.JSON(200, gin.H{
		"footprints": footprints,
		"total":      len(footprints),
	})
}

func getFootprint(c *gin.Context) {
	footprintID := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	query := `
		SELECT footprint_id, entity_id, entity_type, scope1_emissions, scope2_emissions,
			scope3_emissions, total_emissions, unit, calculation_method,
			reporting_period_start, reporting_period_end, verified, verifier, created_at
		FROM carbon_footprints
		WHERE footprint_id = $1 AND tenant_id = $2
	`

	var ftpID, entID, entType, unit, calcMethod, periodStart, periodEnd string
	var scope1, scope2, scope3, total float64
	var verified bool
	var verifier sql.NullString
	var createdAt time.Time

	err := db.QueryRow(query, footprintID, tenantID).Scan(
		&ftpID, &entID, &entType, &scope1, &scope2, &scope3, &total,
		&unit, &calcMethod, &periodStart, &periodEnd, &verified, &verifier, &createdAt)

	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "Footprint not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch footprint", "details": err.Error()})
		return
	}

	result := gin.H{
		"footprint_id":           ftpID,
		"entity_id":              entID,
		"entity_type":            entType,
		"scope1_emissions":       scope1,
		"scope2_emissions":       scope2,
		"scope3_emissions":       scope3,
		"total_emissions":        total,
		"unit":                   unit,
		"calculation_method":     calcMethod,
		"reporting_period_start": periodStart,
		"reporting_period_end":   periodEnd,
		"verified":               verified,
		"created_at":             createdAt,
	}

	if verifier.Valid {
		result["verifier"] = verifier.String
	}

	c.JSON(200, result)
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s%s%d", prefix, hex.EncodeToString(b)[:8], time.Now().Unix()%10000)
}
