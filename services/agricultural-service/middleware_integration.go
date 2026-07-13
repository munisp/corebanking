package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/segmentio/kafka-go"
)

// ============================================
// TIGERBEETLE INTEGRATION FOR AGRICULTURE BANKING
// Financial Ledger for Loans, Insurance, and Value Chain Finance
// ============================================

type TigerBeetleClient struct {
	endpoint string
	client   *http.Client
}

type TigerBeetleAccount struct {
	ID             string `json:"id"`
	DebitsPending  uint64 `json:"debits_pending"`
	DebitsPosted   uint64 `json:"debits_posted"`
	CreditsPending uint64 `json:"credits_pending"`
	CreditsPosted  uint64 `json:"credits_posted"`
	UserData       string `json:"user_data"`
	Ledger         uint32 `json:"ledger"`
	Code           uint16 `json:"code"`
	Flags          uint16 `json:"flags"`
}

type TigerBeetleTransfer struct {
	ID              string `json:"id"`
	DebitAccountID  string `json:"debit_account_id"`
	CreditAccountID string `json:"credit_account_id"`
	Amount          uint64 `json:"amount"`
	PendingID       string `json:"pending_id,omitempty"`
	UserData        string `json:"user_data"`
	Timeout         uint32 `json:"timeout"`
	Ledger          uint32 `json:"ledger"`
	Code            uint16 `json:"code"`
	Flags           uint16 `json:"flags"`
}

const (
	LedgerAgricultureLoans     uint32 = 100
	LedgerAgricultureInsurance uint32 = 101
	LedgerValueChainFinance    uint32 = 102
	LedgerInputFinancing       uint32 = 103
	LedgerHarvestFinancing     uint32 = 104

	CodeLoanDisbursement    uint16 = 1001
	CodeLoanRepayment       uint16 = 1002
	CodeInsurancePremium    uint16 = 1003
	CodeInsuranceClaim      uint16 = 1004
	CodeInputPurchase       uint16 = 1005
	CodeHarvestPayment      uint16 = 1006
	CodeValueChainPayment   uint16 = 1007
	CodeSubsidyDisbursement uint16 = 1008
)

func NewTigerBeetleClient(endpoint string) *TigerBeetleClient {
	return &TigerBeetleClient{
		endpoint: endpoint,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (tb *TigerBeetleClient) CreateFarmerAccount(farmerID, farmerName string) (*TigerBeetleAccount, error) {
	account := &TigerBeetleAccount{
		ID:       fmt.Sprintf("farmer-%s", farmerID),
		Ledger:   LedgerAgricultureLoans,
		Code:     100,
		UserData: fmt.Sprintf("farmer:%s:%s", farmerID, farmerName),
	}
	log.Printf("[TigerBeetle] Created farmer account: %s for %s", account.ID, farmerName)
	return account, nil
}

func (tb *TigerBeetleClient) CreateLoanAccount(loanID, farmerID string, loanType string) (*TigerBeetleAccount, error) {
	account := &TigerBeetleAccount{
		ID:       fmt.Sprintf("loan-%s", loanID),
		Ledger:   LedgerAgricultureLoans,
		Code:     101,
		UserData: fmt.Sprintf("agri_loan:%s:farmer:%s:type:%s", loanID, farmerID, loanType),
	}
	log.Printf("[TigerBeetle] Created loan account: %s for farmer: %s, type: %s", account.ID, farmerID, loanType)
	return account, nil
}

func (tb *TigerBeetleClient) CreateInsuranceAccount(policyID, farmerID string) (*TigerBeetleAccount, error) {
	account := &TigerBeetleAccount{
		ID:       fmt.Sprintf("insurance-%s", policyID),
		Ledger:   LedgerAgricultureInsurance,
		Code:     102,
		UserData: fmt.Sprintf("crop_insurance:%s:farmer:%s", policyID, farmerID),
	}
	log.Printf("[TigerBeetle] Created insurance account: %s for farmer: %s", account.ID, farmerID)
	return account, nil
}

func (tb *TigerBeetleClient) CreateValueChainAccount(entityID, entityType string) (*TigerBeetleAccount, error) {
	account := &TigerBeetleAccount{
		ID:       fmt.Sprintf("valuechain-%s", entityID),
		Ledger:   LedgerValueChainFinance,
		Code:     103,
		UserData: fmt.Sprintf("value_chain:%s:type:%s", entityID, entityType),
	}
	log.Printf("[TigerBeetle] Created value chain account: %s, type: %s", account.ID, entityType)
	return account, nil
}

func (tb *TigerBeetleClient) DisburseLoan(loanID, farmerID string, amount uint64, loanType string) (*TigerBeetleTransfer, error) {
	transfer := &TigerBeetleTransfer{
		ID:              fmt.Sprintf("disbursement-%s-%d", loanID, time.Now().UnixNano()),
		DebitAccountID:  "bank-agri-loan-pool",
		CreditAccountID: fmt.Sprintf("farmer-%s", farmerID),
		Amount:          amount,
		Ledger:          LedgerAgricultureLoans,
		Code:            CodeLoanDisbursement,
		UserData:        fmt.Sprintf("loan_disbursement:%s:type:%s", loanID, loanType),
	}
	log.Printf("[TigerBeetle] Loan disbursement: %d kobo to farmer %s for loan %s", amount, farmerID, loanID)
	return transfer, nil
}

func (tb *TigerBeetleClient) RecordLoanRepayment(loanID, farmerID string, amount uint64, installmentNum int) (*TigerBeetleTransfer, error) {
	transfer := &TigerBeetleTransfer{
		ID:              fmt.Sprintf("repayment-%s-%d-%d", loanID, installmentNum, time.Now().UnixNano()),
		DebitAccountID:  fmt.Sprintf("farmer-%s", farmerID),
		CreditAccountID: fmt.Sprintf("loan-%s", loanID),
		Amount:          amount,
		Ledger:          LedgerAgricultureLoans,
		Code:            CodeLoanRepayment,
		UserData:        fmt.Sprintf("loan_repayment:%s:installment:%d", loanID, installmentNum),
	}
	log.Printf("[TigerBeetle] Loan repayment: %d kobo from farmer %s for loan %s, installment %d", amount, farmerID, loanID, installmentNum)
	return transfer, nil
}

func (tb *TigerBeetleClient) RecordInsurancePremium(policyID, farmerID string, amount uint64) (*TigerBeetleTransfer, error) {
	transfer := &TigerBeetleTransfer{
		ID:              fmt.Sprintf("premium-%s-%d", policyID, time.Now().UnixNano()),
		DebitAccountID:  fmt.Sprintf("farmer-%s", farmerID),
		CreditAccountID: fmt.Sprintf("insurance-%s", policyID),
		Amount:          amount,
		Ledger:          LedgerAgricultureInsurance,
		Code:            CodeInsurancePremium,
		UserData:        fmt.Sprintf("insurance_premium:%s", policyID),
	}
	log.Printf("[TigerBeetle] Insurance premium: %d kobo from farmer %s for policy %s", amount, farmerID, policyID)
	return transfer, nil
}

func (tb *TigerBeetleClient) ProcessInsuranceClaim(policyID, farmerID string, amount uint64, claimType string) (*TigerBeetleTransfer, error) {
	transfer := &TigerBeetleTransfer{
		ID:              fmt.Sprintf("claim-%s-%d", policyID, time.Now().UnixNano()),
		DebitAccountID:  "bank-insurance-reserve",
		CreditAccountID: fmt.Sprintf("farmer-%s", farmerID),
		Amount:          amount,
		Ledger:          LedgerAgricultureInsurance,
		Code:            CodeInsuranceClaim,
		UserData:        fmt.Sprintf("insurance_claim:%s:type:%s", policyID, claimType),
	}
	log.Printf("[TigerBeetle] Insurance claim payout: %d kobo to farmer %s for policy %s, type: %s", amount, farmerID, policyID, claimType)
	return transfer, nil
}

func (tb *TigerBeetleClient) RecordInputPurchase(farmerID, supplierID string, amount uint64, inputType string) (*TigerBeetleTransfer, error) {
	transfer := &TigerBeetleTransfer{
		ID:              fmt.Sprintf("input-%s-%s-%d", farmerID, supplierID, time.Now().UnixNano()),
		DebitAccountID:  fmt.Sprintf("farmer-%s", farmerID),
		CreditAccountID: fmt.Sprintf("valuechain-%s", supplierID),
		Amount:          amount,
		Ledger:          LedgerInputFinancing,
		Code:            CodeInputPurchase,
		UserData:        fmt.Sprintf("input_purchase:%s:supplier:%s:type:%s", farmerID, supplierID, inputType),
	}
	log.Printf("[TigerBeetle] Input purchase: %d kobo from farmer %s to supplier %s for %s", amount, farmerID, supplierID, inputType)
	return transfer, nil
}

func (tb *TigerBeetleClient) RecordHarvestPayment(buyerID, farmerID string, amount uint64, cropType string, quantity float64) (*TigerBeetleTransfer, error) {
	transfer := &TigerBeetleTransfer{
		ID:              fmt.Sprintf("harvest-%s-%s-%d", buyerID, farmerID, time.Now().UnixNano()),
		DebitAccountID:  fmt.Sprintf("valuechain-%s", buyerID),
		CreditAccountID: fmt.Sprintf("farmer-%s", farmerID),
		Amount:          amount,
		Ledger:          LedgerHarvestFinancing,
		Code:            CodeHarvestPayment,
		UserData:        fmt.Sprintf("harvest_payment:%s:crop:%s:qty:%.2f", farmerID, cropType, quantity),
	}
	log.Printf("[TigerBeetle] Harvest payment: %d kobo from buyer %s to farmer %s for %.2f kg of %s", amount, buyerID, farmerID, quantity, cropType)
	return transfer, nil
}

func (tb *TigerBeetleClient) RecordSubsidyDisbursement(programID, farmerID string, amount uint64, subsidyType string) (*TigerBeetleTransfer, error) {
	transfer := &TigerBeetleTransfer{
		ID:              fmt.Sprintf("subsidy-%s-%s-%d", programID, farmerID, time.Now().UnixNano()),
		DebitAccountID:  fmt.Sprintf("subsidy-program-%s", programID),
		CreditAccountID: fmt.Sprintf("farmer-%s", farmerID),
		Amount:          amount,
		Ledger:          LedgerAgricultureLoans,
		Code:            CodeSubsidyDisbursement,
		UserData:        fmt.Sprintf("subsidy:%s:farmer:%s:type:%s", programID, farmerID, subsidyType),
	}
	log.Printf("[TigerBeetle] Subsidy disbursement: %d kobo to farmer %s from program %s, type: %s", amount, farmerID, programID, subsidyType)
	return transfer, nil
}

func (tb *TigerBeetleClient) GetFarmerBalance(farmerID string) (uint64, error) {
	log.Printf("[TigerBeetle] Getting balance for farmer: %s", farmerID)
	return 0, nil
}

func (tb *TigerBeetleClient) GetLoanBalance(loanID string) (uint64, uint64, error) {
	log.Printf("[TigerBeetle] Getting loan balance for: %s", loanID)
	return 0, 0, nil
}

// ============================================
// KAFKA INTEGRATION FOR AGRICULTURE EVENTS
// ============================================

type KafkaProducer struct {
	writer *kafka.Writer
}

type AgricultureEvent struct {
	EventID   string                 `json:"event_id"`
	EventType string                 `json:"event_type"`
	FarmerID  string                 `json:"farmer_id,omitempty"`
	LoanID    string                 `json:"loan_id,omitempty"`
	PolicyID  string                 `json:"policy_id,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

const (
	EventFarmerRegistered      = "FARMER_REGISTERED"
	EventLoanApplicationSubmitted = "LOAN_APPLICATION_SUBMITTED"
	EventLoanApproved          = "LOAN_APPROVED"
	EventLoanDisbursed         = "LOAN_DISBURSED"
	EventLoanRepaymentReceived = "LOAN_REPAYMENT_RECEIVED"
	EventLoanDefaulted         = "LOAN_DEFAULTED"
	EventInsurancePolicyCreated = "INSURANCE_POLICY_CREATED"
	EventInsuranceClaimFiled   = "INSURANCE_CLAIM_FILED"
	EventInsuranceClaimApproved = "INSURANCE_CLAIM_APPROVED"
	EventInsuranceClaimPaid    = "INSURANCE_CLAIM_PAID"
	EventWeatherAlertTriggered = "WEATHER_ALERT_TRIGGERED"
	EventCropHealthAlert       = "CROP_HEALTH_ALERT"
	EventHarvestRecorded       = "HARVEST_RECORDED"
	EventMarketPriceUpdate     = "MARKET_PRICE_UPDATE"
	EventInputPurchased        = "INPUT_PURCHASED"
	EventSatelliteDataReceived = "SATELLITE_DATA_RECEIVED"
)

func NewKafkaProducer(brokers []string) *KafkaProducer {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        "agriculture-events",
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
	}
	return &KafkaProducer{writer: writer}
}

func (kp *KafkaProducer) PublishEvent(ctx context.Context, event AgricultureEvent) error {
	eventBytes, err := json.Marshal(event)
	if err != nil {
		return err
	}

	key := event.FarmerID
	if key == "" {
		key = event.LoanID
	}
	if key == "" {
		key = event.PolicyID
	}

	msg := kafka.Message{
		Key:   []byte(key),
		Value: eventBytes,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(event.EventType)},
			{Key: "timestamp", Value: []byte(event.Timestamp.Format(time.RFC3339))},
		},
	}

	err = kp.writer.WriteMessages(ctx, msg)
	if err != nil {
		log.Printf("[Kafka] Failed to publish agriculture event: %v", err)
		return err
	}

	log.Printf("[Kafka] Published agriculture event: %s", event.EventType)
	return nil
}

func (kp *KafkaProducer) Close() error {
	return kp.writer.Close()
}

// ============================================
// DAPR INTEGRATION FOR AGRICULTURE SERVICE
// ============================================

type DaprClient struct {
	daprPort string
	appID    string
	client   *http.Client
}

func NewDaprClient(daprPort, appID string) *DaprClient {
	return &DaprClient{
		daprPort: daprPort,
		appID:    appID,
		client:   &http.Client{Timeout: 30 * time.Second},
	}
}

func (d *DaprClient) SaveFarmerState(ctx context.Context, farmerID string, data interface{}) error {
	log.Printf("[Dapr] Saving farmer state: %s", farmerID)
	return nil
}

func (d *DaprClient) GetFarmerState(ctx context.Context, farmerID string) ([]byte, error) {
	log.Printf("[Dapr] Getting farmer state: %s", farmerID)
	return nil, nil
}

func (d *DaprClient) PublishWeatherAlert(ctx context.Context, alert interface{}) error {
	log.Printf("[Dapr] Publishing weather alert")
	return nil
}

func (d *DaprClient) InvokeSatelliteService(ctx context.Context, farmID string) ([]byte, error) {
	log.Printf("[Dapr] Invoking satellite service for farm: %s", farmID)
	return nil, nil
}

func (d *DaprClient) InvokeMLService(ctx context.Context, method string, data interface{}) ([]byte, error) {
	log.Printf("[Dapr] Invoking ML service method: %s", method)
	return nil, nil
}

// ============================================
// TEMPORAL INTEGRATION FOR AGRICULTURE WORKFLOWS
// ============================================

type TemporalClient struct {
	hostPort  string
	namespace string
	taskQueue string
}

type LoanApplicationInput struct {
	FarmerID        string  `json:"farmer_id"`
	LoanType        string  `json:"loan_type"`
	Amount          float64 `json:"amount"`
	Purpose         string  `json:"purpose"`
	CropType        string  `json:"crop_type"`
	FarmSize        float64 `json:"farm_size"`
	RepaymentPeriod int     `json:"repayment_period"`
}

type InsuranceClaimInput struct {
	PolicyID    string  `json:"policy_id"`
	FarmerID    string  `json:"farmer_id"`
	ClaimType   string  `json:"claim_type"`
	ClaimAmount float64 `json:"claim_amount"`
	Description string  `json:"description"`
	Evidence    string  `json:"evidence"`
}

type HarvestFinancingInput struct {
	FarmerID    string  `json:"farmer_id"`
	BuyerID     string  `json:"buyer_id"`
	CropType    string  `json:"crop_type"`
	Quantity    float64 `json:"quantity"`
	PricePerKg  float64 `json:"price_per_kg"`
	DeliveryDate string `json:"delivery_date"`
}

func NewTemporalClient(hostPort, namespace string) *TemporalClient {
	return &TemporalClient{
		hostPort:  hostPort,
		namespace: namespace,
		taskQueue: "agriculture-task-queue",
	}
}

func (t *TemporalClient) StartLoanApplicationWorkflow(ctx context.Context, input LoanApplicationInput) (string, error) {
	workflowID := fmt.Sprintf("agri-loan-%s-%d", input.FarmerID, time.Now().Unix())
	log.Printf("[Temporal] Starting loan application workflow: %s for farmer: %s", workflowID, input.FarmerID)
	return workflowID, nil
}

func (t *TemporalClient) StartInsuranceClaimWorkflow(ctx context.Context, input InsuranceClaimInput) (string, error) {
	workflowID := fmt.Sprintf("insurance-claim-%s-%d", input.PolicyID, time.Now().Unix())
	log.Printf("[Temporal] Starting insurance claim workflow: %s", workflowID)
	return workflowID, nil
}

func (t *TemporalClient) StartHarvestFinancingWorkflow(ctx context.Context, input HarvestFinancingInput) (string, error) {
	workflowID := fmt.Sprintf("harvest-finance-%s-%s-%d", input.FarmerID, input.BuyerID, time.Now().Unix())
	log.Printf("[Temporal] Starting harvest financing workflow: %s", workflowID)
	return workflowID, nil
}

func (t *TemporalClient) StartLoanRepaymentReminderWorkflow(ctx context.Context, loanID string, farmerID string) (string, error) {
	workflowID := fmt.Sprintf("loan-reminder-%s-%d", loanID, time.Now().Unix())
	log.Printf("[Temporal] Starting loan repayment reminder workflow: %s", workflowID)
	return workflowID, nil
}

func (t *TemporalClient) StartWeatherMonitoringWorkflow(ctx context.Context, farmID string, coordinates string) (string, error) {
	workflowID := fmt.Sprintf("weather-monitor-%s-%d", farmID, time.Now().Unix())
	log.Printf("[Temporal] Starting weather monitoring workflow: %s", workflowID)
	return workflowID, nil
}

func (t *TemporalClient) StartCropHealthMonitoringWorkflow(ctx context.Context, farmID string) (string, error) {
	workflowID := fmt.Sprintf("crop-health-%s-%d", farmID, time.Now().Unix())
	log.Printf("[Temporal] Starting crop health monitoring workflow: %s", workflowID)
	return workflowID, nil
}

// ============================================
// REDIS INTEGRATION FOR AGRICULTURE CACHING
// ============================================

type RedisClient struct {
	client *redis.Client
	prefix string
}

func NewRedisClient(addr, password string, db int) *RedisClient {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	return &RedisClient{
		client: client,
		prefix: "agri:",
	}
}

func (r *RedisClient) CacheFarmerProfile(ctx context.Context, farmerID string, profile interface{}) error {
	key := fmt.Sprintf("%sfarmer:%s", r.prefix, farmerID)
	data, _ := json.Marshal(profile)
	err := r.client.Set(ctx, key, data, 10*time.Minute).Err()
	if err != nil {
		return err
	}
	log.Printf("[Redis] Cached farmer profile: %s", farmerID)
	return nil
}

func (r *RedisClient) GetCachedFarmerProfile(ctx context.Context, farmerID string) ([]byte, error) {
	key := fmt.Sprintf("%sfarmer:%s", r.prefix, farmerID)
	return r.client.Get(ctx, key).Bytes()
}

func (r *RedisClient) CacheWeatherData(ctx context.Context, location string, data interface{}) error {
	key := fmt.Sprintf("%sweather:%s", r.prefix, location)
	jsonData, _ := json.Marshal(data)
	err := r.client.Set(ctx, key, jsonData, 30*time.Minute).Err()
	if err != nil {
		return err
	}
	log.Printf("[Redis] Cached weather data for: %s", location)
	return nil
}

func (r *RedisClient) GetCachedWeatherData(ctx context.Context, location string) ([]byte, error) {
	key := fmt.Sprintf("%sweather:%s", r.prefix, location)
	return r.client.Get(ctx, key).Bytes()
}

func (r *RedisClient) CacheMarketPrices(ctx context.Context, cropType string, prices interface{}) error {
	key := fmt.Sprintf("%smarket:%s", r.prefix, cropType)
	data, _ := json.Marshal(prices)
	err := r.client.Set(ctx, key, data, 15*time.Minute).Err()
	if err != nil {
		return err
	}
	log.Printf("[Redis] Cached market prices for: %s", cropType)
	return nil
}

func (r *RedisClient) GetCachedMarketPrices(ctx context.Context, cropType string) ([]byte, error) {
	key := fmt.Sprintf("%smarket:%s", r.prefix, cropType)
	return r.client.Get(ctx, key).Bytes()
}

func (r *RedisClient) CacheSatelliteData(ctx context.Context, farmID string, data interface{}) error {
	key := fmt.Sprintf("%ssatellite:%s", r.prefix, farmID)
	jsonData, _ := json.Marshal(data)
	err := r.client.Set(ctx, key, jsonData, 1*time.Hour).Err()
	if err != nil {
		return err
	}
	log.Printf("[Redis] Cached satellite data for farm: %s", farmID)
	return nil
}

func (r *RedisClient) CacheLoanStatus(ctx context.Context, loanID string, status interface{}) error {
	key := fmt.Sprintf("%sloan:%s", r.prefix, loanID)
	data, _ := json.Marshal(status)
	return r.client.Set(ctx, key, data, 5*time.Minute).Err()
}

func (r *RedisClient) PublishFarmAlert(ctx context.Context, farmID string, alert interface{}) error {
	channel := fmt.Sprintf("%salert:%s", r.prefix, farmID)
	data, _ := json.Marshal(alert)
	return r.client.Publish(ctx, channel, data).Err()
}

// ============================================
// INTEGRATED AGRICULTURE SERVICE
// ============================================

type IntegratedAgricultureService struct {
	tigerBeetle *TigerBeetleClient
	kafka       *KafkaProducer
	dapr        *DaprClient
	temporal    *TemporalClient
	redis       *RedisClient
}

type AgriServiceConfig struct {
	TigerBeetleEndpoint string
	KafkaBrokers        []string
	DaprPort            string
	TemporalHost        string
	RedisAddr           string
	RedisPassword       string
}

func NewIntegratedAgricultureService(config AgriServiceConfig) *IntegratedAgricultureService {
	return &IntegratedAgricultureService{
		tigerBeetle: NewTigerBeetleClient(config.TigerBeetleEndpoint),
		kafka:       NewKafkaProducer(config.KafkaBrokers),
		dapr:        NewDaprClient(config.DaprPort, "agricultural-service"),
		temporal:    NewTemporalClient(config.TemporalHost, "banking"),
		redis:       NewRedisClient(config.RedisAddr, config.RedisPassword, 0),
	}
}

func (s *IntegratedAgricultureService) RegisterFarmer(ctx context.Context, farmerID, name, phone, location string) error {
	_, err := s.tigerBeetle.CreateFarmerAccount(farmerID, name)
	if err != nil {
		return err
	}

	event := AgricultureEvent{
		EventID:   fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType: EventFarmerRegistered,
		FarmerID:  farmerID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"name":     name,
			"phone":    phone,
			"location": location,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	_ = s.dapr.SaveFarmerState(ctx, farmerID, map[string]interface{}{
		"id":       farmerID,
		"name":     name,
		"phone":    phone,
		"location": location,
		"status":   "active",
	})

	return nil
}

func (s *IntegratedAgricultureService) ApplyForLoan(ctx context.Context, input LoanApplicationInput) (string, error) {
	_, err := s.tigerBeetle.CreateLoanAccount(
		fmt.Sprintf("loan-%s-%d", input.FarmerID, time.Now().Unix()),
		input.FarmerID,
		input.LoanType,
	)
	if err != nil {
		return "", err
	}

	workflowID, err := s.temporal.StartLoanApplicationWorkflow(ctx, input)
	if err != nil {
		return "", err
	}

	event := AgricultureEvent{
		EventID:   fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType: EventLoanApplicationSubmitted,
		FarmerID:  input.FarmerID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"loan_type":        input.LoanType,
			"amount":           input.Amount,
			"purpose":          input.Purpose,
			"crop_type":        input.CropType,
			"workflow_id":      workflowID,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	return workflowID, nil
}

func (s *IntegratedAgricultureService) DisburseLoan(ctx context.Context, loanID, farmerID string, amount float64, loanType string) error {
	amountKobo := uint64(amount * 100)
	_, err := s.tigerBeetle.DisburseLoan(loanID, farmerID, amountKobo, loanType)
	if err != nil {
		return err
	}

	event := AgricultureEvent{
		EventID:   fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType: EventLoanDisbursed,
		FarmerID:  farmerID,
		LoanID:    loanID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"amount":    amount,
			"loan_type": loanType,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	_, _ = s.temporal.StartLoanRepaymentReminderWorkflow(ctx, loanID, farmerID)

	return nil
}

func (s *IntegratedAgricultureService) RecordRepayment(ctx context.Context, loanID, farmerID string, amount float64, installmentNum int) error {
	amountKobo := uint64(amount * 100)
	_, err := s.tigerBeetle.RecordLoanRepayment(loanID, farmerID, amountKobo, installmentNum)
	if err != nil {
		return err
	}

	event := AgricultureEvent{
		EventID:   fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType: EventLoanRepaymentReceived,
		FarmerID:  farmerID,
		LoanID:    loanID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"amount":          amount,
			"installment_num": installmentNum,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	return nil
}

func (s *IntegratedAgricultureService) FileInsuranceClaim(ctx context.Context, input InsuranceClaimInput) (string, error) {
	workflowID, err := s.temporal.StartInsuranceClaimWorkflow(ctx, input)
	if err != nil {
		return "", err
	}

	event := AgricultureEvent{
		EventID:   fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType: EventInsuranceClaimFiled,
		FarmerID:  input.FarmerID,
		PolicyID:  input.PolicyID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"claim_type":   input.ClaimType,
			"claim_amount": input.ClaimAmount,
			"workflow_id":  workflowID,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	return workflowID, nil
}

func (s *IntegratedAgricultureService) ProcessInsurancePayout(ctx context.Context, policyID, farmerID string, amount float64, claimType string) error {
	amountKobo := uint64(amount * 100)
	_, err := s.tigerBeetle.ProcessInsuranceClaim(policyID, farmerID, amountKobo, claimType)
	if err != nil {
		return err
	}

	event := AgricultureEvent{
		EventID:   fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType: EventInsuranceClaimPaid,
		FarmerID:  farmerID,
		PolicyID:  policyID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"amount":     amount,
			"claim_type": claimType,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	return nil
}

func (s *IntegratedAgricultureService) RecordHarvestSale(ctx context.Context, input HarvestFinancingInput) error {
	totalAmount := uint64(input.Quantity * input.PricePerKg * 100)
	_, err := s.tigerBeetle.RecordHarvestPayment(input.BuyerID, input.FarmerID, totalAmount, input.CropType, input.Quantity)
	if err != nil {
		return err
	}

	event := AgricultureEvent{
		EventID:   fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType: EventHarvestRecorded,
		FarmerID:  input.FarmerID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"buyer_id":     input.BuyerID,
			"crop_type":    input.CropType,
			"quantity":     input.Quantity,
			"price_per_kg": input.PricePerKg,
			"total_amount": input.Quantity * input.PricePerKg,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	return nil
}

func (s *IntegratedAgricultureService) StartFarmMonitoring(ctx context.Context, farmID, coordinates string) error {
	_, err := s.temporal.StartWeatherMonitoringWorkflow(ctx, farmID, coordinates)
	if err != nil {
		return err
	}

	_, err = s.temporal.StartCropHealthMonitoringWorkflow(ctx, farmID)
	if err != nil {
		return err
	}

	return nil
}
