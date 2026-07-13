package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// CampaignService handles campaign operations
type CampaignService struct {
	tenantID  string
	campaigns map[string]*Campaign
	mu        sync.RWMutex
}

// NewCampaignService creates a new campaign service
func NewCampaignService(tenantID string) *CampaignService {
	svc := &CampaignService{
		tenantID:  tenantID,
		campaigns: make(map[string]*Campaign),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *CampaignService) initializeDefaultData(tenantID string) {
	// Active credit card campaign
	s.campaigns["camp-001"] = &Campaign{
		CampaignID:      "camp-001",
		TenantID:        tenantID,
		CampaignName:    "Premium Credit Card Acquisition",
		CampaignType:    "acquisition",
		ProductType:     "card",
		StartDate:       time.Now().AddDate(0, -1, 0),
		EndDate:         time.Now().AddDate(0, 1, 0),
		TargetSegment:   "affluent",
		TargetCount:     500,
		ContactedCount:  320,
		ResponseCount:   85,
		ConversionCount: 42,
		Budget:          5000000,
		Spent:           3200000,
		Revenue:         21000000,
		Status:          "active",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, -1, 0),
		UpdatedAt:       time.Now(),
	}

	// Active fixed deposit campaign
	s.campaigns["camp-002"] = &Campaign{
		CampaignID:      "camp-002",
		TenantID:        tenantID,
		CampaignName:    "High-Yield Fixed Deposit Drive",
		CampaignType:    "cross_sell",
		ProductType:     "deposit",
		StartDate:       time.Now().AddDate(0, 0, -15),
		EndDate:         time.Now().AddDate(0, 0, 45),
		TargetSegment:   "hnwi",
		TargetCount:     100,
		ContactedCount:  65,
		ResponseCount:   28,
		ConversionCount: 15,
		Budget:          2000000,
		Spent:           1300000,
		Revenue:         750000000,
		Status:          "active",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, 0, -15),
		UpdatedAt:       time.Now(),
	}

	// Completed loan campaign
	s.campaigns["camp-003"] = &Campaign{
		CampaignID:      "camp-003",
		TenantID:        tenantID,
		CampaignName:    "SME Working Capital Campaign",
		CampaignType:    "acquisition",
		ProductType:     "loan",
		StartDate:       time.Now().AddDate(0, -3, 0),
		EndDate:         time.Now().AddDate(0, -1, 0),
		TargetSegment:   "sme",
		TargetCount:     200,
		ContactedCount:  200,
		ResponseCount:   75,
		ConversionCount: 35,
		Budget:          3000000,
		Spent:           2800000,
		Revenue:         175000000,
		Status:          "completed",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, -3, 0),
		UpdatedAt:       time.Now().AddDate(0, -1, 0),
	}

	// Win-back campaign
	s.campaigns["camp-004"] = &Campaign{
		CampaignID:      "camp-004",
		TenantID:        tenantID,
		CampaignName:    "Dormant Customer Reactivation",
		CampaignType:    "win_back",
		ProductType:     "deposit",
		StartDate:       time.Now().AddDate(0, 0, -7),
		EndDate:         time.Now().AddDate(0, 1, 0),
		TargetSegment:   "mass",
		TargetCount:     1000,
		ContactedCount:  450,
		ResponseCount:   120,
		ConversionCount: 45,
		Budget:          1500000,
		Spent:           675000,
		Revenue:         22500000,
		Status:          "active",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, 0, -7),
		UpdatedAt:       time.Now(),
	}
}

// ListCampaigns returns campaigns based on filters
func (s *CampaignService) ListCampaigns(tenantID, status string) []*Campaign {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Campaign
	for _, campaign := range s.campaigns {
		if campaign.TenantID != tenantID {
			continue
		}
		if status != "" && campaign.Status != status {
			continue
		}
		result = append(result, campaign)
	}
	return result
}

// GetCampaign retrieves a campaign by ID
func (s *CampaignService) GetCampaign(tenantID, campaignID string) (*Campaign, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	campaign, exists := s.campaigns[campaignID]
	if !exists || campaign.TenantID != tenantID {
		return nil, errors.New("campaign not found")
	}
	return campaign, nil
}

// CreateCampaign creates a new campaign
func (s *CampaignService) CreateCampaign(tenantID string, campaign *Campaign) (*Campaign, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	campaign.CampaignID = uuid.New().String()
	campaign.TenantID = tenantID
	campaign.Status = "draft"
	campaign.ContactedCount = 0
	campaign.ResponseCount = 0
	campaign.ConversionCount = 0
	campaign.Spent = 0
	campaign.Revenue = 0
	campaign.CreatedAt = time.Now()
	campaign.UpdatedAt = time.Now()

	s.campaigns[campaign.CampaignID] = campaign
	return campaign, nil
}

// UpdateCampaign updates a campaign
func (s *CampaignService) UpdateCampaign(campaign *Campaign) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.campaigns[campaign.CampaignID]
	if !exists || existing.TenantID != campaign.TenantID {
		return errors.New("campaign not found")
	}

	campaign.CreatedAt = existing.CreatedAt
	campaign.UpdatedAt = time.Now()
	s.campaigns[campaign.CampaignID] = campaign
	return nil
}

// GetCampaignLeads returns leads for a campaign
func (s *CampaignService) GetCampaignLeads(tenantID, campaignID string) []map[string]interface{} {
	return []map[string]interface{}{
		{
			"leadID":       "lead-001",
			"customerID":   "cust-004",
			"customerName": "Chukwuemeka Nwosu",
			"status":       "contacted",
			"response":     "interested",
			"contactDate":  time.Now().AddDate(0, 0, -3).Format("2006-01-02"),
		},
		{
			"leadID":       "lead-002",
			"customerID":   "cust-new-001",
			"customerName": "Prospect Customer 1",
			"status":       "pending",
			"response":     "",
			"contactDate":  "",
		},
		{
			"leadID":       "lead-003",
			"customerID":   "cust-new-002",
			"customerName": "Prospect Customer 2",
			"status":       "converted",
			"response":     "accepted",
			"contactDate":  time.Now().AddDate(0, 0, -5).Format("2006-01-02"),
		},
	}
}

// GetCampaignPerformance returns campaign performance metrics
func (s *CampaignService) GetCampaignPerformance(tenantID, campaignID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	campaign, exists := s.campaigns[campaignID]
	if !exists || campaign.TenantID != tenantID {
		return map[string]interface{}{"error": "campaign not found"}
	}

	var contactRate, responseRate, conversionRate, roi float64
	if campaign.TargetCount > 0 {
		contactRate = float64(campaign.ContactedCount) / float64(campaign.TargetCount) * 100
	}
	if campaign.ContactedCount > 0 {
		responseRate = float64(campaign.ResponseCount) / float64(campaign.ContactedCount) * 100
	}
	if campaign.ResponseCount > 0 {
		conversionRate = float64(campaign.ConversionCount) / float64(campaign.ResponseCount) * 100
	}
	if campaign.Spent > 0 {
		roi = float64(campaign.Revenue-campaign.Spent) / float64(campaign.Spent) * 100
	}

	return map[string]interface{}{
		"campaignID":      campaign.CampaignID,
		"campaignName":    campaign.CampaignName,
		"targetCount":     campaign.TargetCount,
		"contactedCount":  campaign.ContactedCount,
		"responseCount":   campaign.ResponseCount,
		"conversionCount": campaign.ConversionCount,
		"contactRate":     contactRate,
		"responseRate":    responseRate,
		"conversionRate":  conversionRate,
		"budget":          campaign.Budget,
		"spent":           campaign.Spent,
		"revenue":         campaign.Revenue,
		"roi":             roi,
		"status":          campaign.Status,
		"timestamp":       time.Now().Format(time.RFC3339),
	}
}
