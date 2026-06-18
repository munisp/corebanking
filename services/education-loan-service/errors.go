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
	"bad_request":       "EDU-EDU-BAD-4001",
	"not_found":         "EDU-EDU-NOT-4040",
	"internal_error":    "EDU-EDU-INT-5000",
	"validation_failed": "EDU-EDU-VAL-4002",
	"decode_error":      "EDU-EDU-DEC-4003",
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
			Service: "education-loan-service",
			Details: details,
		},
	})
}
