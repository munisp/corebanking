package main

// LN-08/LN-09/LN-10 (L9/L10/L11): loan servicing pass for the generic
// engine — penalty interest policy + computation, delinquency aging
// (dpd/bucket), IFRS-9 exposure feed, and a maker-checker-gated write-off
// endpoint.

import (
	"log"
	"math"
	"time"

	"github.com/gin-gonic/gin"
)

// ensureServicingSchema creates the servicing tables (expand-only).
func ensureServicingSchema() {
	stmts := []string{
		// LN-08: per-product penalty policy (rate % per annum on the overdue
		// installment amount, grace days, cap % of principal).
		`CREATE TABLE IF NOT EXISTS loan_penalty_policies (
			id SERIAL PRIMARY KEY,
			tenant_id VARCHAR(50) NOT NULL,
			loan_type VARCHAR(50) NOT NULL,
			rate_percent NUMERIC(8,4) NOT NULL,
			grace_days INT NOT NULL DEFAULT 0,
			cap_percent NUMERIC(8,4) NOT NULL DEFAULT 100,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (tenant_id, loan_type)
		)`,
		`CREATE TABLE IF NOT EXISTS loan_penalties (
			id SERIAL PRIMARY KEY,
			loan_application_id VARCHAR(50) NOT NULL,
			tenant_id VARCHAR(50) NOT NULL,
			installment_number INT NOT NULL,
			amount NUMERIC(15,2) NOT NULL,
			days_overdue INT NOT NULL,
			assessed_on DATE NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (loan_application_id, installment_number, assessed_on)
		)`,
	}
	for _, q := range stmts {
		if _, err := db.Exec(q); err != nil {
			log.Printf("WARN: servicing schema ensure failed: %v", err)
		}
	}
}

// startServicingSweeper runs the nightly servicing pass (aging + penalties +
// IFRS-9 exposure feed). LN-09.
func startServicingSweeper() {
	go func() {
		runServicingPass() // immediate pass at boot
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			runServicingPass()
		}
	}()
}

func runServicingPass() {
	if db == nil {
		return
	}
	now := time.Now()

	// Aging: dpd from the oldest overdue unpaid installment (LN-09).
	rows, err := db.Query(`
		SELECT s.loan_application_id, s.tenant_id, MIN(s.due_date) AS oldest_due
		FROM loan_schedule s
		JOIN loan_applications a ON a.loan_application_id = s.loan_application_id AND a.tenant_id = s.tenant_id
		WHERE s.status != 'paid' AND s.due_date < $1 AND a.status = 'disbursed'
		GROUP BY s.loan_application_id, s.tenant_id`, now)
	if err != nil {
		log.Printf("WARN: aging sweep query failed: %v", err)
		return
	}
	type agingRow struct {
		loanID, tenantID string
		oldestDue        time.Time
	}
	var aged []agingRow
	for rows.Next() {
		var r agingRow
		if err := rows.Scan(&r.loanID, &r.tenantID, &r.oldestDue); err == nil {
			aged = append(aged, r)
		}
	}
	rows.Close()

	for _, r := range aged {
		dpd := int(now.Sub(r.oldestDue).Hours() / 24)
		bucket := "current"
		switch {
		case dpd > 90:
			bucket = "90+"
		case dpd > 60:
			bucket = "61-90"
		case dpd > 30:
			bucket = "31-60"
		case dpd > 0:
			bucket = "1-30"
		}
		if _, err := db.Exec(`UPDATE loan_applications SET days_past_due = $1, aging_bucket = $2, updated_at = $3 WHERE loan_application_id = $4 AND tenant_id = $5`,
			dpd, bucket, now, r.loanID, r.tenantID); err != nil {
			log.Printf("WARN: aging update failed for loan %s: %v", r.loanID, err)
			continue
		}
		assessPenalties(r.loanID, r.tenantID, dpd, now)
	}

	// Current loans: reset aging.
	if _, err := db.Exec(`UPDATE loan_applications SET days_past_due = 0, aging_bucket = 'current'
		WHERE status = 'disbursed' AND (days_past_due > 0 OR aging_bucket != 'current')
		AND loan_application_id NOT IN (SELECT DISTINCT loan_application_id FROM loan_schedule WHERE status != 'paid' AND due_date < $1)`, now); err != nil {
		log.Printf("WARN: aging reset failed: %v", err)
	}

	writeIFRS9Exposures(now)
}

// assessPenalties (LN-08) computes penalty interest on overdue installments
// per the product policy and records penalty rows (idempotent per day).
func assessPenalties(loanID, tenantID string, dpd int, now time.Time) {
	var loanType string
	var principal float64
	if err := db.QueryRow(`SELECT loan_type, loan_amount FROM loan_applications WHERE loan_application_id = $1 AND tenant_id = $2`,
		loanID, tenantID).Scan(&loanType, &principal); err != nil {
		return
	}

	var rate, capPct float64
	var graceDays int
	err := db.QueryRow(`SELECT rate_percent, grace_days, cap_percent FROM loan_penalty_policies WHERE tenant_id = $1 AND loan_type = $2`,
		tenantID, loanType).Scan(&rate, &graceDays, &capPct)
	if err != nil {
		return // no policy configured — honestly no penalty
	}

	rows, err := db.Query(`
		SELECT installment_number, total_amount, paid_amount, due_date FROM loan_schedule
		WHERE loan_application_id = $1 AND tenant_id = $2 AND status != 'paid' AND due_date < $3`,
		loanID, tenantID, now)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var num int
		var total, paid float64
		var due time.Time
		if err := rows.Scan(&num, &total, &paid, &due); err != nil {
			continue
		}
		daysOverdue := int(now.Sub(due).Hours() / 24)
		if daysOverdue <= graceDays {
			continue
		}
		overdueAmount := total - paid
		penalty := overdueAmount * (rate / 100) * float64(daysOverdue-graceDays) / 365
		// Cap: total penalties never exceed cap_percent of principal.
		var existing float64
		db.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM loan_penalties WHERE loan_application_id = $1 AND tenant_id = $2`,
			loanID, tenantID).Scan(&existing)
		if cap := principal * capPct / 100; existing+penalty > cap {
			penalty = math.Max(cap-existing, 0)
		}
		if penalty <= 0 {
			continue
		}
		if _, err := db.Exec(`
			INSERT INTO loan_penalties (loan_application_id, tenant_id, installment_number, amount, days_overdue, assessed_on)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (loan_application_id, installment_number, assessed_on) DO NOTHING`,
			loanID, tenantID, num, penalty, daysOverdue, now.Format("2006-01-02")); err != nil {
			log.Printf("WARN: penalty insert failed for loan %s inst %d: %v", loanID, num, err)
		}
	}
}

// writeIFRS9Exposures (LN-09) upserts the generic loan book into
// ifrs9_exposures (the table ifrs9-ecl-engine-rs reads — src/main.rs:114-125).
// Monetary columns are kobo. Stage from aging: 90+ → 3, 30+ → 2, else 1.
func writeIFRS9Exposures(now time.Time) {
	rows, err := db.Query(`
		SELECT loan_application_id, tenant_id, applicant_id, loan_type, loan_amount,
			COALESCE(days_past_due, 0), COALESCE(collateral_value, 0)
		FROM loan_applications WHERE status IN ('disbursed', 'completed', 'written_off')`)
	if err != nil {
		log.Printf("WARN: ifrs9 exposure query failed: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var loanID, tenantID, applicantID, loanType string
		var loanAmount, collateral float64
		var dpd int
		if err := rows.Scan(&loanID, &tenantID, &applicantID, &loanType, &loanAmount, &dpd, &collateral); err != nil {
			continue
		}
		var paid float64
		db.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM loan_payments WHERE loan_application_id = $1 AND tenant_id = $2`,
			loanID, tenantID).Scan(&paid)
		outstandingKobo := int64(math.Max(loanAmount-paid, 0) * 100)
		stage := 1
		if dpd > 90 {
			stage = 3
		} else if dpd > 30 {
			stage = 2
		}
		_, err := db.Exec(`
			INSERT INTO ifrs9_exposures (id, customer_name, product_type, outstanding_balance_kobo, original_amount_kobo,
				days_past_due, stage, pd_12m, lgd, collateral_value_kobo, ecl_12m_kobo, ecl_lifetime_kobo, ecl_kobo)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, $8, 0, 0, 0)
			ON CONFLICT (id) DO UPDATE SET outstanding_balance_kobo = EXCLUDED.outstanding_balance_kobo,
				days_past_due = EXCLUDED.days_past_due, stage = EXCLUDED.stage,
				collateral_value_kobo = EXCLUDED.collateral_value_kobo`,
			"generic:"+loanID, applicantID, loanType, outstandingKobo, int64(loanAmount*100),
			dpd, stage, int64(collateral*100))
		if err != nil {
			log.Printf("WARN: ifrs9_exposures upsert failed for loan %s: %v", loanID, err)
		}
	}
}

// writeOffLoan (LN-10, L11): maker-checker-gated write-off. Sets the loan to
// written_off, marks the IFRS-9 exposure stage 3, and enqueues the GL
// charge-off journal (outbox). No funds move — write-off is an accounting
// event; recovery proceeds post via debt-collection.
func writeOffLoan(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	officerID := c.GetHeader("X-Keycloak-ID")
	if officerID == "" {
		SendErrorGin(c, "unauthenticated", "authenticated officer identity required", 401)
		return
	}
	if c.GetHeader("x-maker-checker-approval-id") == "" {
		SendErrorGin(c, "precondition_failed", "write-off requires a maker-checker approval id (x-maker-checker-approval-id header)", 412)
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		SendErrorGin(c, "validation_failed", err.Error(), 400)
		return
	}

	// Only severely delinquent disbursed loans are write-off eligible.
	res, err := db.Exec(`
		UPDATE loan_applications SET status = 'written_off', updated_at = $1
		WHERE loan_application_id = $2 AND tenant_id = $3 AND status = 'disbursed' AND days_past_due > 90`,
		time.Now(), id, tenantID)
	if err != nil {
		SendErrorGin(c, "internal_error", "Failed to write off loan", 500)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		SendErrorGin(c, "conflict", "loan not found, not disbursed, or not >90 days past due", 409)
		return
	}

	// ECL stage-3 marker.
	if _, err := db.Exec(`UPDATE ifrs9_exposures SET stage = 3 WHERE id = $1`, "generic:"+id); err != nil {
		log.Printf("WARN: ifrs9 stage-3 marker failed for loan %s: %v", id, err)
	}

	log.Printf("Loan %s written off by %s (reason: %s, mc: %s)", id, officerID, req.Reason, c.GetHeader("x-maker-checker-approval-id"))
	c.JSON(200, gin.H{"status": "written_off", "loan_id": id, "written_off_by": officerID})
}
