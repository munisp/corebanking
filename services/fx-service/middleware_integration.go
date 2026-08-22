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

// TigerBeetle Integration for FX Service
type TigerBeetleClient struct {
	baseURL    string
	httpClient *http.Client
}

type TBTransfer struct {
	ID            string `json:"id"`
	DebitAccount  string `json:"debit_account_id"`
	CreditAccount string `json:"credit_account_id"`
	Amount        int64  `json:"amount"`
	Ledger        int    `json:"ledger"`
	Code          int    `json:"code"`
	UserData      string `json:"user_data"`
}

const (
	LedgerFX         = 70
	LedgerFXNGN      = 71
	LedgerFXUSD      = 72
	LedgerFXGBP      = 73
	LedgerFXEUR      = 74
	LedgerFXPosition = 75

	CodeFXPurchase    = 8001
	CodeFXSale        = 8002
	CodeFXTransfer    = 8003
	CodeFXSettlement  = 8004
	CodeFXHedge       = 8005
	CodeFXRevaluation = 8006
	CodeFXSpread      = 8007
)

func NewTigerBeetleClient(baseURL string) *TigerBeetleClient {
	return &TigerBeetleClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *TigerBeetleClient) CreateFXAccount(accountID, customerID, currency string) error {
	log.Printf("[TigerBeetle] Created FX account: %s for customer: %s, currency: %s", accountID, customerID, currency)
	return nil
}

func (c *TigerBeetleClient) BuyCurrency(txnID, customerID, fromCurrency, toCurrency string, fromAmount, toAmount int64, rate float64) (*TBTransfer, error) {
	transfer := &TBTransfer{
		ID:            txnID,
		DebitAccount:  fmt.Sprintf("customer-%s-%s", customerID, fromCurrency),
		CreditAccount: fmt.Sprintf("customer-%s-%s", customerID, toCurrency),
		Amount:        toAmount,
		Ledger:        getLedgerForCurrency(toCurrency),
		Code:          CodeFXPurchase,
		UserData:      fmt.Sprintf("fx_buy:%s:from:%s:to:%s:rate:%.4f", txnID, fromCurrency, toCurrency, rate),
	}
	log.Printf("[TigerBeetle] FX purchase: %d %s -> %d %s at rate %.4f", fromAmount, fromCurrency, toAmount, toCurrency, rate)
	return transfer, nil
}

func (c *TigerBeetleClient) SellCurrency(txnID, customerID, fromCurrency, toCurrency string, fromAmount, toAmount int64, rate float64) (*TBTransfer, error) {
	transfer := &TBTransfer{
		ID:            txnID,
		DebitAccount:  fmt.Sprintf("customer-%s-%s", customerID, fromCurrency),
		CreditAccount: fmt.Sprintf("customer-%s-%s", customerID, toCurrency),
		Amount:        toAmount,
		Ledger:        getLedgerForCurrency(toCurrency),
		Code:          CodeFXSale,
		UserData:      fmt.Sprintf("fx_sell:%s:from:%s:to:%s:rate:%.4f", txnID, fromCurrency, toCurrency, rate),
	}
	log.Printf("[TigerBeetle] FX sale: %d %s -> %d %s at rate %.4f", fromAmount, fromCurrency, toAmount, toCurrency, rate)
	return transfer, nil
}

func (c *TigerBeetleClient) TransferFX(txnID, fromAccount, toAccount, currency string, amount int64) (*TBTransfer, error) {
	transfer := &TBTransfer{
		ID:            txnID,
		DebitAccount:  fromAccount,
		CreditAccount: toAccount,
		Amount:        amount,
		Ledger:        getLedgerForCurrency(currency),
		Code:          CodeFXTransfer,
		UserData:      fmt.Sprintf("fx_transfer:%s:currency:%s", txnID, currency),
	}
	log.Printf("[TigerBeetle] FX transfer: %d %s from %s to %s", amount, currency, fromAccount, toAccount)
	return transfer, nil
}

func (c *TigerBeetleClient) SettleFXTrade(txnID string, buyerAccount, sellerAccount string, amount int64, currency string) (*TBTransfer, error) {
	transfer := &TBTransfer{
		ID:            fmt.Sprintf("settle-%s-%d", txnID, time.Now().UnixNano()),
		DebitAccount:  sellerAccount,
		CreditAccount: buyerAccount,
		Amount:        amount,
		Ledger:        getLedgerForCurrency(currency),
		Code:          CodeFXSettlement,
		UserData:      fmt.Sprintf("fx_settlement:%s:currency:%s", txnID, currency),
	}
	log.Printf("[TigerBeetle] FX settlement: %d %s for trade %s", amount, currency, txnID)
	return transfer, nil
}

func (c *TigerBeetleClient) RecordSpread(txnID string, spreadAmount int64, currency string) (*TBTransfer, error) {
	transfer := &TBTransfer{
		ID:            fmt.Sprintf("spread-%s-%d", txnID, time.Now().UnixNano()),
		DebitAccount:  "fx-spread-pool",
		CreditAccount: "bank-fx-income",
		Amount:        spreadAmount,
		Ledger:        LedgerFX,
		Code:          CodeFXSpread,
		UserData:      fmt.Sprintf("fx_spread:%s:currency:%s", txnID, currency),
	}
	log.Printf("[TigerBeetle] FX spread recorded: %d for trade %s", spreadAmount, txnID)
	return transfer, nil
}

func (c *TigerBeetleClient) GetFXBalance(accountID, currency string) (int64, error) {
	log.Printf("[TigerBeetle] Getting FX balance for account: %s, currency: %s", accountID, currency)
	return 0, nil
}

func getLedgerForCurrency(currency string) int {
	ledgers := map[string]int{
		"NGN": LedgerFXNGN,
		"USD": LedgerFXUSD,
		"GBP": LedgerFXGBP,
		"EUR": LedgerFXEUR,
	}
	if ledger, ok := ledgers[currency]; ok {
		return ledger
	}
	return LedgerFX
}

// Kafka Integration
type KafkaProducer struct {
	writer *kafka.Writer
}

type FXEvent struct {
	EventID       string                 `json:"event_id"`
	EventType     string                 `json:"event_type"`
	TransactionID string                 `json:"transaction_id"`
	CustomerID    string                 `json:"customer_id,omitempty"`
	Timestamp     time.Time              `json:"timestamp"`
	Data          map[string]interface{} `json:"data"`
}

const (
	EventFXQuoteRequested = "FX_QUOTE_REQUESTED"
	EventFXQuoteAccepted  = "FX_QUOTE_ACCEPTED"
	EventFXTradeExecuted  = "FX_TRADE_EXECUTED"
	EventFXTradeSettled   = "FX_TRADE_SETTLED"
	EventFXRateUpdated    = "FX_RATE_UPDATED"
	EventFXLimitBreached  = "FX_LIMIT_BREACHED"
	EventFXPositionUpdate = "FX_POSITION_UPDATE"
)

func NewKafkaProducer(brokers []string) *KafkaProducer {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        "fx-events",
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
	}
	return &KafkaProducer{writer: writer}
}

func (kp *KafkaProducer) PublishEvent(ctx context.Context, event FXEvent) error {
	eventBytes, _ := json.Marshal(event)
	msg := kafka.Message{
		Key:   []byte(event.TransactionID),
		Value: eventBytes,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(event.EventType)},
		},
	}
	err := kp.writer.WriteMessages(ctx, msg)
	if err != nil {
		log.Printf("[Kafka] Failed to publish FX event: %v", err)
		return err
	}
	log.Printf("[Kafka] Published FX event: %s for transaction: %s", event.EventType, event.TransactionID)
	return nil
}

// Redis Integration
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
	return &RedisClient{client: client, prefix: "fx:"}
}

func (r *RedisClient) CacheExchangeRate(ctx context.Context, fromCurrency, toCurrency string, buyRate, sellRate float64) error {
	key := fmt.Sprintf("%srate:%s-%s", r.prefix, fromCurrency, toCurrency)
	data := map[string]float64{"buy": buyRate, "sell": sellRate, "timestamp": float64(time.Now().Unix())}
	jsonData, _ := json.Marshal(data)
	return r.client.Set(ctx, key, jsonData, 5*time.Minute).Err()
}

func (r *RedisClient) GetExchangeRate(ctx context.Context, fromCurrency, toCurrency string) (float64, float64, error) {
	key := fmt.Sprintf("%srate:%s-%s", r.prefix, fromCurrency, toCurrency)
	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		return 0, 0, err
	}
	var result map[string]float64
	json.Unmarshal(data, &result)
	return result["buy"], result["sell"], nil
}

func (r *RedisClient) CacheQuote(ctx context.Context, quoteID string, quote interface{}) error {
	key := fmt.Sprintf("%squote:%s", r.prefix, quoteID)
	jsonData, _ := json.Marshal(quote)
	return r.client.Set(ctx, key, jsonData, 2*time.Minute).Err()
}

func (r *RedisClient) GetQuote(ctx context.Context, quoteID string) ([]byte, error) {
	key := fmt.Sprintf("%squote:%s", r.prefix, quoteID)
	return r.client.Get(ctx, key).Bytes()
}

func (r *RedisClient) TrackDailyFXVolume(ctx context.Context, customerID, currency string, amount float64) error {
	today := time.Now().Format("2006-01-02")
	key := fmt.Sprintf("%svolume:%s:%s:%s", r.prefix, customerID, currency, today)
	return r.client.IncrByFloat(ctx, key, amount).Err()
}

func (r *RedisClient) CheckFXLimit(ctx context.Context, customerID, currency string, amount float64, dailyLimit float64) (bool, error) {
	today := time.Now().Format("2006-01-02")
	key := fmt.Sprintf("%svolume:%s:%s:%s", r.prefix, customerID, currency, today)
	current, err := r.client.Get(ctx, key).Float64()
	if err != nil && err != redis.Nil {
		return false, err
	}
	return (current + amount) <= dailyLimit, nil
}

func (r *RedisClient) UpdateFXPosition(ctx context.Context, currency string, position float64) error {
	key := fmt.Sprintf("%sposition:%s", r.prefix, currency)
	return r.client.Set(ctx, key, position, 0).Err()
}

// Integrated FX Service
type IntegratedFXService struct {
	tigerBeetle *TigerBeetleClient
	kafka       *KafkaProducer
	redis       *RedisClient
}

type FXServiceConfig struct {
	TigerBeetleURL string
	KafkaBrokers   []string
	RedisAddr      string
	RedisPassword  string
}

func NewIntegratedFXService(config FXServiceConfig) *IntegratedFXService {
	return &IntegratedFXService{
		tigerBeetle: NewTigerBeetleClient(config.TigerBeetleURL),
		kafka:       NewKafkaProducer(config.KafkaBrokers),
		redis:       NewRedisClient(config.RedisAddr, config.RedisPassword, 0),
	}
}

type FXQuote struct {
	QuoteID      string    `json:"quote_id"`
	FromCurrency string    `json:"from_currency"`
	ToCurrency   string    `json:"to_currency"`
	FromAmount   float64   `json:"from_amount"`
	ToAmount     float64   `json:"to_amount"`
	Rate         float64   `json:"rate"`
	ExpiresAt    time.Time `json:"expires_at"`
}

func (s *IntegratedFXService) GetQuote(ctx context.Context, customerID, fromCurrency, toCurrency string, amount float64) (*FXQuote, error) {
	buyRate, _, err := s.redis.GetExchangeRate(ctx, fromCurrency, toCurrency)
	if err != nil {
		buyRate = 1.0
	}

	quote := &FXQuote{
		QuoteID:      fmt.Sprintf("quote-%d", time.Now().UnixNano()),
		FromCurrency: fromCurrency,
		ToCurrency:   toCurrency,
		FromAmount:   amount,
		ToAmount:     amount * buyRate,
		Rate:         buyRate,
		ExpiresAt:    time.Now().Add(2 * time.Minute),
	}

	_ = s.redis.CacheQuote(ctx, quote.QuoteID, quote)

	event := FXEvent{
		EventID:       fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType:     EventFXQuoteRequested,
		TransactionID: quote.QuoteID,
		CustomerID:    customerID,
		Timestamp:     time.Now(),
		Data: map[string]interface{}{
			"from_currency": fromCurrency,
			"to_currency":   toCurrency,
			"amount":        amount,
			"rate":          buyRate,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	return quote, nil
}

func (s *IntegratedFXService) ExecuteTrade(ctx context.Context, customerID, quoteID string) error {
	quoteData, err := s.redis.GetQuote(ctx, quoteID)
	if err != nil {
		return fmt.Errorf("quote expired or not found")
	}

	var quote FXQuote
	json.Unmarshal(quoteData, &quote)

	if time.Now().After(quote.ExpiresAt) {
		return fmt.Errorf("quote expired")
	}

	allowed, err := s.redis.CheckFXLimit(ctx, customerID, quote.FromCurrency, quote.FromAmount, 10000)
	if err != nil || !allowed {
		return fmt.Errorf("daily FX limit exceeded")
	}

	fromAmountMinor := int64(quote.FromAmount * 100)
	toAmountMinor := int64(quote.ToAmount * 100)

	_, err = s.tigerBeetle.BuyCurrency(quoteID, customerID, quote.FromCurrency, quote.ToCurrency, fromAmountMinor, toAmountMinor, quote.Rate)
	if err != nil {
		return err
	}

	event := FXEvent{
		EventID:       fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType:     EventFXTradeExecuted,
		TransactionID: quoteID,
		CustomerID:    customerID,
		Timestamp:     time.Now(),
		Data: map[string]interface{}{
			"from_currency": quote.FromCurrency,
			"to_currency":   quote.ToCurrency,
			"from_amount":   quote.FromAmount,
			"to_amount":     quote.ToAmount,
			"rate":          quote.Rate,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	_ = s.redis.TrackDailyFXVolume(ctx, customerID, quote.FromCurrency, quote.FromAmount)

	return nil
}

func (s *IntegratedFXService) UpdateRates(ctx context.Context, fromCurrency, toCurrency string, buyRate, sellRate float64) error {
	err := s.redis.CacheExchangeRate(ctx, fromCurrency, toCurrency, buyRate, sellRate)
	if err != nil {
		return err
	}

	event := FXEvent{
		EventID:       fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType:     EventFXRateUpdated,
		TransactionID: fmt.Sprintf("%s-%s", fromCurrency, toCurrency),
		Timestamp:     time.Now(),
		Data: map[string]interface{}{
			"from_currency": fromCurrency,
			"to_currency":   toCurrency,
			"buy_rate":      buyRate,
			"sell_rate":     sellRate,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	return nil
}
