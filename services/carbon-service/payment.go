package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

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

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		panic(err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)

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
