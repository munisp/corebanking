package main

import (
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type LoanCalcResult struct {
	ID                 string        `json:"id"`
	CustomerName       string        `json:"customerName,omitempty"`
	LoanType           string        `json:"loanType"`
	PrincipalKobo      int64         `json:"principal_kobo"` // kobo integer — never float
	AnnualRate         float64       `json:"annualRate"`     // percentage ratio — stays float
	TenorMonths        int           `json:"tenorMonths"`
	RepaymentType      string        `json:"repaymentType"`
	MonthlyPaymentKobo int64         `json:"monthly_payment_kobo"` // kobo integer
	TotalInterestKobo  int64         `json:"total_interest_kobo"`  // kobo integer
	TotalRepaymentKobo int64         `json:"total_repayment_kobo"` // kobo integer
	EffectiveRate      float64       `json:"effectiveRate"`        // percentage ratio — stays float
	Schedule           []Installment `json:"schedule,omitempty"`
	CreatedAt          time.Time     `json:"createdAt"`
}

type Installment struct {
	Month              int   `json:"month"`
	OpeningBalanceKobo int64 `json:"opening_balance_kobo"` // kobo integer
	EMIKobo            int64 `json:"emi_kobo"`             // kobo integer
	PrincipalKobo      int64 `json:"principal_kobo"`       // kobo integer
	InterestKobo       int64 `json:"interest_kobo"`        // kobo integer
	ClosingBalanceKobo int64 `json:"closing_balance_kobo"` // kobo integer
}

var (
	lcMu            sync.RWMutex
	lcCalcs         []LoanCalcResult
	lcCounter       int64
	validLoanTypes  = map[string]bool{"mortgage": true, "education": true, "agriculture": true, "personal": true, "auto": true, "murabaha": true, "ijara": true, "general": true}
	validRepayTypes = map[string]bool{"equal_installment": true, "reducing_balance": true, "bullet": true, "balloon": true}
)

// roundKobo rounds a float64 kobo amount to the nearest whole kobo.
func roundKobo(v float64) int64 { return int64(math.Round(v)) }

// calculateEMIKobo computes the repayment schedule for a loan.
// principalKobo: loan amount in kobo (integer, never float).
// annualRate: percentage (ratio) — intermediate f64 math is acceptable here.
// Returns all monetary outputs as int64 kobo.
func calculateEMIKobo(principalKobo int64, annualRate float64, tenorMonths int, repaymentType string) (int64, int64, int64, []Installment) {
	principal := float64(principalKobo) // f64 only for compound-interest formula — not stored
	monthlyRate := annualRate / 100.0 / 12.0
	var monthlyPaymentF, totalInterestF, totalRepaymentF float64
	var schedule []Installment
	balanceF := principal

	switch repaymentType {
	case "equal_installment":
		if monthlyRate == 0 {
			monthlyPaymentF = principal / float64(tenorMonths)
		} else {
			pow := math.Pow(1+monthlyRate, float64(tenorMonths))
			monthlyPaymentF = principal * monthlyRate * pow / (pow - 1)
		}
		monthlyPaymentF = math.Round(monthlyPaymentF)
		for m := 1; m <= tenorMonths; m++ {
			interestF := math.Round(balanceF * monthlyRate)
			princF := monthlyPaymentF - interestF
			if m == tenorMonths {
				princF = balanceF
				monthlyPaymentF = princF + interestF
			}
			closingF := balanceF - princF
			if closingF < 1 {
				closingF = 0
			}
			schedule = append(schedule, Installment{
				Month:              m,
				OpeningBalanceKobo: roundKobo(balanceF),
				EMIKobo:            roundKobo(monthlyPaymentF),
				PrincipalKobo:      roundKobo(princF),
				InterestKobo:       roundKobo(interestF),
				ClosingBalanceKobo: roundKobo(closingF),
			})
			totalInterestF += interestF
			balanceF = closingF
		}
		totalRepaymentF = principal + totalInterestF

	case "reducing_balance":
		principalPartF := principal / float64(tenorMonths)
		for m := 1; m <= tenorMonths; m++ {
			interestF := math.Round(balanceF * monthlyRate)
			emiF := math.Round(principalPartF + interestF)
			closingF := balanceF - principalPartF
			if m == tenorMonths {
				closingF = 0
			}
			schedule = append(schedule, Installment{
				Month:              m,
				OpeningBalanceKobo: roundKobo(balanceF),
				EMIKobo:            roundKobo(emiF),
				PrincipalKobo:      roundKobo(principalPartF),
				InterestKobo:       roundKobo(interestF),
				ClosingBalanceKobo: roundKobo(closingF),
			})
			totalInterestF += interestF
			balanceF = closingF
		}
		totalRepaymentF = principal + totalInterestF
		monthlyPaymentF = totalRepaymentF / float64(tenorMonths)

	case "bullet":
		totalInterestF = principal * annualRate / 100.0 * float64(tenorMonths) / 12.0
		totalRepaymentF = principal + totalInterestF
		monthlyPaymentF = 0
		for m := 1; m < tenorMonths; m++ {
			schedule = append(schedule, Installment{
				Month:              m,
				OpeningBalanceKobo: principalKobo,
				ClosingBalanceKobo: principalKobo,
			})
		}
		schedule = append(schedule, Installment{
			Month:              tenorMonths,
			OpeningBalanceKobo: principalKobo,
			EMIKobo:            roundKobo(totalRepaymentF),
			PrincipalKobo:      principalKobo,
			InterestKobo:       roundKobo(totalInterestF),
		})

	case "balloon":
		balloonPct := 0.30
		amortizedF := principal * (1 - balloonPct)
		balloonF := principal * balloonPct
		if monthlyRate == 0 {
			monthlyPaymentF = amortizedF / float64(tenorMonths)
		} else {
			pow := math.Pow(1+monthlyRate, float64(tenorMonths))
			monthlyPaymentF = amortizedF * monthlyRate * pow / (pow - 1)
		}
		monthlyPaymentF = math.Round(monthlyPaymentF)
		balanceF = amortizedF
		for m := 1; m <= tenorMonths; m++ {
			interestF := math.Round(balanceF * monthlyRate)
			princF := monthlyPaymentF - interestF
			closingF := balanceF - princF
			emiF := monthlyPaymentF
			if m == tenorMonths {
				princF = balanceF
				closingF = 0
				emiF = princF + interestF + balloonF
			}
			schedule = append(schedule, Installment{
				Month:              m,
				OpeningBalanceKobo: roundKobo(balanceF),
				EMIKobo:            roundKobo(emiF),
				PrincipalKobo:      roundKobo(princF),
				InterestKobo:       roundKobo(interestF),
				ClosingBalanceKobo: roundKobo(closingF),
			})
			totalInterestF += interestF
			balanceF = closingF
		}
		totalRepaymentF = principal + totalInterestF
		monthlyPaymentF = totalRepaymentF / float64(tenorMonths)
	}

	return roundKobo(monthlyPaymentF), roundKobo(totalInterestF), roundKobo(totalRepaymentF), schedule
}

func registerCalculatorRoutes(api *gin.RouterGroup) {
	calc := api.Group("/calculator")
	calc.GET("", listCalculations)
	calc.POST("", createCalculation)
	calc.POST("/schedule", getSchedule)
	calc.POST("/compare", compareLoans)
	calc.POST("/affordability", checkAffordability)
}

func listCalculations(c *gin.Context) {
	lcMu.RLock()
	defer lcMu.RUnlock()
	c.JSON(http.StatusOK, gin.H{"items": lcCalcs, "total": len(lcCalcs)})
}

func createCalculation(c *gin.Context) {
	var req struct {
		CustomerName  string  `json:"customerName"`
		LoanType      string  `json:"loanType"`
		PrincipalKobo int64   `json:"principal_kobo"` // kobo integer — never float
		AnnualRate    float64 `json:"annualRate"`
		TenorMonths   int     `json:"tenorMonths"`
		RepaymentType string  `json:"repaymentType"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	if req.PrincipalKobo <= 0 || req.AnnualRate < 0 || req.TenorMonths <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "principal_kobo, annualRate, and tenorMonths must be positive"})
		return
	}
	if req.LoanType == "" || !validLoanTypes[req.LoanType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid loanType"})
		return
	}
	if req.RepaymentType == "" {
		req.RepaymentType = "equal_installment"
	}
	if !validRepayTypes[req.RepaymentType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid repaymentType"})
		return
	}

	mp, ti, tr, _ := calculateEMIKobo(req.PrincipalKobo, req.AnnualRate, req.TenorMonths, req.RepaymentType)
	effectiveRate := 0.0
	if req.PrincipalKobo > 0 {
		effectiveRate = math.Round(float64(ti)/float64(req.PrincipalKobo)*10000) / 100
	}
	lcMu.Lock()
	lcCounter++
	calc := LoanCalcResult{
		ID: generateID("LC"), CustomerName: req.CustomerName,
		LoanType: req.LoanType, PrincipalKobo: req.PrincipalKobo, AnnualRate: req.AnnualRate,
		TenorMonths: req.TenorMonths, RepaymentType: req.RepaymentType,
		MonthlyPaymentKobo: mp, TotalInterestKobo: ti, TotalRepaymentKobo: tr,
		EffectiveRate: effectiveRate, CreatedAt: time.Now().UTC(),
	}
	lcCalcs = append(lcCalcs, calc)
	lcMu.Unlock()
	c.JSON(http.StatusCreated, calc)
}

func getSchedule(c *gin.Context) {
	var req struct {
		PrincipalKobo int64   `json:"principal_kobo"` // kobo integer — never float
		AnnualRate    float64 `json:"annualRate"`
		TenorMonths   int     `json:"tenorMonths"`
		RepaymentType string  `json:"repaymentType"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	if req.RepaymentType == "" {
		req.RepaymentType = "equal_installment"
	}
	_, totalIntKobo, totalRepayKobo, schedule := calculateEMIKobo(req.PrincipalKobo, req.AnnualRate, req.TenorMonths, req.RepaymentType)
	c.JSON(http.StatusOK, gin.H{
		"principal_kobo":       req.PrincipalKobo,
		"annualRate":           req.AnnualRate,
		"tenorMonths":          req.TenorMonths,
		"repaymentType":        req.RepaymentType,
		"total_interest_kobo":  totalIntKobo,
		"total_repayment_kobo": totalRepayKobo,
		"installments":         schedule,
	})
}

func compareLoans(c *gin.Context) {
	var req struct {
		PrincipalKobo int64 `json:"principal_kobo"` // kobo integer — never float
		TenorMonths   int   `json:"tenorMonths"`
		Scenarios     []struct {
			LoanType      string  `json:"loanType"`
			AnnualRate    float64 `json:"annualRate"`
			RepaymentType string  `json:"repaymentType"`
		} `json:"scenarios"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	if len(req.Scenarios) == 0 || len(req.Scenarios) > 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provide 1-10 scenarios"})
		return
	}
	type Result struct {
		LoanType           string  `json:"loanType"`
		AnnualRate         float64 `json:"annualRate"`
		RepaymentType      string  `json:"repaymentType"`
		MonthlyPaymentKobo int64   `json:"monthly_payment_kobo"`
		TotalInterestKobo  int64   `json:"total_interest_kobo"`
		TotalRepaymentKobo int64   `json:"total_repayment_kobo"`
		SavingsKobo        int64   `json:"savings_kobo"`
	}
	var results []Result
	var maxRepayKobo int64
	for _, s := range req.Scenarios {
		rt := s.RepaymentType
		if rt == "" {
			rt = "equal_installment"
		}
		mp, ti, tr, _ := calculateEMIKobo(req.PrincipalKobo, s.AnnualRate, req.TenorMonths, rt)
		if tr > maxRepayKobo {
			maxRepayKobo = tr
		}
		results = append(results, Result{LoanType: s.LoanType, AnnualRate: s.AnnualRate, RepaymentType: rt, MonthlyPaymentKobo: mp, TotalInterestKobo: ti, TotalRepaymentKobo: tr})
	}
	for i := range results {
		results[i].SavingsKobo = maxRepayKobo - results[i].TotalRepaymentKobo
	}
	c.JSON(http.StatusOK, gin.H{"principal_kobo": req.PrincipalKobo, "tenorMonths": req.TenorMonths, "comparisons": results})
}

func checkAffordability(c *gin.Context) {
	var req struct {
		MonthlyIncomeKobo  int64   `json:"monthly_income_kobo"`  // kobo integer
		MonthlyExpenseKobo int64   `json:"monthly_expense_kobo"` // kobo integer
		ExistingEMIKobo    int64   `json:"existing_emi_kobo"`    // kobo integer
		DesiredTenor       int     `json:"desiredTenor"`
		AnnualRate         float64 `json:"annualRate"` // percentage — stays float
		DTILimit           float64 `json:"dtiLimit"`   // percentage — stays float
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	if req.MonthlyIncomeKobo <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "monthly_income_kobo must be positive"})
		return
	}
	if req.DTILimit <= 0 {
		req.DTILimit = 40.0
	}
	// DTI computation uses float for ratio math — result rounded to kobo at output boundary
	incomeF := float64(req.MonthlyIncomeKobo)
	expenseF := float64(req.MonthlyExpenseKobo)
	existingF := float64(req.ExistingEMIKobo)
	maxDTIF := incomeF*req.DTILimit/100 - existingF
	if maxDTIF < 0 {
		maxDTIF = 0
	}
	disposableF := incomeF - expenseF - existingF
	if disposableF < 0 {
		disposableF = 0
	}
	maxEMIF := math.Min(maxDTIF, disposableF*0.8)
	monthlyRate := req.AnnualRate / 100.0 / 12.0
	var maxPrincipalF float64
	if maxEMIF > 0 && req.DesiredTenor > 0 {
		if monthlyRate == 0 {
			maxPrincipalF = maxEMIF * float64(req.DesiredTenor)
		} else {
			pow := math.Pow(1+monthlyRate, float64(req.DesiredTenor))
			maxPrincipalF = maxEMIF * (pow - 1) / (monthlyRate * pow)
		}
	}
	currentDTI := 0.0
	if req.MonthlyIncomeKobo > 0 {
		currentDTI = math.Round(existingF/incomeF*10000) / 100
	}
	c.JSON(http.StatusOK, gin.H{
		"max_emi_kobo":       roundKobo(maxEMIF),
		"max_principal_kobo": roundKobo(maxPrincipalF),
		"current_dti_pct":    currentDTI,
		"dti_limit_pct":      req.DTILimit,
		"disposable_kobo":    roundKobo(disposableF),
		"eligible":           maxEMIF > 0,
	})
}
