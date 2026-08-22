package utils

import (
	"github.com/gin-gonic/gin"
)

type ErrorResponse struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Status  int         `json:"status"`
	Details interface{} `json:"details,omitempty"`
}

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

func SendError(c *gin.Context, code, message string, status int, details interface{}) {
	c.JSON(status, ErrorResponse{
		Code:    code,
		Message: message,
		Status:  status,
		Details: details,
	})
}
