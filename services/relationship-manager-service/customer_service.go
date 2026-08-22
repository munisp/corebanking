package main

import (
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// CustomerService handles customer operations
type CustomerService struct {
	tenantID  string
	customers map[string]*Customer
	mu        sync.RWMutex
}

// NewCustomerService creates a new customer service
func NewCustomerService(tenantID string) *CustomerService {
	svc := &CustomerService{
		tenantID:  tenantID,
		customers: make(map[string]*Customer),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *CustomerService) initializeDefaultData(tenantID string) {
	// HNWI customer
	s.customers["cust-001"] = &Customer{
		CustomerID:      "cust-001",
		TenantID:        tenantID,
		CustomerType:    "individual",
		FirstName:       "Adaeze",
		LastName:        "Okonkwo",
		Email:           "adaeze.okonkwo@email.com",
		Phone:           "+234-803-555-1001",
		Segment:         "hnwi",
		RelationshipAge: 48,
		TotalBalance:    500000000, // 500M NGN
		TotalProducts:   8,
		Revenue:         25000000,
		Profitability:   15000000,
		RiskRating:      "low",
		NPS:             85,
		LastContact:     time.Now().AddDate(0, 0, -5),
		NextReview:      time.Now().AddDate(0, 1, 0),
		AssignedRM:      "rm-001",
		Status:          "active",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(-4, 0, 0),
		UpdatedAt:       time.Now(),
	}

	// Corporate customer
	s.customers["cust-002"] = &Customer{
		CustomerID:      "cust-002",
		TenantID:        tenantID,
		CustomerType:    "corporate",
		CompanyName:     "Dangote Industries Ltd",
		Email:           "treasury@dangote.com",
		Phone:           "+234-803-555-2001",
		Segment:         "corporate",
		RelationshipAge: 60,
		TotalBalance:    5000000000, // 5B NGN
		TotalProducts:   12,
		Revenue:         150000000,
		Profitability:   90000000,
		RiskRating:      "low",
		NPS:             78,
		LastContact:     time.Now().AddDate(0, 0, -3),
		NextReview:      time.Now().AddDate(0, 0, 15),
		AssignedRM:      "rm-001",
		Status:          "active",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(-5, 0, 0),
		UpdatedAt:       time.Now(),
	}

	// SME customer
	s.customers["cust-003"] = &Customer{
		CustomerID:      "cust-003",
		TenantID:        tenantID,
		CustomerType:    "sme",
		CompanyName:     "Lagos Tech Solutions",
		Email:           "info@lagostech.ng",
		Phone:           "+234-803-555-3001",
		Segment:         "sme",
		RelationshipAge: 24,
		TotalBalance:    50000000, // 50M NGN
		TotalProducts:   5,
		Revenue:         5000000,
		Profitability:   3000000,
		RiskRating:      "medium",
		NPS:             72,
		LastContact:     time.Now().AddDate(0, 0, -10),
		NextReview:      time.Now().AddDate(0, 0, 5),
		AssignedRM:      "rm-001",
		Status:          "active",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(-2, 0, 0),
		UpdatedAt:       time.Now(),
	}

	// Affluent customer
	s.customers["cust-004"] = &Customer{
		CustomerID:      "cust-004",
		TenantID:        tenantID,
		CustomerType:    "individual",
		FirstName:       "Chukwuemeka",
		LastName:        "Nwosu",
		Email:           "chukwuemeka.nwosu@email.com",
		Phone:           "+234-803-555-4001",
		Segment:         "affluent",
		RelationshipAge: 36,
		TotalBalance:    75000000, // 75M NGN
		TotalProducts:   6,
		Revenue:         3750000,
		Profitability:   2250000,
		RiskRating:      "low",
		NPS:             80,
		LastContact:     time.Now().AddDate(0, 0, -7),
		NextReview:      time.Now().AddDate(0, 2, 0),
		AssignedRM:      "rm-001",
		Status:          "active",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(-3, 0, 0),
		UpdatedAt:       time.Now(),
	}

	// At-risk customer (low NPS, declining balance)
	s.customers["cust-005"] = &Customer{
		CustomerID:      "cust-005",
		TenantID:        tenantID,
		CustomerType:    "individual",
		FirstName:       "Folake",
		LastName:        "Adeyemi",
		Email:           "folake.adeyemi@email.com",
		Phone:           "+234-803-555-5001",
		Segment:         "affluent",
		RelationshipAge: 18,
		TotalBalance:    25000000, // 25M NGN (declining)
		TotalProducts:   3,
		Revenue:         1250000,
		Profitability:   500000,
		RiskRating:      "high",
		NPS:             35,
		LastContact:     time.Now().AddDate(0, -1, 0),
		NextReview:      time.Now().AddDate(0, 0, -5), // Overdue
		AssignedRM:      "rm-001",
		Status:          "active",
		Metadata: map[string]interface{}{
			"atRisk":        true,
			"riskReason":    "declining_balance",
			"balanceChange": -40,
		},
		CreatedAt: time.Now().AddDate(-1, -6, 0),
		UpdatedAt: time.Now(),
	}

	// Dormant customer
	s.customers["cust-006"] = &Customer{
		CustomerID:      "cust-006",
		TenantID:        tenantID,
		CustomerType:    "individual",
		FirstName:       "Olumide",
		LastName:        "Bakare",
		Email:           "olumide.bakare@email.com",
		Phone:           "+234-803-555-6001",
		Segment:         "mass",
		RelationshipAge: 30,
		TotalBalance:    500000, // 500K NGN
		TotalProducts:   2,
		Revenue:         25000,
		Profitability:   10000,
		RiskRating:      "medium",
		NPS:             50,
		LastContact:     time.Now().AddDate(0, -3, 0),
		NextReview:      time.Now().AddDate(0, 0, 10),
		AssignedRM:      "rm-001",
		Status:          "dormant",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(-2, -6, 0),
		UpdatedAt:       time.Now().AddDate(0, -3, 0),
	}
}

// ListCustomers returns customers based on filters
func (s *CustomerService) ListCustomers(tenantID, rmID, segment string) []*Customer {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Customer
	for _, customer := range s.customers {
		if customer.TenantID != tenantID {
			continue
		}
		if rmID != "" && customer.AssignedRM != rmID {
			continue
		}
		if segment != "" && customer.Segment != segment {
			continue
		}
		result = append(result, customer)
	}
	return result
}

// GetCustomer retrieves a customer by ID
func (s *CustomerService) GetCustomer(tenantID, customerID string) (*Customer, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	customer, exists := s.customers[customerID]
	if !exists || customer.TenantID != tenantID {
		return nil, errors.New("customer not found")
	}
	return customer, nil
}

// CreateCustomer creates a new customer
func (s *CustomerService) CreateCustomer(tenantID, rmID string, req *CreateCustomerRequest) (*Customer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	customer := &Customer{
		CustomerID:      uuid.New().String(),
		TenantID:        tenantID,
		CustomerType:    req.CustomerType,
		FirstName:       req.FirstName,
		LastName:        req.LastName,
		CompanyName:     req.CompanyName,
		Email:           req.Email,
		Phone:           req.Phone,
		Segment:         req.Segment,
		RelationshipAge: 0,
		TotalBalance:    0,
		TotalProducts:   0,
		RiskRating:      "medium",
		NPS:             0,
		LastContact:     time.Now(),
		NextReview:      time.Now().AddDate(0, 3, 0),
		AssignedRM:      rmID,
		Status:          "active",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	s.customers[customer.CustomerID] = customer
	return customer, nil
}

// UpdateCustomer updates a customer
func (s *CustomerService) UpdateCustomer(customer *Customer) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.customers[customer.CustomerID]
	if !exists || existing.TenantID != customer.TenantID {
		return errors.New("customer not found")
	}

	customer.CreatedAt = existing.CreatedAt
	customer.UpdatedAt = time.Now()
	s.customers[customer.CustomerID] = customer
	return nil
}

// GetCustomerProducts returns customer products
func (s *CustomerService) GetCustomerProducts(tenantID, customerID string) []map[string]interface{} {
	return []map[string]interface{}{
		{
			"productID":   "prod-001",
			"productType": "savings",
			"productName": "Premium Savings Account",
			"balance":     250000000,
			"currency":    "NGN",
			"status":      "active",
			"openDate":    time.Now().AddDate(-2, 0, 0).Format("2006-01-02"),
		},
		{
			"productID":   "prod-002",
			"productType": "current",
			"productName": "Business Current Account",
			"balance":     150000000,
			"currency":    "NGN",
			"status":      "active",
			"openDate":    time.Now().AddDate(-2, 0, 0).Format("2006-01-02"),
		},
		{
			"productID":    "prod-003",
			"productType":  "fixed_deposit",
			"productName":  "Fixed Deposit - 12 Months",
			"balance":      100000000,
			"currency":     "NGN",
			"interestRate": 15.5,
			"maturityDate": time.Now().AddDate(0, 6, 0).Format("2006-01-02"),
			"status":       "active",
		},
		{
			"productID":    "prod-004",
			"productType":  "loan",
			"productName":  "Business Expansion Loan",
			"balance":      -50000000,
			"currency":     "NGN",
			"interestRate": 22.0,
			"status":       "active",
		},
	}
}

// GetCustomerTransactions returns recent customer transactions
func (s *CustomerService) GetCustomerTransactions(tenantID, customerID string) []map[string]interface{} {
	return []map[string]interface{}{
		{
			"transactionID": "txn-001",
			"date":          time.Now().AddDate(0, 0, -1).Format("2006-01-02"),
			"type":          "credit",
			"amount":        5000000,
			"currency":      "NGN",
			"description":   "Salary Credit",
			"balance":       255000000,
		},
		{
			"transactionID": "txn-002",
			"date":          time.Now().AddDate(0, 0, -2).Format("2006-01-02"),
			"type":          "debit",
			"amount":        2000000,
			"currency":      "NGN",
			"description":   "Transfer to Vendor",
			"balance":       250000000,
		},
		{
			"transactionID": "txn-003",
			"date":          time.Now().AddDate(0, 0, -3).Format("2006-01-02"),
			"type":          "credit",
			"amount":        10000000,
			"currency":      "NGN",
			"description":   "Investment Maturity",
			"balance":       252000000,
		},
	}
}

// GetAtRiskCustomers returns at-risk customers
func (s *CustomerService) GetAtRiskCustomers(tenantID, rmID string) []*Customer {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Customer
	for _, customer := range s.customers {
		if customer.TenantID != tenantID {
			continue
		}
		if rmID != "" && customer.AssignedRM != rmID {
			continue
		}
		// At-risk criteria: low NPS, high risk rating, or flagged
		if customer.NPS < 50 || customer.RiskRating == "high" {
			result = append(result, customer)
		}
		if atRisk, ok := customer.Metadata["atRisk"].(bool); ok && atRisk {
			// Avoid duplicates
			found := false
			for _, r := range result {
				if r.CustomerID == customer.CustomerID {
					found = true
					break
				}
			}
			if !found {
				result = append(result, customer)
			}
		}
	}
	return result
}

// GetDormantCustomers returns dormant customers
func (s *CustomerService) GetDormantCustomers(tenantID, rmID string) []*Customer {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Customer
	for _, customer := range s.customers {
		if customer.TenantID != tenantID {
			continue
		}
		if rmID != "" && customer.AssignedRM != rmID {
			continue
		}
		if customer.Status == "dormant" {
			result = append(result, customer)
		}
	}
	return result
}

// SearchCustomers searches customers by name or email
func (s *CustomerService) SearchCustomers(tenantID, query string) []*Customer {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query = strings.ToLower(query)
	var result []*Customer
	for _, customer := range s.customers {
		if customer.TenantID != tenantID {
			continue
		}
		if strings.Contains(strings.ToLower(customer.FirstName), query) ||
			strings.Contains(strings.ToLower(customer.LastName), query) ||
			strings.Contains(strings.ToLower(customer.CompanyName), query) ||
			strings.Contains(strings.ToLower(customer.Email), query) {
			result = append(result, customer)
		}
	}
	return result
}
