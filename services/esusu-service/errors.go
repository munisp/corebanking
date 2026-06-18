package main

import (
	"net/http"
	"encoding/json"
)

type ErrorResponse struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Status  int         `json:"status"`
	Details interface{} `json:"details,omitempty"`
}

var ErrorCodes = map[string]string{
	"bad_request":       "ESUSU_4001",
	"not_found":         "ESUSU_4040",
	"internal_error":    "ESUSU_5000",
	"validation_failed": "ESUSU_4002",
	"decode_error":      "ESUSU_4003",
}

func SendError(w http.ResponseWriter, codeKey, message string, status int, details interface{}) {
	code, ok := ErrorCodes[codeKey]
	if !ok {
		code = codeKey
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{
		Code:    code,
		Message: message,
		Status:  status,
		Details: details,
	})
}
