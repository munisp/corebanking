package main

import (
	"fmt"
	"math"
	"time"
)

// AgriculturalRiskEngine calculates risk for agricultural loans
type AgriculturalRiskEngine struct{}

func NewAgriculturalRiskEngine() *AgriculturalRiskEngine {
	return &AgriculturalRiskEngine{}
}

// CalculateRisk calculates risk score based on multiple factors
func (e *AgriculturalRiskEngine) CalculateRisk(
	cropType string,
	season string,
	location string,
	farmerHistory string,
	loanAmount float64,
) (string, float64, error) {

	// Base risk scores by crop type
	cropRisk := map[string]float64{
		"rice":       0.3,
		"maize":      0.4,
		"cassava":    0.2,
		"yam":        0.25,
		"cocoa":      0.5,
		"palm_oil":   0.45,
		"vegetables": 0.6,
	}

	// Season risk multipliers
	seasonRisk := map[string]float64{
		"dry":   1.3,
		"wet":   0.9,
		"mixed": 1.0,
	}

	// Location risk (based on climate zones)
	locationRisk := map[string]float64{
		"north": 1.2, // Drier, higher risk
		"south": 0.9, // More rainfall
		"east":  1.0,
		"west":  1.0,
	}

	// Farmer history multipliers
	historyRisk := map[string]float64{
		"excellent": 0.7,
		"good":      0.9,
		"average":   1.0,
		"poor":      1.3,
		"new":       1.5,
	}

	// Get base crop risk
	baseRisk, exists := cropRisk[cropType]
	if !exists {
		baseRisk = 0.5 // Default medium risk
	}

	// Apply multipliers
	seasonMult := seasonRisk[season]
	if seasonMult == 0 {
		seasonMult = 1.0
	}

	locationMult := locationRisk[location]
	if locationMult == 0 {
		locationMult = 1.0
	}

	historyMult := historyRisk[farmerHistory]
	if historyMult == 0 {
		historyMult = 1.0
	}

	// Calculate final risk score (0-1)
	riskScore := baseRisk * seasonMult * locationMult * historyMult

	// Adjust for loan amount (higher amounts = higher risk)
	if loanAmount > 5000000 { // > ₦5M
		riskScore *= 1.2
	} else if loanAmount > 1000000 { // > ₦1M
		riskScore *= 1.1
	}

	// Cap risk score at 1.0
	riskScore = math.Min(riskScore, 1.0)

	// Determine risk category
	var riskCategory string
	if riskScore < 0.3 {
		riskCategory = "low"
	} else if riskScore < 0.6 {
		riskCategory = "medium"
	} else {
		riskCategory = "high"
	}

	return riskCategory, riskScore, nil
}

// GeneratePolicyNumber generates a unique agricultural insurance policy number
func (e *AgriculturalRiskEngine) GeneratePolicyNumber(cropType string) string {
	timestamp := time.Now().Unix()
	cropCode := "AGR"

	switch cropType {
	case "rice":
		cropCode = "RIC"
	case "maize":
		cropCode = "MAZ"
	case "cassava":
		cropCode = "CAS"
	case "cocoa":
		cropCode = "COC"
	case "palm_oil":
		cropCode = "PLM"
	}

	return fmt.Sprintf("%s-%d-%04d", cropCode, timestamp, time.Now().Nanosecond()%10000)
}

// GetWeatherData retrieves weather forecast data for risk assessment
func (e *AgriculturalRiskEngine) GetWeatherData(location string, season string) map[string]interface{} {
	// In production, integrate with weather API (e.g., OpenWeatherMap, NIMET)
	// For now, return realistic sample data

	rainfall := 0.0
	temperature := 0.0
	humidity := 0.0

	// Simulate seasonal patterns
	if season == "wet" {
		rainfall = 150.0 + float64(time.Now().Unix()%50)
		temperature = 26.0 + float64(time.Now().Unix()%4)
		humidity = 75.0 + float64(time.Now().Unix()%15)
	} else if season == "dry" {
		rainfall = 20.0 + float64(time.Now().Unix()%30)
		temperature = 32.0 + float64(time.Now().Unix()%5)
		humidity = 40.0 + float64(time.Now().Unix()%20)
	} else {
		rainfall = 80.0 + float64(time.Now().Unix()%40)
		temperature = 28.0 + float64(time.Now().Unix()%4)
		humidity = 60.0 + float64(time.Now().Unix()%15)
	}

	return map[string]interface{}{
		"location":         location,
		"season":           season,
		"rainfall_mm":      rainfall,
		"temperature_c":    temperature,
		"humidity_percent": humidity,
		"forecast_period":  "30_days",
		"last_updated":     time.Now().Format(time.RFC3339),
	}
}
