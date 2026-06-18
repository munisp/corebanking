package main

import (
	"encoding/json"
	"net/http"
)

type ErrorDetail struct {
	Message string      `json:"message"`
	Status  string      `json:"status"`
	Code    string      `json:"code"`
	Service string      `json:"service"`
	Details interface{} `json:"details,omitempty"`
}

type ErrorResponse struct {
	Detail ErrorDetail `json:"detail"`
}

var ErrorCodes = map[string]string{
	"bad_request":       "ISB-ISB-BAD-4001",
	"not_found":         "ISB-ISB-NOT-4040",
	"internal_error":    "ISB-ISB-INT-5000",
	"validation_failed": "ISB-ISB-VAL-4002",
	"decode_error":      "ISB-ISB-DEC-4003",
	"unauthorized":      "ISB-ISB-UNA-4010",
	"forbidden":         "ISB-ISB-FOR-4030",
}

func SendError(w http.ResponseWriter, codeKey, message string, statusCode int, details interface{}) {
	code, ok := ErrorCodes[codeKey]
	if !ok {
		code = codeKey
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ErrorResponse{
		Detail: ErrorDetail{
			Message: message,
			Status:  "error",
			Code:    code,
			Service: "islamic-banking-service",
			Details: details,
		},
	})
}
