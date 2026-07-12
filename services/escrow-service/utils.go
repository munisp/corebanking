package main

import (
	"encoding/json"
	"net/http"
)

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Status  int         `json:"status"`
	Details interface{} `json:"details,omitempty"`
}

// ErrorCodes maps error keys to standardized error codes
var ErrorCodes = map[string]string{
	"bad_request":       "ESCROW_4001",
	"not_found":         "ESCROW_4040",
	"internal_error":    "ESCROW_5000",
	"van_service_error": "ESCROW_5001",
	"validation_failed": "ESCROW_4002",
	"decode_error":      "ESCROW_4003",
	"marshal_error":     "ESCROW_5002",
	"update_failed":     "ESCROW_4041",
}

// SendError sends a standardized error response
func SendError(w http.ResponseWriter, code, message string, status int, details interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{
		Code:    code,
		Message: message,
		Status:  status,
		Details: details,
	})
}

// SendErrorWithKey sends an error using a key from ErrorCodes
func SendErrorWithKey(w http.ResponseWriter, codeKey, message string, status int, details interface{}) {
	code, ok := ErrorCodes[codeKey]
	if !ok {
		code = codeKey // fallback to provided key if not found in map
	}
	SendError(w, code, message, status, details)
}
