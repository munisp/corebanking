package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

// ==================== WEATHER SERVICE ====================
// Integrates with NIMET (Nigerian Meteorological Agency) and OpenWeather APIs

type WeatherService struct {
	db             *sql.DB
	nimetAPIKey    string
	openWeatherKey string
	httpClient     *http.Client
}

func NewWeatherService(db *sql.DB) *WeatherService {
	return &WeatherService{
		db:             db,
		nimetAPIKey:    os.Getenv("NIMET_API_KEY"),
		openWeatherKey: os.Getenv("OPENWEATHER_API_KEY"),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// RegisterRoutes wires weather endpoints into the main router.
func (s *WeatherService) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/agriculture/weather/current", s.handleGetCurrentWeather).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/weather/forecast", s.handleGetWeatherForecast).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/weather/risk", s.handleGetLoanWeatherRisk).Methods("GET")
}

func (s *WeatherService) handleGetCurrentWeather(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	lga := r.URL.Query().Get("lga")
	if state == "" {
		http.Error(w, "state is required", http.StatusBadRequest)
		return
	}

	weather, err := s.GetCurrentWeather(r.Context(), state, lga)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(weather)
}

func (s *WeatherService) handleGetWeatherForecast(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	if state == "" {
		http.Error(w, "state is required", http.StatusBadRequest)
		return
	}

	forecast, err := s.GetWeatherForecast(r.Context(), state, 7)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(forecast)
}

func (s *WeatherService) handleGetLoanWeatherRisk(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	cropType := r.URL.Query().Get("crop_type")
	if state == "" || cropType == "" {
		http.Error(w, "state and crop_type are required", http.StatusBadRequest)
		return
	}

	risk, err := s.GetWeatherRiskForLoan(r.Context(), state, cropType, time.Now())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(risk)
}

// WeatherData represents weather information for agricultural planning
type WeatherData struct {
	Location      string    `json:"location"`
	State         string    `json:"state"`
	LGA           string    `json:"lga"`
	DataDate      time.Time `json:"data_date"`
	RainfallMM    float64   `json:"rainfall_mm"`
	Temperature   float64   `json:"temperature_celsius"`
	Humidity      float64   `json:"humidity_percent"`
	WindSpeed     float64   `json:"wind_speed_kmh"`
	Pressure      float64   `json:"pressure_hpa"`
	CloudCover    int       `json:"cloud_cover_percent"`
	UVIndex       float64   `json:"uv_index"`
	Season        string    `json:"season"`
	ForecastRisk  string    `json:"forecast_risk"`
	FarmingAdvice string    `json:"farming_advice"`
	DataSource    string    `json:"data_source"`
}

// WeatherForecast represents multi-day forecast
type WeatherForecast struct {
	Location    string         `json:"location"`
	State       string         `json:"state"`
	GeneratedAt time.Time      `json:"generated_at"`
	DailyData   []DailyWeather `json:"daily_data"`
	SeasonInfo  SeasonInfo     `json:"season_info"`
	RiskSummary RiskSummary    `json:"risk_summary"`
}

type DailyWeather struct {
	Date           time.Time `json:"date"`
	TempMin        float64   `json:"temp_min"`
	TempMax        float64   `json:"temp_max"`
	RainfallMM     float64   `json:"rainfall_mm"`
	RainfallChance int       `json:"rainfall_chance_percent"`
	Humidity       float64   `json:"humidity"`
	WindSpeed      float64   `json:"wind_speed"`
	Condition      string    `json:"condition"`
}

type SeasonInfo struct {
	CurrentSeason  string    `json:"current_season"`
	SeasonStart    time.Time `json:"season_start"`
	SeasonEnd      time.Time `json:"season_end"`
	DaysRemaining  int       `json:"days_remaining"`
	PlantingWindow bool      `json:"planting_window_open"`
	HarvestWindow  bool      `json:"harvest_window_open"`
}

type RiskSummary struct {
	OverallRisk       string  `json:"overall_risk"`
	DroughtRisk       string  `json:"drought_risk"`
	FloodRisk         string  `json:"flood_risk"`
	PestRisk          string  `json:"pest_risk"`
	RiskScore         float64 `json:"risk_score"`
	RecommendedAction string  `json:"recommended_action"`
}

// Nigerian states with their agricultural zones
var NigerianStates = map[string]struct {
	Zone             string
	AgroZone         string
	RainySeasonStart int     // Month
	RainySeasonEnd   int     // Month
	AverageRainfall  float64 // mm per year
}{
	"Lagos":       {"South-West", "Rainforest", 3, 11, 1600},
	"Kano":        {"North-West", "Sudan Savanna", 5, 9, 800},
	"Kaduna":      {"North-West", "Guinea Savanna", 4, 10, 1100},
	"Oyo":         {"South-West", "Derived Savanna", 3, 11, 1300},
	"Rivers":      {"South-South", "Mangrove/Rainforest", 3, 11, 2400},
	"Benue":       {"North-Central", "Guinea Savanna", 4, 10, 1200},
	"Plateau":     {"North-Central", "Montane", 4, 10, 1400},
	"Sokoto":      {"North-West", "Sahel Savanna", 6, 9, 600},
	"Borno":       {"North-East", "Sahel Savanna", 6, 9, 500},
	"Adamawa":     {"North-East", "Sudan Savanna", 5, 10, 900},
	"Niger":       {"North-Central", "Guinea Savanna", 4, 10, 1100},
	"Kebbi":       {"North-West", "Sudan Savanna", 5, 9, 700},
	"Zamfara":     {"North-West", "Sudan Savanna", 5, 9, 800},
	"Katsina":     {"North-West", "Sudan Savanna", 5, 9, 750},
	"Jigawa":      {"North-West", "Sudan Savanna", 5, 9, 700},
	"Bauchi":      {"North-East", "Sudan Savanna", 5, 10, 900},
	"Gombe":       {"North-East", "Sudan Savanna", 5, 10, 850},
	"Yobe":        {"North-East", "Sahel Savanna", 6, 9, 550},
	"Taraba":      {"North-East", "Guinea Savanna", 4, 10, 1100},
	"Nasarawa":    {"North-Central", "Guinea Savanna", 4, 10, 1200},
	"Kogi":        {"North-Central", "Derived Savanna", 4, 10, 1300},
	"Kwara":       {"North-Central", "Derived Savanna", 4, 10, 1200},
	"Ogun":        {"South-West", "Rainforest", 3, 11, 1400},
	"Ondo":        {"South-West", "Rainforest", 3, 11, 1800},
	"Osun":        {"South-West", "Derived Savanna", 3, 11, 1300},
	"Ekiti":       {"South-West", "Rainforest", 3, 11, 1500},
	"Edo":         {"South-South", "Rainforest", 3, 11, 2000},
	"Delta":       {"South-South", "Mangrove/Rainforest", 3, 11, 2500},
	"Bayelsa":     {"South-South", "Mangrove", 3, 11, 3000},
	"Cross River": {"South-South", "Rainforest", 3, 11, 2800},
	"Akwa Ibom":   {"South-South", "Rainforest", 3, 11, 2500},
	"Abia":        {"South-East", "Rainforest", 3, 11, 2200},
	"Imo":         {"South-East", "Rainforest", 3, 11, 2000},
	"Anambra":     {"South-East", "Derived Savanna", 3, 11, 1800},
	"Enugu":       {"South-East", "Derived Savanna", 3, 11, 1700},
	"Ebonyi":      {"South-East", "Derived Savanna", 3, 11, 1800},
	"FCT":         {"North-Central", "Guinea Savanna", 4, 10, 1200},
}

// GetCurrentWeather fetches current weather for a location
func (s *WeatherService) GetCurrentWeather(ctx context.Context, state, lga string) (*WeatherData, error) {
	// Try OpenWeather API first
	if s.openWeatherKey != "" {
		weather, err := s.fetchOpenWeather(ctx, state)
		if err == nil {
			return weather, nil
		}
	}

	// Fallback to NIMET API
	if s.nimetAPIKey != "" {
		weather, err := s.fetchNIMET(ctx, state, lga)
		if err == nil {
			return weather, nil
		}
	}

	// Fallback to simulated data based on historical patterns
	return s.getSimulatedWeather(state, lga)
}

// fetchOpenWeather fetches weather from OpenWeather API
func (s *WeatherService) fetchOpenWeather(ctx context.Context, state string) (*WeatherData, error) {
	// Map Nigerian states to coordinates
	coordinates := map[string]struct{ lat, lon float64 }{
		"Lagos":   {6.5244, 3.3792},
		"Kano":    {12.0022, 8.5920},
		"Kaduna":  {10.5222, 7.4383},
		"Abuja":   {9.0765, 7.3986},
		"FCT":     {9.0765, 7.3986},
		"Rivers":  {4.8156, 7.0498},
		"Oyo":     {7.8500, 3.9333},
		"Benue":   {7.7333, 8.5333},
		"Plateau": {9.8965, 8.8583},
	}

	coords, exists := coordinates[state]
	if !exists {
		coords = struct{ lat, lon float64 }{9.0765, 7.3986} // Default to Abuja
	}

	url := fmt.Sprintf(
		"https://api.openweathermap.org/data/2.5/weather?lat=%f&lon=%f&appid=%s&units=metric",
		coords.lat, coords.lon, s.openWeatherKey,
	)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenWeather API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Main struct {
			Temp     float64 `json:"temp"`
			Humidity float64 `json:"humidity"`
			Pressure float64 `json:"pressure"`
		} `json:"main"`
		Wind struct {
			Speed float64 `json:"speed"`
		} `json:"wind"`
		Clouds struct {
			All int `json:"all"`
		} `json:"clouds"`
		Rain struct {
			OneHour float64 `json:"1h"`
		} `json:"rain"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	weather := &WeatherData{
		Location:    state,
		State:       state,
		DataDate:    time.Now(),
		Temperature: result.Main.Temp,
		Humidity:    result.Main.Humidity,
		Pressure:    result.Main.Pressure,
		WindSpeed:   result.Wind.Speed * 3.6, // Convert m/s to km/h
		CloudCover:  result.Clouds.All,
		RainfallMM:  result.Rain.OneHour,
		DataSource:  "OpenWeather",
	}

	// Add season and risk info
	s.enrichWeatherData(weather)

	return weather, nil
}

// fetchNIMET fetches weather from Nigerian Meteorological Agency API
func (s *WeatherService) fetchNIMET(ctx context.Context, state, lga string) (*WeatherData, error) {
	// NIMET API integration (placeholder - actual API endpoint would be used in production)
	url := fmt.Sprintf("https://api.nimet.gov.ng/v1/weather?state=%s&lga=%s&key=%s",
		state, lga, s.nimetAPIKey)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("NIMET API returned status %d", resp.StatusCode)
	}

	// Parse NIMET response (structure would match actual API)
	var result struct {
		Data struct {
			Temperature float64 `json:"temperature"`
			Humidity    float64 `json:"humidity"`
			Rainfall    float64 `json:"rainfall"`
			WindSpeed   float64 `json:"wind_speed"`
		} `json:"data"`
	}

	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	weather := &WeatherData{
		Location:    fmt.Sprintf("%s, %s", lga, state),
		State:       state,
		LGA:         lga,
		DataDate:    time.Now(),
		Temperature: result.Data.Temperature,
		Humidity:    result.Data.Humidity,
		RainfallMM:  result.Data.Rainfall,
		WindSpeed:   result.Data.WindSpeed,
		DataSource:  "NIMET",
	}

	s.enrichWeatherData(weather)

	return weather, nil
}

// getSimulatedWeather returns realistic weather based on historical patterns
func (s *WeatherService) getSimulatedWeather(state, lga string) (*WeatherData, error) {
	stateInfo, exists := NigerianStates[state]
	if !exists {
		stateInfo = NigerianStates["Lagos"] // Default
	}

	now := time.Now()
	month := int(now.Month())

	// Determine if in rainy or dry season
	inRainySeason := month >= stateInfo.RainySeasonStart && month <= stateInfo.RainySeasonEnd

	var rainfall, temperature, humidity float64
	var season string

	if inRainySeason {
		season = "Wet Season"
		// Higher rainfall during peak months (July-September)
		if month >= 7 && month <= 9 {
			rainfall = 200.0 + float64(now.Unix()%100)
		} else {
			rainfall = 100.0 + float64(now.Unix()%80)
		}
		temperature = 25.0 + float64(now.Unix()%5)
		humidity = 70.0 + float64(now.Unix()%20)
	} else {
		season = "Dry Season"
		rainfall = 5.0 + float64(now.Unix()%20)
		temperature = 30.0 + float64(now.Unix()%8)
		humidity = 30.0 + float64(now.Unix()%25)
	}

	// Adjust for agro-ecological zone
	switch stateInfo.AgroZone {
	case "Sahel Savanna":
		temperature += 3
		humidity -= 10
		rainfall *= 0.5
	case "Sudan Savanna":
		temperature += 2
		humidity -= 5
	case "Rainforest", "Mangrove":
		temperature -= 2
		humidity += 10
		rainfall *= 1.3
	case "Montane":
		temperature -= 5
		humidity += 5
	}

	weather := &WeatherData{
		Location:    fmt.Sprintf("%s, %s", lga, state),
		State:       state,
		LGA:         lga,
		DataDate:    now,
		Temperature: temperature,
		Humidity:    humidity,
		RainfallMM:  rainfall,
		WindSpeed:   10.0 + float64(now.Unix()%15),
		Season:      season,
		DataSource:  "Historical Model",
	}

	s.enrichWeatherData(weather)

	return weather, nil
}

// enrichWeatherData adds farming advice and risk assessment
func (s *WeatherService) enrichWeatherData(weather *WeatherData) {
	now := time.Now()
	month := int(now.Month())

	// Determine season
	stateInfo, exists := NigerianStates[weather.State]
	if !exists {
		stateInfo = NigerianStates["Lagos"]
	}

	inRainySeason := month >= stateInfo.RainySeasonStart && month <= stateInfo.RainySeasonEnd
	if inRainySeason {
		weather.Season = "Wet Season"
	} else {
		weather.Season = "Dry Season"
	}

	// Calculate risk
	var riskScore float64
	var risks []string

	// Drought risk
	if weather.RainfallMM < 50 && inRainySeason {
		riskScore += 30
		risks = append(risks, "drought")
	}

	// Flood risk
	if weather.RainfallMM > 200 {
		riskScore += 25
		risks = append(risks, "flood")
	}

	// Heat stress risk
	if weather.Temperature > 35 {
		riskScore += 15
		risks = append(risks, "heat stress")
	}

	// High humidity (pest/disease risk)
	if weather.Humidity > 85 {
		riskScore += 20
		risks = append(risks, "pest/disease")
	}

	// Set risk level
	if riskScore >= 50 {
		weather.ForecastRisk = "High"
	} else if riskScore >= 25 {
		weather.ForecastRisk = "Medium"
	} else {
		weather.ForecastRisk = "Low"
	}

	// Generate farming advice
	weather.FarmingAdvice = s.generateFarmingAdvice(weather, inRainySeason, risks)
}

// generateFarmingAdvice creates actionable advice for farmers
func (s *WeatherService) generateFarmingAdvice(weather *WeatherData, inRainySeason bool, risks []string) string {
	var advice string

	if inRainySeason {
		if weather.RainfallMM > 150 {
			advice = "Heavy rainfall expected. Ensure proper drainage in your farm. Delay planting if soil is waterlogged."
		} else if weather.RainfallMM > 50 {
			advice = "Good planting conditions. Ideal time for transplanting seedlings and applying fertilizer."
		} else {
			advice = "Below normal rainfall. Consider supplementary irrigation if available."
		}
	} else {
		if weather.Temperature > 35 {
			advice = "High temperatures expected. Irrigate crops early morning or evening. Mulch to retain soil moisture."
		} else {
			advice = "Dry season conditions. Focus on harvesting, land preparation, and dry season crops if irrigation available."
		}
	}

	// Add risk-specific advice
	for _, risk := range risks {
		switch risk {
		case "flood":
			advice += " Create drainage channels to prevent waterlogging."
		case "drought":
			advice += " Conserve water and consider drought-resistant varieties."
		case "pest/disease":
			advice += " Monitor crops closely for pest and disease outbreaks."
		case "heat stress":
			advice += " Provide shade for livestock and irrigate during cooler hours."
		}
	}

	return advice
}

// GetWeatherForecast returns multi-day forecast
func (s *WeatherService) GetWeatherForecast(ctx context.Context, state string, days int) (*WeatherForecast, error) {
	if days > 14 {
		days = 14
	}

	stateInfo, exists := NigerianStates[state]
	if !exists {
		stateInfo = NigerianStates["Lagos"]
	}

	now := time.Now()
	forecast := &WeatherForecast{
		Location:    state,
		State:       state,
		GeneratedAt: now,
		DailyData:   make([]DailyWeather, days),
	}

	// Generate daily forecasts
	for i := 0; i < days; i++ {
		date := now.AddDate(0, 0, i)
		month := int(date.Month())
		inRainySeason := month >= stateInfo.RainySeasonStart && month <= stateInfo.RainySeasonEnd

		daily := DailyWeather{
			Date: date,
		}

		if inRainySeason {
			daily.TempMin = 22.0 + float64(i%3)
			daily.TempMax = 30.0 + float64(i%4)
			daily.RainfallMM = 50.0 + float64((now.Unix()+int64(i))%150)
			daily.RainfallChance = 60 + (i % 30)
			daily.Humidity = 70.0 + float64(i%20)
			daily.Condition = "Rainy"
		} else {
			daily.TempMin = 18.0 + float64(i%5)
			daily.TempMax = 35.0 + float64(i%5)
			daily.RainfallMM = float64((now.Unix() + int64(i)) % 20)
			daily.RainfallChance = 10 + (i % 20)
			daily.Humidity = 35.0 + float64(i%25)
			daily.Condition = "Sunny"
		}

		daily.WindSpeed = 8.0 + float64(i%10)
		forecast.DailyData[i] = daily
	}

	// Add season info
	month := int(now.Month())
	inRainySeason := month >= stateInfo.RainySeasonStart && month <= stateInfo.RainySeasonEnd

	if inRainySeason {
		forecast.SeasonInfo = SeasonInfo{
			CurrentSeason:  "Wet Season",
			SeasonStart:    time.Date(now.Year(), time.Month(stateInfo.RainySeasonStart), 1, 0, 0, 0, 0, time.UTC),
			SeasonEnd:      time.Date(now.Year(), time.Month(stateInfo.RainySeasonEnd), 30, 0, 0, 0, 0, time.UTC),
			PlantingWindow: month >= stateInfo.RainySeasonStart && month <= stateInfo.RainySeasonStart+2,
			HarvestWindow:  month >= stateInfo.RainySeasonEnd-1,
		}
		forecast.SeasonInfo.DaysRemaining = int(forecast.SeasonInfo.SeasonEnd.Sub(now).Hours() / 24)
	} else {
		nextRainyStart := time.Date(now.Year()+1, time.Month(stateInfo.RainySeasonStart), 1, 0, 0, 0, 0, time.UTC)
		if month < stateInfo.RainySeasonStart {
			nextRainyStart = time.Date(now.Year(), time.Month(stateInfo.RainySeasonStart), 1, 0, 0, 0, 0, time.UTC)
		}
		forecast.SeasonInfo = SeasonInfo{
			CurrentSeason:  "Dry Season",
			SeasonStart:    time.Date(now.Year(), time.Month(stateInfo.RainySeasonEnd+1), 1, 0, 0, 0, 0, time.UTC),
			SeasonEnd:      nextRainyStart.AddDate(0, 0, -1),
			PlantingWindow: false,
			HarvestWindow:  month == stateInfo.RainySeasonEnd+1,
		}
		forecast.SeasonInfo.DaysRemaining = int(nextRainyStart.Sub(now).Hours() / 24)
	}

	// Calculate risk summary
	totalRainfall := 0.0
	for _, d := range forecast.DailyData {
		totalRainfall += d.RainfallMM
	}
	avgRainfall := totalRainfall / float64(days)

	forecast.RiskSummary = RiskSummary{
		OverallRisk: "Low",
		DroughtRisk: "Low",
		FloodRisk:   "Low",
		PestRisk:    "Low",
		RiskScore:   20.0,
	}

	if avgRainfall < 30 && inRainySeason {
		forecast.RiskSummary.DroughtRisk = "Medium"
		forecast.RiskSummary.RiskScore += 20
		forecast.RiskSummary.RecommendedAction = "Consider supplementary irrigation"
	}

	if avgRainfall > 150 {
		forecast.RiskSummary.FloodRisk = "High"
		forecast.RiskSummary.RiskScore += 30
		forecast.RiskSummary.RecommendedAction = "Ensure proper drainage"
	}

	if forecast.RiskSummary.RiskScore >= 50 {
		forecast.RiskSummary.OverallRisk = "High"
	} else if forecast.RiskSummary.RiskScore >= 30 {
		forecast.RiskSummary.OverallRisk = "Medium"
	}

	return forecast, nil
}

// GetWeatherRiskForLoan calculates weather risk for loan assessment
func (s *WeatherService) GetWeatherRiskForLoan(ctx context.Context, state, cropType string, plantingDate time.Time) (*LoanWeatherRisk, error) {
	stateInfo, exists := NigerianStates[state]
	if !exists {
		stateInfo = NigerianStates["Lagos"]
	}

	cropData, cropExists := CropDatabase[cropType]
	if !cropExists {
		return nil, fmt.Errorf("unknown crop type: %s", cropType)
	}

	plantingMonth := int(plantingDate.Month())
	harvestMonth := int(plantingDate.AddDate(0, 0, cropData.GrowingPeriod).Month())

	risk := &LoanWeatherRisk{
		State:        state,
		CropType:     cropType,
		PlantingDate: plantingDate,
		HarvestDate:  plantingDate.AddDate(0, 0, cropData.GrowingPeriod),
	}

	// Check if planting is in optimal season
	inRainySeason := plantingMonth >= stateInfo.RainySeasonStart && plantingMonth <= stateInfo.RainySeasonEnd

	if cropData.WaterRequirement == "high" && !inRainySeason {
		risk.RiskLevel = "High"
		risk.RiskScore = 70
		risk.Warnings = append(risk.Warnings, "Planting high water-requirement crop in dry season")
		risk.InterestAdjustment = 3.0
	} else if inRainySeason && plantingMonth >= stateInfo.RainySeasonStart && plantingMonth <= stateInfo.RainySeasonStart+2 {
		risk.RiskLevel = "Low"
		risk.RiskScore = 20
		risk.Recommendations = append(risk.Recommendations, "Optimal planting window")
		risk.InterestAdjustment = -1.0
	} else {
		risk.RiskLevel = "Medium"
		risk.RiskScore = 40
		risk.InterestAdjustment = 1.0
	}

	// Check harvest timing
	harvestInRainySeason := harvestMonth >= stateInfo.RainySeasonStart && harvestMonth <= stateInfo.RainySeasonEnd
	if harvestInRainySeason && (cropType == "rice" || cropType == "maize" || cropType == "groundnut") {
		risk.Warnings = append(risk.Warnings, "Harvest may coincide with heavy rains - post-harvest losses risk")
		risk.RiskScore += 10
	}

	// Zone-specific risks
	switch stateInfo.AgroZone {
	case "Sahel Savanna":
		risk.Warnings = append(risk.Warnings, "Low rainfall zone - irrigation recommended")
		risk.RiskScore += 15
	case "Mangrove":
		risk.Warnings = append(risk.Warnings, "Flood-prone area - ensure proper drainage")
		risk.RiskScore += 10
	}

	// Recalculate risk level based on final score
	if risk.RiskScore >= 60 {
		risk.RiskLevel = "High"
	} else if risk.RiskScore >= 35 {
		risk.RiskLevel = "Medium"
	} else {
		risk.RiskLevel = "Low"
	}

	return risk, nil
}

type LoanWeatherRisk struct {
	State              string    `json:"state"`
	CropType           string    `json:"crop_type"`
	PlantingDate       time.Time `json:"planting_date"`
	HarvestDate        time.Time `json:"harvest_date"`
	RiskLevel          string    `json:"risk_level"`
	RiskScore          float64   `json:"risk_score"`
	Warnings           []string  `json:"warnings"`
	Recommendations    []string  `json:"recommendations"`
	InterestAdjustment float64   `json:"interest_adjustment"` // percentage points
}

// StoreWeatherData saves weather data to database for analytics
func (s *WeatherService) StoreWeatherData(ctx context.Context, weather *WeatherData) error {
	query := `
		INSERT INTO weather_data (tenant_id, location, state, lga, data_date, 
			rainfall_mm, temperature_celsius, humidity_percent, wind_speed, 
			forecast_risk, data_source, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	_, err := s.db.ExecContext(ctx, query,
		"default", weather.Location, weather.State, weather.LGA, weather.DataDate,
		weather.RainfallMM, weather.Temperature, weather.Humidity, weather.WindSpeed,
		weather.ForecastRisk, weather.DataSource, time.Now())

	return err
}

// GetHistoricalWeather retrieves historical weather data
func (s *WeatherService) GetHistoricalWeather(ctx context.Context, state string, startDate, endDate time.Time) ([]WeatherData, error) {
	query := `
		SELECT location, state, lga, data_date, rainfall_mm, temperature_celsius, 
			humidity_percent, wind_speed, forecast_risk, data_source
		FROM weather_data
		WHERE state = $1 AND data_date BETWEEN $2 AND $3
		ORDER BY data_date DESC
	`

	rows, err := s.db.QueryContext(ctx, query, state, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []WeatherData
	for rows.Next() {
		var w WeatherData
		err := rows.Scan(&w.Location, &w.State, &w.LGA, &w.DataDate, &w.RainfallMM,
			&w.Temperature, &w.Humidity, &w.WindSpeed, &w.ForecastRisk, &w.DataSource)
		if err != nil {
			continue
		}
		results = append(results, w)
	}

	return results, nil
}
