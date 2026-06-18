package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

// ==================== AGTECH & SATELLITE INTEGRATIONS ====================
// Satellite imagery, NDVI analysis, farm verification, IoT sensors

// Farm Polygon for satellite analysis
type FarmPolygon struct {
	ID                 string      `json:"id"`
	FarmID             string      `json:"farm_id"`
	FarmerID           string      `json:"farmer_id"`
	TenantID           string      `json:"tenant_id"`
	Coordinates        [][]float64 `json:"coordinates"` // [[lng, lat], ...]
	CentroidLng        float64     `json:"centroid_lng"`
	CentroidLat        float64     `json:"centroid_lat"`
	DeclaredArea       float64     `json:"declared_area"`       // hectares
	SatelliteArea      float64     `json:"satellite_area"`      // hectares from satellite
	AreaVariance       float64     `json:"area_variance"`       // percentage difference
	VerificationStatus string      `json:"verification_status"` // PENDING, VERIFIED, FLAGGED
	LastUpdated        time.Time   `json:"last_updated"`
	CreatedAt          time.Time   `json:"created_at"`
}

// NDVI (Normalized Difference Vegetation Index) Data
type NDVIData struct {
	ID              string    `json:"id"`
	FarmID          string    `json:"farm_id"`
	PolygonID       string    `json:"polygon_id"`
	CaptureDate     time.Time `json:"capture_date"`
	SatelliteSource string    `json:"satellite_source"` // Sentinel-2, Planet, Landsat
	NDVIMean        float64   `json:"ndvi_mean"`        // -1 to 1
	NDVIMin         float64   `json:"ndvi_min"`
	NDVIMax         float64   `json:"ndvi_max"`
	NDVIStdDev      float64   `json:"ndvi_std_dev"`
	HealthStatus    string    `json:"health_status"`  // EXCELLENT, GOOD, FAIR, POOR, CRITICAL
	CloudCoverage   float64   `json:"cloud_coverage"` // percentage
	GrowthStage     string    `json:"growth_stage"`   // PLANTING, VEGETATIVE, FLOWERING, MATURITY
	ExpectedNDVI    float64   `json:"expected_ndvi"`  // Based on crop type and growth stage
	NDVIDeviation   float64   `json:"ndvi_deviation"` // Deviation from expected
	AlertTriggered  bool      `json:"alert_triggered"`
	CreatedAt       time.Time `json:"created_at"`
}

// Crop Classification from satellite
type CropClassification struct {
	ID                 string            `json:"id"`
	FarmID             string            `json:"farm_id"`
	PolygonID          string            `json:"polygon_id"`
	ClassificationDate time.Time         `json:"classification_date"`
	DeclaredCrop       string            `json:"declared_crop"`
	DetectedCrop       string            `json:"detected_crop"`
	Confidence         float64           `json:"confidence"`   // 0-100%
	MatchStatus        string            `json:"match_status"` // MATCH, MISMATCH, UNCERTAIN
	AlternativeCrops   []CropProbability `json:"alternative_crops"`
	CreatedAt          time.Time         `json:"created_at"`
}

type CropProbability struct {
	CropType    string  `json:"crop_type"`
	Probability float64 `json:"probability"`
}

// Yield Estimation from satellite
type YieldEstimation struct {
	ID              string    `json:"id"`
	FarmID          string    `json:"farm_id"`
	LoanID          string    `json:"loan_id"`
	CropType        string    `json:"crop_type"`
	EstimationDate  time.Time `json:"estimation_date"`
	GrowthStage     string    `json:"growth_stage"`
	DaysToHarvest   int       `json:"days_to_harvest"`
	EstimatedYield  float64   `json:"estimated_yield"`  // tonnes per hectare
	YieldConfidence float64   `json:"yield_confidence"` // percentage
	HistoricalAvg   float64   `json:"historical_avg"`
	YieldVariance   float64   `json:"yield_variance"` // percentage from historical
	RiskFactors     []string  `json:"risk_factors"`
	Methodology     string    `json:"methodology"` // NDVI_REGRESSION, ML_MODEL, HYBRID
	CreatedAt       time.Time `json:"created_at"`
}

// IoT Sensor Data
type IoTSensor struct {
	ID             string    `json:"id"`
	FarmID         string    `json:"farm_id"`
	SensorType     string    `json:"sensor_type"` // WEATHER, SOIL_MOISTURE, SOIL_PH, TEMPERATURE
	SensorModel    string    `json:"sensor_model"`
	SerialNumber   string    `json:"serial_number"`
	Location       string    `json:"location"`
	GPSCoordinates string    `json:"gps_coordinates"`
	Status         string    `json:"status"` // ACTIVE, INACTIVE, MAINTENANCE
	LastReading    time.Time `json:"last_reading"`
	BatteryLevel   float64   `json:"battery_level"` // percentage
	InstallDate    time.Time `json:"install_date"`
	CreatedAt      time.Time `json:"created_at"`
}

type SensorReading struct {
	ID             string    `json:"id"`
	SensorID       string    `json:"sensor_id"`
	FarmID         string    `json:"farm_id"`
	ReadingType    string    `json:"reading_type"`
	Value          float64   `json:"value"`
	Unit           string    `json:"unit"`
	Quality        string    `json:"quality"` // GOOD, FAIR, POOR
	Timestamp      time.Time `json:"timestamp"`
	AlertTriggered bool      `json:"alert_triggered"`
	AlertType      string    `json:"alert_type"`
}

// Weather Station Data
type WeatherStationData struct {
	StationID      string    `json:"station_id"`
	FarmID         string    `json:"farm_id"`
	Temperature    float64   `json:"temperature"` // Celsius
	Humidity       float64   `json:"humidity"`    // percentage
	Rainfall       float64   `json:"rainfall"`    // mm
	WindSpeed      float64   `json:"wind_speed"`  // km/h
	WindDirection  string    `json:"wind_direction"`
	SolarRadiation float64   `json:"solar_radiation"` // W/m2
	Pressure       float64   `json:"pressure"`        // hPa
	Timestamp      time.Time `json:"timestamp"`
}

// Soil Analysis Data
type SoilAnalysis struct {
	ID              string    `json:"id"`
	FarmID          string    `json:"farm_id"`
	SampleDate      time.Time `json:"sample_date"`
	SampleLocation  string    `json:"sample_location"`
	GPSCoordinates  string    `json:"gps_coordinates"`
	SoilType        string    `json:"soil_type"`
	pH              float64   `json:"ph"`
	Nitrogen        float64   `json:"nitrogen"`       // mg/kg
	Phosphorus      float64   `json:"phosphorus"`     // mg/kg
	Potassium       float64   `json:"potassium"`      // mg/kg
	OrganicMatter   float64   `json:"organic_matter"` // percentage
	Moisture        float64   `json:"moisture"`       // percentage
	SoilHealth      string    `json:"soil_health"`    // EXCELLENT, GOOD, FAIR, POOR
	Recommendations []string  `json:"recommendations"`
	CreatedAt       time.Time `json:"created_at"`
}

// Early Warning Alert from satellite/IoT
type AgTechAlert struct {
	ID                string     `json:"id"`
	FarmID            string     `json:"farm_id"`
	LoanID            string     `json:"loan_id"`
	AlertType         string     `json:"alert_type"` // NDVI_DROP, DROUGHT, FLOOD, PEST, DISEASE
	Severity          string     `json:"severity"`   // LOW, MEDIUM, HIGH, CRITICAL
	Source            string     `json:"source"`     // SATELLITE, IOT, WEATHER_API
	Description       string     `json:"description"`
	CurrentValue      float64    `json:"current_value"`
	ThresholdValue    float64    `json:"threshold_value"`
	Deviation         float64    `json:"deviation"`
	RecommendedAction string     `json:"recommended_action"`
	DetectedAt        time.Time  `json:"detected_at"`
	AcknowledgedAt    *time.Time `json:"acknowledged_at"`
	ResolvedAt        *time.Time `json:"resolved_at"`
	Status            string     `json:"status"` // OPEN, ACKNOWLEDGED, RESOLVED
}

// AgTech Service
type AgTechService struct {
	db             *sql.DB
	httpClient     *http.Client
	planetAPIKey   string
	sentinelAPIKey string
}

func NewAgTechService(db *sql.DB) *AgTechService {
	return &AgTechService{
		db:             db,
		httpClient:     &http.Client{Timeout: 60 * time.Second},
		planetAPIKey:   os.Getenv("PLANET_API_KEY"),
		sentinelAPIKey: os.Getenv("SENTINEL_API_KEY"),
	}
}

// Register AgTech routes
func (s *AgTechService) RegisterRoutes(r *mux.Router) {
	// Farm Polygons
	r.HandleFunc("/api/v1/agtech/polygons", s.ListFarmPolygons).Methods("GET")
	r.HandleFunc("/api/v1/agtech/polygons", s.CreateFarmPolygon).Methods("POST")
	r.HandleFunc("/api/v1/agtech/polygons/{polygon_id}", s.GetFarmPolygon).Methods("GET")
	r.HandleFunc("/api/v1/agtech/polygons/{polygon_id}", s.UpdateFarmPolygon).Methods("PUT")
	r.HandleFunc("/api/v1/agtech/polygons/{polygon_id}/verify", s.VerifyFarmPolygon).Methods("POST")

	// NDVI Analysis
	r.HandleFunc("/api/v1/agtech/ndvi", s.ListNDVIData).Methods("GET")
	r.HandleFunc("/api/v1/agtech/ndvi/farm/{farm_id}", s.GetFarmNDVI).Methods("GET")
	r.HandleFunc("/api/v1/agtech/ndvi/farm/{farm_id}/history", s.GetNDVIHistory).Methods("GET")
	r.HandleFunc("/api/v1/agtech/ndvi/farm/{farm_id}/analyze", s.AnalyzeNDVI).Methods("POST")
	r.HandleFunc("/api/v1/agtech/ndvi/alerts", s.GetNDVIAlerts).Methods("GET")

	// Crop Classification
	r.HandleFunc("/api/v1/agtech/classification/farm/{farm_id}", s.ClassifyCrop).Methods("POST")
	r.HandleFunc("/api/v1/agtech/classification/farm/{farm_id}/history", s.GetClassificationHistory).Methods("GET")

	// Yield Estimation
	r.HandleFunc("/api/v1/agtech/yield/farm/{farm_id}", s.EstimateYield).Methods("POST")
	r.HandleFunc("/api/v1/agtech/yield/loan/{loan_id}", s.GetLoanYieldEstimate).Methods("GET")
	r.HandleFunc("/api/v1/agtech/yield/portfolio", s.GetPortfolioYieldEstimates).Methods("GET")

	// IoT Sensors
	r.HandleFunc("/api/v1/agtech/sensors", s.ListSensors).Methods("GET")
	r.HandleFunc("/api/v1/agtech/sensors", s.RegisterSensor).Methods("POST")
	r.HandleFunc("/api/v1/agtech/sensors/{sensor_id}", s.GetSensor).Methods("GET")
	r.HandleFunc("/api/v1/agtech/sensors/{sensor_id}/readings", s.GetSensorReadings).Methods("GET")
	r.HandleFunc("/api/v1/agtech/sensors/{sensor_id}/readings", s.SubmitSensorReading).Methods("POST")

	// Weather Stations
	r.HandleFunc("/api/v1/agtech/weather-stations", s.ListWeatherStations).Methods("GET")
	r.HandleFunc("/api/v1/agtech/weather-stations/{station_id}/data", s.GetWeatherStationData).Methods("GET")

	// Soil Analysis
	r.HandleFunc("/api/v1/agtech/soil/farm/{farm_id}", s.GetSoilAnalysis).Methods("GET")
	r.HandleFunc("/api/v1/agtech/soil/farm/{farm_id}", s.SubmitSoilAnalysis).Methods("POST")

	// Alerts
	r.HandleFunc("/api/v1/agtech/alerts", s.ListAgTechAlerts).Methods("GET")
	r.HandleFunc("/api/v1/agtech/alerts/{alert_id}", s.GetAgTechAlert).Methods("GET")
	r.HandleFunc("/api/v1/agtech/alerts/{alert_id}/acknowledge", s.AcknowledgeAlert).Methods("POST")
	r.HandleFunc("/api/v1/agtech/alerts/{alert_id}/resolve", s.ResolveAlert).Methods("POST")

	// Farm Verification
	r.HandleFunc("/api/v1/agtech/verify/farm/{farm_id}", s.VerifyFarmSatellite).Methods("POST")
	r.HandleFunc("/api/v1/agtech/verify/loan/{loan_id}", s.VerifyLoanFarms).Methods("POST")
}

// Farm Polygon Handlers
func (s *AgTechService) ListFarmPolygons(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	farmerID := r.URL.Query().Get("farmer_id")

	polygons := []FarmPolygon{
		{
			ID:                 "POLY-001",
			FarmID:             "FARM-001",
			FarmerID:           farmerID,
			TenantID:           tenantID,
			Coordinates:        [][]float64{{8.5919, 12.0022}, {8.5929, 12.0022}, {8.5929, 12.0032}, {8.5919, 12.0032}},
			CentroidLng:        8.5924,
			CentroidLat:        12.0027,
			DeclaredArea:       5.0,
			SatelliteArea:      4.8,
			AreaVariance:       -4.0,
			VerificationStatus: "VERIFIED",
			LastUpdated:        time.Now().AddDate(0, 0, -7),
			CreatedAt:          time.Now().AddDate(0, -3, 0),
		},
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"polygons": polygons,
		"total":    len(polygons),
	})
}

func (s *AgTechService) CreateFarmPolygon(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FarmID       string      `json:"farm_id"`
		FarmerID     string      `json:"farmer_id"`
		TenantID     string      `json:"tenant_id"`
		Coordinates  [][]float64 `json:"coordinates"`
		DeclaredArea float64     `json:"declared_area"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Calculate centroid
	var sumLng, sumLat float64
	for _, coord := range req.Coordinates {
		sumLng += coord[0]
		sumLat += coord[1]
	}
	centroidLng := sumLng / float64(len(req.Coordinates))
	centroidLat := sumLat / float64(len(req.Coordinates))

	polygon := FarmPolygon{
		ID:                 fmt.Sprintf("POLY-%d", time.Now().Unix()),
		FarmID:             req.FarmID,
		FarmerID:           req.FarmerID,
		TenantID:           req.TenantID,
		Coordinates:        req.Coordinates,
		CentroidLng:        centroidLng,
		CentroidLat:        centroidLat,
		DeclaredArea:       req.DeclaredArea,
		VerificationStatus: "PENDING",
		CreatedAt:          time.Now(),
		LastUpdated:        time.Now(),
	}

	json.NewEncoder(w).Encode(polygon)
}

func (s *AgTechService) GetFarmPolygon(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	polygonID := vars["polygon_id"]

	polygon := FarmPolygon{
		ID:                 polygonID,
		FarmID:             "FARM-001",
		Coordinates:        [][]float64{{8.5919, 12.0022}, {8.5929, 12.0022}, {8.5929, 12.0032}, {8.5919, 12.0032}},
		CentroidLng:        8.5924,
		CentroidLat:        12.0027,
		DeclaredArea:       5.0,
		SatelliteArea:      4.8,
		AreaVariance:       -4.0,
		VerificationStatus: "VERIFIED",
	}
	json.NewEncoder(w).Encode(polygon)
}

func (s *AgTechService) UpdateFarmPolygon(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	polygonID := vars["polygon_id"]

	var req struct {
		Coordinates [][]float64 `json:"coordinates"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	json.NewEncoder(w).Encode(map[string]string{
		"polygon_id": polygonID,
		"status":     "updated",
	})
}

func (s *AgTechService) VerifyFarmPolygon(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	polygonID := vars["polygon_id"]

	// Simulate satellite verification
	satelliteArea := 4.8 // Would come from satellite API
	declaredArea := 5.0
	variance := ((satelliteArea - declaredArea) / declaredArea) * 100

	status := "VERIFIED"
	if math.Abs(variance) > 10 {
		status = "FLAGGED"
	}

	result := map[string]interface{}{
		"polygon_id":       polygonID,
		"declared_area":    declaredArea,
		"satellite_area":   satelliteArea,
		"area_variance":    variance,
		"status":           status,
		"satellite_source": "Sentinel-2",
		"capture_date":     time.Now().AddDate(0, 0, -3),
		"verified_at":      time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

// NDVI Handlers
func (s *AgTechService) ListNDVIData(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	ndviData := []NDVIData{
		{
			ID:              "NDVI-001",
			FarmID:          "FARM-001",
			CaptureDate:     time.Now().AddDate(0, 0, -7),
			SatelliteSource: "Sentinel-2",
			NDVIMean:        0.72,
			NDVIMin:         0.65,
			NDVIMax:         0.78,
			NDVIStdDev:      0.04,
			HealthStatus:    "GOOD",
			CloudCoverage:   5.0,
			GrowthStage:     "VEGETATIVE",
			ExpectedNDVI:    0.70,
			NDVIDeviation:   2.86,
			AlertTriggered:  false,
		},
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"ndvi_data": ndviData,
		"total":     len(ndviData),
	})
}

func (s *AgTechService) GetFarmNDVI(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmID := vars["farm_id"]

	ndvi := NDVIData{
		ID:              "NDVI-001",
		FarmID:          farmID,
		CaptureDate:     time.Now().AddDate(0, 0, -3),
		SatelliteSource: "Sentinel-2",
		NDVIMean:        0.72,
		NDVIMin:         0.65,
		NDVIMax:         0.78,
		NDVIStdDev:      0.04,
		HealthStatus:    "GOOD",
		CloudCoverage:   5.0,
		GrowthStage:     "VEGETATIVE",
		ExpectedNDVI:    0.70,
		NDVIDeviation:   2.86,
		AlertTriggered:  false,
	}
	json.NewEncoder(w).Encode(ndvi)
}

func (s *AgTechService) GetNDVIHistory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmID := vars["farm_id"]

	history := []NDVIData{}
	baseDate := time.Now()

	// Generate 12 months of NDVI history
	for i := 0; i < 12; i++ {
		captureDate := baseDate.AddDate(0, -i, 0)
		ndviValue := 0.5 + 0.3*math.Sin(float64(i)*math.Pi/6) // Seasonal variation

		history = append(history, NDVIData{
			ID:              fmt.Sprintf("NDVI-%d", i),
			FarmID:          farmID,
			CaptureDate:     captureDate,
			SatelliteSource: "Sentinel-2",
			NDVIMean:        ndviValue,
			HealthStatus:    s.classifyNDVIHealth(ndviValue),
		})
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"farm_id": farmID,
		"history": history,
		"total":   len(history),
	})
}

func (s *AgTechService) classifyNDVIHealth(ndvi float64) string {
	if ndvi >= 0.7 {
		return "EXCELLENT"
	} else if ndvi >= 0.5 {
		return "GOOD"
	} else if ndvi >= 0.3 {
		return "FAIR"
	} else if ndvi >= 0.1 {
		return "POOR"
	}
	return "CRITICAL"
}

func (s *AgTechService) AnalyzeNDVI(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmID := vars["farm_id"]

	// Simulate NDVI analysis
	analysis := map[string]interface{}{
		"farm_id":          farmID,
		"analysis_date":    time.Now(),
		"satellite_source": "Sentinel-2",
		"current_ndvi":     0.72,
		"expected_ndvi":    0.70,
		"deviation":        2.86,
		"health_status":    "GOOD",
		"growth_stage":     "VEGETATIVE",
		"trend":            "IMPROVING",
		"comparison": map[string]interface{}{
			"vs_last_week":  5.0,
			"vs_last_month": 15.0,
			"vs_last_year":  -2.0,
		},
		"risk_assessment": map[string]interface{}{
			"drought_risk": "LOW",
			"pest_risk":    "LOW",
			"disease_risk": "LOW",
			"flood_risk":   "LOW",
		},
		"recommendations": []string{
			"Continue current irrigation schedule",
			"Monitor for pest activity in next 2 weeks",
			"Consider foliar fertilizer application",
		},
	}
	json.NewEncoder(w).Encode(analysis)
}

func (s *AgTechService) GetNDVIAlerts(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	alerts := []AgTechAlert{
		{
			ID:                "ALERT-001",
			FarmID:            "FARM-002",
			LoanID:            "LOAN-002",
			AlertType:         "NDVI_DROP",
			Severity:          "HIGH",
			Source:            "SATELLITE",
			Description:       "NDVI dropped 25% in the last 2 weeks",
			CurrentValue:      0.45,
			ThresholdValue:    0.60,
			Deviation:         -25.0,
			RecommendedAction: "Schedule immediate agent visit to assess crop health",
			DetectedAt:        time.Now().AddDate(0, 0, -2),
			Status:            "OPEN",
		},
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"alerts":    alerts,
		"total":     len(alerts),
	})
}

// Crop Classification Handlers
func (s *AgTechService) ClassifyCrop(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmID := vars["farm_id"]

	var req struct {
		DeclaredCrop string `json:"declared_crop"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Simulate crop classification
	classification := CropClassification{
		ID:                 fmt.Sprintf("CLASS-%d", time.Now().Unix()),
		FarmID:             farmID,
		ClassificationDate: time.Now(),
		DeclaredCrop:       req.DeclaredCrop,
		DetectedCrop:       req.DeclaredCrop, // In reality, this would come from ML model
		Confidence:         92.5,
		MatchStatus:        "MATCH",
		AlternativeCrops: []CropProbability{
			{CropType: req.DeclaredCrop, Probability: 92.5},
			{CropType: "maize", Probability: 5.0},
			{CropType: "sorghum", Probability: 2.5},
		},
	}
	json.NewEncoder(w).Encode(classification)
}

func (s *AgTechService) GetClassificationHistory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmID := vars["farm_id"]

	history := []CropClassification{
		{
			ID:                 "CLASS-001",
			FarmID:             farmID,
			ClassificationDate: time.Now().AddDate(0, -6, 0),
			DeclaredCrop:       "rice",
			DetectedCrop:       "rice",
			Confidence:         95.0,
			MatchStatus:        "MATCH",
		},
		{
			ID:                 "CLASS-002",
			FarmID:             farmID,
			ClassificationDate: time.Now(),
			DeclaredCrop:       "maize",
			DetectedCrop:       "maize",
			Confidence:         88.0,
			MatchStatus:        "MATCH",
		},
	}
	json.NewEncoder(w).Encode(history)
}

// Yield Estimation Handlers
func (s *AgTechService) EstimateYield(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmID := vars["farm_id"]

	var req struct {
		CropType     string  `json:"crop_type"`
		PlantingDate string  `json:"planting_date"`
		FarmSize     float64 `json:"farm_size"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Get crop data for yield estimation
	cropData, ok := CropDatabase[req.CropType]
	if !ok {
		cropData = CropDatabase["rice"] // Default
	}

	// Simulate yield estimation based on NDVI and historical data
	estimatedYield := cropData.AverageYield * 0.95 // 95% of average

	estimation := YieldEstimation{
		ID:              fmt.Sprintf("YIELD-%d", time.Now().Unix()),
		FarmID:          farmID,
		CropType:        req.CropType,
		EstimationDate:  time.Now(),
		GrowthStage:     "VEGETATIVE",
		DaysToHarvest:   60,
		EstimatedYield:  estimatedYield,
		YieldConfidence: 85.0,
		HistoricalAvg:   cropData.AverageYield,
		YieldVariance:   -5.0,
		RiskFactors:     []string{"Slightly below average rainfall", "Good soil conditions"},
		Methodology:     "HYBRID",
	}
	json.NewEncoder(w).Encode(estimation)
}

func (s *AgTechService) GetLoanYieldEstimate(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	estimation := YieldEstimation{
		ID:              "YIELD-001",
		LoanID:          loanID,
		CropType:        "rice",
		EstimationDate:  time.Now(),
		EstimatedYield:  4.2,
		YieldConfidence: 85.0,
		HistoricalAvg:   4.5,
		YieldVariance:   -6.7,
	}
	json.NewEncoder(w).Encode(estimation)
}

func (s *AgTechService) GetPortfolioYieldEstimates(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	estimates := map[string]interface{}{
		"tenant_id":       tenantID,
		"estimation_date": time.Now(),
		"summary": map[string]interface{}{
			"total_farms":        150,
			"total_hectares":     750.0,
			"avg_yield_estimate": 4.1,
			"avg_confidence":     82.0,
		},
		"by_crop": []map[string]interface{}{
			{"crop": "rice", "farms": 80, "hectares": 400, "avg_yield": 4.2, "confidence": 85},
			{"crop": "maize", "farms": 50, "hectares": 250, "avg_yield": 3.3, "confidence": 80},
			{"crop": "cassava", "farms": 20, "hectares": 100, "avg_yield": 24.0, "confidence": 78},
		},
		"risk_distribution": map[string]int{
			"low":    100,
			"medium": 40,
			"high":   10,
		},
	}
	json.NewEncoder(w).Encode(estimates)
}

// IoT Sensor Handlers
func (s *AgTechService) ListSensors(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	farmID := r.URL.Query().Get("farm_id")

	sensors := []IoTSensor{
		{
			ID:             "SENSOR-001",
			FarmID:         farmID,
			SensorType:     "SOIL_MOISTURE",
			SensorModel:    "SM-100",
			SerialNumber:   "SM100-2024-001",
			Location:       "Field A - Center",
			GPSCoordinates: "12.0025,8.5922",
			Status:         "ACTIVE",
			LastReading:    time.Now().Add(-30 * time.Minute),
			BatteryLevel:   85.0,
			InstallDate:    time.Now().AddDate(0, -6, 0),
		},
		{
			ID:             "SENSOR-002",
			FarmID:         farmID,
			SensorType:     "WEATHER",
			SensorModel:    "WS-200",
			SerialNumber:   "WS200-2024-001",
			Location:       "Farm Entrance",
			GPSCoordinates: "12.0020,8.5920",
			Status:         "ACTIVE",
			LastReading:    time.Now().Add(-15 * time.Minute),
			BatteryLevel:   92.0,
			InstallDate:    time.Now().AddDate(0, -6, 0),
		},
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"farm_id":   farmID,
		"sensors":   sensors,
		"total":     len(sensors),
	})
}

func (s *AgTechService) RegisterSensor(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FarmID         string `json:"farm_id"`
		SensorType     string `json:"sensor_type"`
		SensorModel    string `json:"sensor_model"`
		SerialNumber   string `json:"serial_number"`
		Location       string `json:"location"`
		GPSCoordinates string `json:"gps_coordinates"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	sensor := IoTSensor{
		ID:             fmt.Sprintf("SENSOR-%d", time.Now().Unix()),
		FarmID:         req.FarmID,
		SensorType:     req.SensorType,
		SensorModel:    req.SensorModel,
		SerialNumber:   req.SerialNumber,
		Location:       req.Location,
		GPSCoordinates: req.GPSCoordinates,
		Status:         "ACTIVE",
		BatteryLevel:   100.0,
		InstallDate:    time.Now(),
		CreatedAt:      time.Now(),
	}
	json.NewEncoder(w).Encode(sensor)
}

func (s *AgTechService) GetSensor(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sensorID := vars["sensor_id"]

	sensor := IoTSensor{
		ID:           sensorID,
		SensorType:   "SOIL_MOISTURE",
		SensorModel:  "SM-100",
		Status:       "ACTIVE",
		BatteryLevel: 85.0,
	}
	json.NewEncoder(w).Encode(sensor)
}

func (s *AgTechService) GetSensorReadings(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sensorID := vars["sensor_id"]

	readings := []SensorReading{}
	baseTime := time.Now()

	// Generate 24 hours of readings
	for i := 0; i < 24; i++ {
		readings = append(readings, SensorReading{
			ID:          fmt.Sprintf("READ-%d", i),
			SensorID:    sensorID,
			ReadingType: "SOIL_MOISTURE",
			Value:       35.0 + float64(i%10),
			Unit:        "%",
			Quality:     "GOOD",
			Timestamp:   baseTime.Add(-time.Duration(i) * time.Hour),
		})
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"sensor_id": sensorID,
		"readings":  readings,
		"total":     len(readings),
	})
}

func (s *AgTechService) SubmitSensorReading(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sensorID := vars["sensor_id"]

	var req struct {
		ReadingType string  `json:"reading_type"`
		Value       float64 `json:"value"`
		Unit        string  `json:"unit"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	reading := SensorReading{
		ID:          fmt.Sprintf("READ-%d", time.Now().Unix()),
		SensorID:    sensorID,
		ReadingType: req.ReadingType,
		Value:       req.Value,
		Unit:        req.Unit,
		Quality:     "GOOD",
		Timestamp:   time.Now(),
	}
	json.NewEncoder(w).Encode(reading)
}

// Weather Station Handlers
func (s *AgTechService) ListWeatherStations(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	stations := []map[string]interface{}{
		{
			"station_id":   "WS-001",
			"farm_id":      "FARM-001",
			"location":     "Kano State",
			"status":       "ACTIVE",
			"last_reading": time.Now().Add(-15 * time.Minute),
		},
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"stations":  stations,
	})
}

func (s *AgTechService) GetWeatherStationData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	stationID := vars["station_id"]

	data := WeatherStationData{
		StationID:      stationID,
		FarmID:         "FARM-001",
		Temperature:    32.5,
		Humidity:       65.0,
		Rainfall:       0.0,
		WindSpeed:      12.0,
		WindDirection:  "NE",
		SolarRadiation: 850.0,
		Pressure:       1013.25,
		Timestamp:      time.Now(),
	}
	json.NewEncoder(w).Encode(data)
}

// Soil Analysis Handlers
func (s *AgTechService) GetSoilAnalysis(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmID := vars["farm_id"]

	analysis := SoilAnalysis{
		ID:             "SOIL-001",
		FarmID:         farmID,
		SampleDate:     time.Now().AddDate(0, -1, 0),
		SampleLocation: "Field A - Center",
		GPSCoordinates: "12.0025,8.5922",
		SoilType:       "Loamy",
		pH:             6.5,
		Nitrogen:       45.0,
		Phosphorus:     30.0,
		Potassium:      180.0,
		OrganicMatter:  3.5,
		Moisture:       35.0,
		SoilHealth:     "GOOD",
		Recommendations: []string{
			"Apply nitrogen fertilizer at 50kg/ha",
			"Maintain current pH levels",
			"Consider cover cropping to improve organic matter",
		},
	}
	json.NewEncoder(w).Encode(analysis)
}

func (s *AgTechService) SubmitSoilAnalysis(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmID := vars["farm_id"]

	var req SoilAnalysis
	json.NewDecoder(r.Body).Decode(&req)

	req.ID = fmt.Sprintf("SOIL-%d", time.Now().Unix())
	req.FarmID = farmID
	req.CreatedAt = time.Now()

	// Determine soil health
	req.SoilHealth = s.assessSoilHealth(req)

	json.NewEncoder(w).Encode(req)
}

func (s *AgTechService) assessSoilHealth(analysis SoilAnalysis) string {
	score := 0

	// pH assessment (optimal 6.0-7.0)
	if analysis.pH >= 6.0 && analysis.pH <= 7.0 {
		score += 25
	} else if analysis.pH >= 5.5 && analysis.pH <= 7.5 {
		score += 15
	}

	// Nitrogen assessment
	if analysis.Nitrogen >= 40 {
		score += 25
	} else if analysis.Nitrogen >= 20 {
		score += 15
	}

	// Organic matter assessment
	if analysis.OrganicMatter >= 3.0 {
		score += 25
	} else if analysis.OrganicMatter >= 2.0 {
		score += 15
	}

	// Moisture assessment
	if analysis.Moisture >= 30 && analysis.Moisture <= 50 {
		score += 25
	} else if analysis.Moisture >= 20 && analysis.Moisture <= 60 {
		score += 15
	}

	if score >= 80 {
		return "EXCELLENT"
	} else if score >= 60 {
		return "GOOD"
	} else if score >= 40 {
		return "FAIR"
	}
	return "POOR"
}

// Alert Handlers
func (s *AgTechService) ListAgTechAlerts(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	status := r.URL.Query().Get("status")

	alerts := []AgTechAlert{
		{
			ID:                "ALERT-001",
			FarmID:            "FARM-002",
			LoanID:            "LOAN-002",
			AlertType:         "NDVI_DROP",
			Severity:          "HIGH",
			Source:            "SATELLITE",
			Description:       "NDVI dropped 25% in the last 2 weeks",
			CurrentValue:      0.45,
			ThresholdValue:    0.60,
			Deviation:         -25.0,
			RecommendedAction: "Schedule immediate agent visit",
			DetectedAt:        time.Now().AddDate(0, 0, -2),
			Status:            "OPEN",
		},
		{
			ID:                "ALERT-002",
			FarmID:            "FARM-003",
			LoanID:            "LOAN-003",
			AlertType:         "SOIL_MOISTURE_LOW",
			Severity:          "MEDIUM",
			Source:            "IOT",
			Description:       "Soil moisture below optimal level",
			CurrentValue:      18.0,
			ThresholdValue:    25.0,
			Deviation:         -28.0,
			RecommendedAction: "Advise farmer to increase irrigation",
			DetectedAt:        time.Now().AddDate(0, 0, -1),
			Status:            "ACKNOWLEDGED",
		},
	}

	if status != "" {
		filtered := []AgTechAlert{}
		for _, a := range alerts {
			if a.Status == status {
				filtered = append(filtered, a)
			}
		}
		alerts = filtered
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"alerts":    alerts,
		"total":     len(alerts),
	})
}

func (s *AgTechService) GetAgTechAlert(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	alertID := vars["alert_id"]

	alert := AgTechAlert{
		ID:          alertID,
		AlertType:   "NDVI_DROP",
		Severity:    "HIGH",
		Description: "NDVI dropped 25% in the last 2 weeks",
		Status:      "OPEN",
	}
	json.NewEncoder(w).Encode(alert)
}

func (s *AgTechService) AcknowledgeAlert(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	alertID := vars["alert_id"]

	now := time.Now()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"alert_id":        alertID,
		"status":          "ACKNOWLEDGED",
		"acknowledged_at": now,
	})
}

func (s *AgTechService) ResolveAlert(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	alertID := vars["alert_id"]

	var req struct {
		Resolution string `json:"resolution"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	now := time.Now()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"alert_id":    alertID,
		"status":      "RESOLVED",
		"resolution":  req.Resolution,
		"resolved_at": now,
	})
}

// Farm Verification Handlers
func (s *AgTechService) VerifyFarmSatellite(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmID := vars["farm_id"]

	verification := map[string]interface{}{
		"farm_id":           farmID,
		"verification_date": time.Now(),
		"satellite_source":  "Sentinel-2",
		"area_verification": map[string]interface{}{
			"declared_area":  5.0,
			"satellite_area": 4.8,
			"variance":       -4.0,
			"status":         "VERIFIED",
		},
		"crop_verification": map[string]interface{}{
			"declared_crop": "rice",
			"detected_crop": "rice",
			"confidence":    92.5,
			"status":        "MATCH",
		},
		"health_assessment": map[string]interface{}{
			"ndvi_mean":     0.72,
			"health_status": "GOOD",
			"growth_stage":  "VEGETATIVE",
		},
		"overall_status": "VERIFIED",
		"risk_score":     15.0,
	}
	json.NewEncoder(w).Encode(verification)
}

func (s *AgTechService) VerifyLoanFarms(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	verification := map[string]interface{}{
		"loan_id":           loanID,
		"verification_date": time.Now(),
		"farms_verified":    1,
		"farms_flagged":     0,
		"overall_status":    "VERIFIED",
		"farm_verifications": []map[string]interface{}{
			{
				"farm_id":        "FARM-001",
				"area_status":    "VERIFIED",
				"crop_status":    "MATCH",
				"health_status":  "GOOD",
				"overall_status": "VERIFIED",
			},
		},
	}
	json.NewEncoder(w).Encode(verification)
}
