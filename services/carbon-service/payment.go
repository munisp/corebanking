package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// sharedHTTPClient is a process-wide pooled HTTP client for outbound calls
// (replaces per-call &http.Client{} construction).
var sharedHTTPClient = &http.Client{
	Timeout: 10 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 25,
		IdleConnTimeout:     90 * time.Second,
	},
}

type TradePaymentStruct struct {
	Payer  string `json:"payer"`
	Payee  string `json:"payee"`
	Amount string `json:"amount"`
	Note   string `json:"note"`
	Pin    string `json:"pin"`
}

func TradePayment(payload *TradePaymentStruct) ([]byte, error) {
	url := getEnv("PAYMENT_URL", "")

	jsonData, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		panic(err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := sharedHTTPClient.Do(req)

	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	fmt.Println("Status:", resp.Status)
	fmt.Println("Response:", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf(
			"payment failed | status: %d | response: %s",
			resp.StatusCode,
			string(body),
		)
	}

	return body, nil
}
