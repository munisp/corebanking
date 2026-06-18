#!/bin/bash
# 54Bank Consolidated Entrypoint — channels-messaging
# Messaging — WhatsApp, Telegram, SMS, push notifications, email
# Services: 16 | Ports: 9143-9158
set -e

echo "[channels-messaging] Starting 16 services..."

PIDS=()

cleanup() {
  echo "[channels-messaging] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[channels-messaging] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9143 python3 /app/services/branded-comms-py/main.py &
PIDS+=($!)
PORT=9144 /app/services/notification-router-go/notification-router-go &
PIDS+=($!)
PORT=9145 /app/services/notification-service-go/notification-service-go &
PIDS+=($!)
PORT=9146 python3 /app/services/sms-alert-notification-py/main.py &
PIDS+=($!)
PORT=9147 /app/services/sms-banking-gateway-go/sms-banking-gateway-go &
PIDS+=($!)
PORT=9148 /app/services/sms-email-gateway-go/sms-email-gateway-go &
PIDS+=($!)
PORT=9149 /app/services/sms-otp-service-rs/sms_otp_service_rs &
PIDS+=($!)
PORT=9150 /app/services/telegram-banking-commands-rs/telegram_banking_commands_rs &
PIDS+=($!)
PORT=9151 /app/services/telegram-bot-gateway-go/telegram-bot-gateway-go &
PIDS+=($!)
PORT=9152 /app/services/telegram-mini-app-go/telegram-mini-app-go &
PIDS+=($!)
PORT=9153 python3 /app/services/telegram-notification-py/main.py &
PIDS+=($!)
PORT=9154 /app/services/whatsapp-banking-flows-rs/whatsapp_banking_flows_rs &
PIDS+=($!)
PORT=9155 /app/services/whatsapp-business-gateway-go/whatsapp-business-gateway-go &
PIDS+=($!)
PORT=9156 /app/services/whatsapp-cloud-api-go/whatsapp-cloud-api-go &
PIDS+=($!)
PORT=9157 /app/services/whatsapp-document-service-rs/whatsapp_document_service_rs &
PIDS+=($!)
PORT=9158 python3 /app/services/whatsapp-notification-py/main.py &
PIDS+=($!)

echo "[channels-messaging] All 16 services started (ports 9143-9158)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[channels-messaging] A service exited with code $EXIT_CODE"
cleanup
