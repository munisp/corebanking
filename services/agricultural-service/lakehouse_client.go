package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// ==================== LAKEHOUSE CLIENT ====================
// Client for integrating agricultural service with the lakehouse

// LakehouseClient handles communication with the lakehouse API
type LakehouseClient struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

// NewLakehouseClient creates a new lakehouse client
func NewLakehouseClient() *LakehouseClient {
	baseURL := os.Getenv("LAKEHOUSE_API_URL")
	if baseURL == "" {
		baseURL = "http://lakehouse-api:8000"
	}

	return &LakehouseClient{
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		baseURL: baseURL,
		apiKey:  os.Getenv("LAKEHOUSE_API_KEY"),
	}
}

// ==================== Data Ingestion ====================

// IngestRequest represents a request to ingest data into lakehouse
type IngestRequest struct {
	Source string `json:"source"`
	Table  string `json:"table"`
	Layer  string `json:"layer"`
}

// DeltaWriteRequest represents a request to write to Delta Lake
type DeltaWriteRequest struct {
	TableName string                   `json:"table_name"`
	Data      []map[string]interface{} `json:"data"`
	Mode      string                   `json:"mode"`
}

// IngestNDVIData ingests NDVI data into the lakehouse bronze layer
func (c *LakehouseClient) IngestNDVIData(ctx context.Context, ndviRecords []NDVIData) error {
	data := make([]map[string]interface{}, len(ndviRecords))
	for i, record := range ndviRecords {
		data[i] = map[string]interface{}{
			"id":                  record.ID,
			"farm_id":             record.FarmID,
			"polygon_id":          record.PolygonID,
			"capture_date":        record.CaptureDate.Format(time.RFC3339),
			"satellite_source":    record.SatelliteSource,
			"ndvi_mean":           record.NDVIMean,
			"ndvi_min":            record.NDVIMin,
			"ndvi_max":            record.NDVIMax,
			"ndvi_std_dev":        record.NDVIStdDev,
			"health_status":       record.HealthStatus,
			"cloud_coverage":      record.CloudCoverage,
			"growth_stage":        record.GrowthStage,
			"expected_ndvi":       record.ExpectedNDVI,
			"ndvi_deviation":      record.NDVIDeviation,
			"alert_triggered":     record.AlertTriggered,
			"created_at":          record.CreatedAt.Format(time.RFC3339),
			"ingestion_timestamp": time.Now().Format(time.RFC3339),
		}
	}

	return c.writeToDelta(ctx, "bronze.agriculture_ndvi", data, "append")
}

// IngestIoTReadings ingests IoT sensor readings into the lakehouse
func (c *LakehouseClient) IngestIoTReadings(ctx context.Context, readings []SensorReading) error {
	data := make([]map[string]interface{}, len(readings))
	for i, reading := range readings {
		data[i] = map[string]interface{}{
			"id":                  reading.ID,
			"sensor_id":           reading.SensorID,
			"farm_id":             reading.FarmID,
			"reading_type":        reading.ReadingType,
			"value":               reading.Value,
			"unit":                reading.Unit,
			"quality":             reading.Quality,
			"timestamp":           reading.Timestamp.Format(time.RFC3339),
			"alert_triggered":     reading.AlertTriggered,
			"alert_type":          reading.AlertType,
			"ingestion_timestamp": time.Now().Format(time.RFC3339),
		}
	}

	return c.writeToDelta(ctx, "bronze.agriculture_iot_readings", data, "append")
}

// IngestSoilAnalysis ingests soil analysis data into the lakehouse
func (c *LakehouseClient) IngestSoilAnalysis(ctx context.Context, analyses []SoilAnalysis) error {
	data := make([]map[string]interface{}, len(analyses))
	for i, analysis := range analyses {
		data[i] = map[string]interface{}{
			"id":                  analysis.ID,
			"farm_id":             analysis.FarmID,
			"sample_date":         analysis.SampleDate.Format(time.RFC3339),
			"sample_location":     analysis.SampleLocation,
			"gps_coordinates":     analysis.GPSCoordinates,
			"soil_type":           analysis.SoilType,
			"ph":                  analysis.pH,
			"nitrogen":            analysis.Nitrogen,
			"phosphorus":          analysis.Phosphorus,
			"potassium":           analysis.Potassium,
			"organic_matter":      analysis.OrganicMatter,
			"moisture":            analysis.Moisture,
			"soil_health":         analysis.SoilHealth,
			"created_at":          analysis.CreatedAt.Format(time.RFC3339),
			"ingestion_timestamp": time.Now().Format(time.RFC3339),
		}
	}

	return c.writeToDelta(ctx, "bronze.agriculture_soil_analysis", data, "append")
}

// IngestWeatherData ingests weather station data into the lakehouse
func (c *LakehouseClient) IngestWeatherData(ctx context.Context, weatherData []WeatherStationData) error {
	data := make([]map[string]interface{}, len(weatherData))
	for i, weather := range weatherData {
		data[i] = map[string]interface{}{
			"station_id":          weather.StationID,
			"farm_id":             weather.FarmID,
			"temperature":         weather.Temperature,
			"humidity":            weather.Humidity,
			"rainfall":            weather.Rainfall,
			"wind_speed":          weather.WindSpeed,
			"wind_direction":      weather.WindDirection,
			"solar_radiation":     weather.SolarRadiation,
			"pressure":            weather.Pressure,
			"timestamp":           weather.Timestamp.Format(time.RFC3339),
			"ingestion_timestamp": time.Now().Format(time.RFC3339),
		}
	}

	return c.writeToDelta(ctx, "bronze.agriculture_weather", data, "append")
}

// IngestYieldEstimates ingests yield estimation data into the lakehouse
func (c *LakehouseClient) IngestYieldEstimates(ctx context.Context, estimates []YieldEstimation) error {
	data := make([]map[string]interface{}, len(estimates))
	for i, estimate := range estimates {
		data[i] = map[string]interface{}{
			"id":                  estimate.ID,
			"farm_id":             estimate.FarmID,
			"loan_id":             estimate.LoanID,
			"crop_type":           estimate.CropType,
			"estimation_date":     estimate.EstimationDate.Format(time.RFC3339),
			"growth_stage":        estimate.GrowthStage,
			"days_to_harvest":     estimate.DaysToHarvest,
			"estimated_yield":     estimate.EstimatedYield,
			"yield_confidence":    estimate.YieldConfidence,
			"historical_avg":      estimate.HistoricalAvg,
			"yield_variance":      estimate.YieldVariance,
			"methodology":         estimate.Methodology,
			"created_at":          estimate.CreatedAt.Format(time.RFC3339),
			"ingestion_timestamp": time.Now().Format(time.RFC3339),
		}
	}

	return c.writeToDelta(ctx, "bronze.agriculture_yield_estimates", data, "append")
}

// IngestFarmPolygons ingests farm polygon data into the lakehouse
func (c *LakehouseClient) IngestFarmPolygons(ctx context.Context, polygons []FarmPolygon) error {
	data := make([]map[string]interface{}, len(polygons))
	for i, polygon := range polygons {
		// Convert coordinates to WKT
		wktPolygon := coordinatesToWKT(polygon.Coordinates)
		coordsJSON, _ := json.Marshal(polygon.Coordinates)

		data[i] = map[string]interface{}{
			"polygon_id":          polygon.ID,
			"farm_id":             polygon.FarmID,
			"farmer_id":           polygon.FarmerID,
			"tenant_id":           polygon.TenantID,
			"coordinates_json":    string(coordsJSON),
			"wkt_geometry":        wktPolygon,
			"centroid_lng":        polygon.CentroidLng,
			"centroid_lat":        polygon.CentroidLat,
			"declared_area":       polygon.DeclaredArea,
			"satellite_area":      polygon.SatelliteArea,
			"area_variance":       polygon.AreaVariance,
			"verification_status": polygon.VerificationStatus,
			"last_updated":        polygon.LastUpdated.Format(time.RFC3339),
			"created_at":          polygon.CreatedAt.Format(time.RFC3339),
			"ingestion_timestamp": time.Now().Format(time.RFC3339),
		}
	}

	return c.writeToDelta(ctx, "bronze.agriculture_farm_polygons", data, "overwrite")
}

// coordinatesToWKT converts coordinate array to WKT polygon format
func coordinatesToWKT(coords [][]float64) string {
	if len(coords) == 0 {
		return ""
	}

	var wkt string
	for i, coord := range coords {
		if i > 0 {
			wkt += ", "
		}
		wkt += fmt.Sprintf("%f %f", coord[0], coord[1])
	}
	// Close the polygon
	wkt += fmt.Sprintf(", %f %f", coords[0][0], coords[0][1])

	return fmt.Sprintf("POLYGON((%s))", wkt)
}

// writeToDelta writes data to a Delta Lake table
func (c *LakehouseClient) writeToDelta(ctx context.Context, tableName string, data []map[string]interface{}, mode string) error {
	req := DeltaWriteRequest{
		TableName: tableName,
		Data:      data,
		Mode:      mode,
	}

	jsonBody, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		c.baseURL+"/api/v1/delta/write",
		bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("write failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// ==================== Feature Store Integration ====================

// FeatureRequest represents a request to get features from Feast
type FeatureRequest struct {
	FeatureService string                   `json:"feature_service"`
	EntityRows     []map[string]interface{} `json:"entity_rows"`
}

// FeatureResponse represents features returned from Feast
type FeatureResponse struct {
	Status         string                   `json:"status"`
	FeatureService string                   `json:"feature_service"`
	Features       []map[string]interface{} `json:"features"`
}

// GetCropHealthFeatures retrieves crop health monitoring features for a farm
func (c *LakehouseClient) GetCropHealthFeatures(ctx context.Context, farmID string) (map[string]interface{}, error) {
	return c.getFeatures(ctx, "crop_health_monitoring_v1", []map[string]interface{}{
		{"farm_id": farmID},
	})
}

// GetYieldPredictionFeatures retrieves yield prediction features for a farm
func (c *LakehouseClient) GetYieldPredictionFeatures(ctx context.Context, farmID string) (map[string]interface{}, error) {
	return c.getFeatures(ctx, "yield_prediction_v1", []map[string]interface{}{
		{"farm_id": farmID},
	})
}

// GetAgriLoanRiskFeatures retrieves agricultural loan risk features
func (c *LakehouseClient) GetAgriLoanRiskFeatures(ctx context.Context, loanID string) (map[string]interface{}, error) {
	return c.getFeatures(ctx, "agri_loan_risk_v1", []map[string]interface{}{
		{"loan_id": loanID},
	})
}

// GetFarmer360Features retrieves comprehensive farmer profile features
func (c *LakehouseClient) GetFarmer360Features(ctx context.Context, farmerID string) (map[string]interface{}, error) {
	return c.getFeatures(ctx, "farmer_360_v1", []map[string]interface{}{
		{"farmer_id": farmerID},
	})
}

// GetEarlyWarningFeatures retrieves early warning system features
func (c *LakehouseClient) GetEarlyWarningFeatures(ctx context.Context, farmID string) (map[string]interface{}, error) {
	return c.getFeatures(ctx, "early_warning_v1", []map[string]interface{}{
		{"farm_id": farmID},
	})
}

// GetInsuranceRiskFeatures retrieves insurance risk assessment features
func (c *LakehouseClient) GetInsuranceRiskFeatures(ctx context.Context, farmID string) (map[string]interface{}, error) {
	return c.getFeatures(ctx, "insurance_risk_v1", []map[string]interface{}{
		{"farm_id": farmID},
	})
}

// getFeatures retrieves features from the Feast feature store
func (c *LakehouseClient) getFeatures(ctx context.Context, featureService string, entityRows []map[string]interface{}) (map[string]interface{}, error) {
	req := FeatureRequest{
		FeatureService: featureService,
		EntityRows:     entityRows,
	}

	jsonBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		c.baseURL+"/api/v1/features/get",
		bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("feature request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var featureResp FeatureResponse
	if err := json.NewDecoder(resp.Body).Decode(&featureResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(featureResp.Features) > 0 {
		return featureResp.Features[0], nil
	}

	return nil, nil
}

// ==================== Geospatial Queries ====================

// GeospatialQueryRequest represents a geospatial query request
type GeospatialQueryRequest struct {
	QueryType string                 `json:"query_type"`
	Geometry  map[string]interface{} `json:"geometry"`
	Dataset   string                 `json:"dataset"`
	Filters   map[string]interface{} `json:"filters,omitempty"`
}

// GeospatialQueryResponse represents a geospatial query response
type GeospatialQueryResponse struct {
	Status    string                 `json:"status"`
	QueryType string                 `json:"query_type"`
	Results   map[string]interface{} `json:"results"`
}

// PointInPolygonQuery finds which farm polygon contains a given point
func (c *LakehouseClient) PointInPolygonQuery(ctx context.Context, lat, lng float64) (*GeospatialQueryResponse, error) {
	req := GeospatialQueryRequest{
		QueryType: "point_in_polygon",
		Geometry: map[string]interface{}{
			"type":        "Point",
			"coordinates": []float64{lng, lat},
		},
		Dataset: "farm_polygons",
	}

	return c.executeGeospatialQuery(ctx, req)
}

// DistanceQuery finds farms within a given distance
func (c *LakehouseClient) DistanceQuery(ctx context.Context, lat, lng float64, maxDistanceKm float64) (*GeospatialQueryResponse, error) {
	req := GeospatialQueryRequest{
		QueryType: "distance",
		Geometry: map[string]interface{}{
			"type":        "Point",
			"coordinates": []float64{lng, lat},
		},
		Dataset: "farm_polygons",
		Filters: map[string]interface{}{
			"max_distance_km": maxDistanceKm,
		},
	}

	return c.executeGeospatialQuery(ctx, req)
}

// SpatialJoinQuery performs a spatial join between farm polygons and another dataset
func (c *LakehouseClient) SpatialJoinQuery(ctx context.Context, polygonWKT string, targetDataset string) (*GeospatialQueryResponse, error) {
	req := GeospatialQueryRequest{
		QueryType: "spatial_join",
		Geometry: map[string]interface{}{
			"type": "Polygon",
			"wkt":  polygonWKT,
		},
		Dataset: targetDataset,
	}

	return c.executeGeospatialQuery(ctx, req)
}

// executeGeospatialQuery executes a geospatial query against the lakehouse
func (c *LakehouseClient) executeGeospatialQuery(ctx context.Context, req GeospatialQueryRequest) (*GeospatialQueryResponse, error) {
	jsonBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		c.baseURL+"/api/v1/geospatial/query",
		bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("geospatial query failed with status %d: %s", resp.StatusCode, string(body))
	}

	var queryResp GeospatialQueryResponse
	if err := json.NewDecoder(resp.Body).Decode(&queryResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &queryResp, nil
}

// ==================== SQL Queries ====================

// QueryRequest represents a SQL query request
type QueryRequest struct {
	Query  string `json:"query"`
	Engine string `json:"engine"`
	Format string `json:"format"`
}

// QueryResponse represents a SQL query response
type QueryResponse struct {
	Status string                   `json:"status"`
	Engine string                   `json:"engine"`
	Rows   int                      `json:"rows"`
	Data   []map[string]interface{} `json:"data"`
}

// ExecuteQuery executes a SQL query against the lakehouse
func (c *LakehouseClient) ExecuteQuery(ctx context.Context, query string, engine string) (*QueryResponse, error) {
	if engine == "" {
		engine = "clickhouse"
	}

	req := QueryRequest{
		Query:  query,
		Engine: engine,
		Format: "json",
	}

	jsonBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		c.baseURL+"/api/v1/query",
		bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("query failed with status %d: %s", resp.StatusCode, string(body))
	}

	var queryResp QueryResponse
	if err := json.NewDecoder(resp.Body).Decode(&queryResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &queryResp, nil
}

// GetNDVITrends retrieves NDVI trends for a farm from the lakehouse
func (c *LakehouseClient) GetNDVITrends(ctx context.Context, farmID string, days int) (*QueryResponse, error) {
	query := fmt.Sprintf(`
		SELECT 
			farm_id,
			capture_date,
			ndvi_mean,
			ndvi_min,
			ndvi_max,
			health_status,
			cloud_coverage
		FROM silver.agriculture_ndvi
		WHERE farm_id = '%s'
		AND capture_date >= now() - INTERVAL %d DAY
		ORDER BY capture_date DESC
	`, farmID, days)

	return c.ExecuteQuery(ctx, query, "clickhouse")
}

// GetYieldHistory retrieves yield history for a farm from the lakehouse
func (c *LakehouseClient) GetYieldHistory(ctx context.Context, farmID string) (*QueryResponse, error) {
	query := fmt.Sprintf(`
		SELECT 
			farm_id,
			crop_type,
			estimation_date,
			estimated_yield,
			yield_confidence,
			historical_avg,
			yield_variance,
			methodology
		FROM silver.agriculture_yield_estimates
		WHERE farm_id = '%s'
		ORDER BY estimation_date DESC
		LIMIT 50
	`, farmID)

	return c.ExecuteQuery(ctx, query, "clickhouse")
}

// GetRegionalStatistics retrieves regional agricultural statistics
func (c *LakehouseClient) GetRegionalStatistics(ctx context.Context, tenantID string) (*QueryResponse, error) {
	query := fmt.Sprintf(`
		SELECT 
			COUNT(DISTINCT farm_id) as farm_count,
			SUM(declared_area) as total_area_hectares,
			AVG(ndvi_mean) as avg_ndvi,
			COUNT(CASE WHEN health_status = 'EXCELLENT' THEN 1 END) as excellent_count,
			COUNT(CASE WHEN health_status = 'GOOD' THEN 1 END) as good_count,
			COUNT(CASE WHEN health_status = 'FAIR' THEN 1 END) as fair_count,
			COUNT(CASE WHEN health_status = 'POOR' THEN 1 END) as poor_count,
			COUNT(CASE WHEN health_status = 'CRITICAL' THEN 1 END) as critical_count
		FROM gold.agriculture_farm_health
		WHERE tenant_id = '%s'
	`, tenantID)

	return c.ExecuteQuery(ctx, query, "clickhouse")
}

// ==================== Health Check ====================

// HealthCheck checks if the lakehouse API is available
func (c *LakehouseClient) HealthCheck(ctx context.Context) (bool, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/health", nil)
	if err != nil {
		return false, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return false, fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}
