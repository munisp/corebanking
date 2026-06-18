#!/bin/bash
# 54Bank Consolidated Entrypoint — specialized-agri
# Agriculture — crop, livestock, soil, harvest, warehouse, cooperatives
# Services: 25 | Ports: 9490-9514
set -e

echo "[specialized-agri] Starting 25 services..."

PIDS=()

cleanup() {
  echo "[specialized-agri] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[specialized-agri] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9490 /app/services/acgsf-guarantee-go/acgsf-guarantee-go &
PIDS+=($!)
PORT=9491 python3 /app/services/agri-esg-impact-py/main.py &
PIDS+=($!)
PORT=9492 /app/services/agri-evoucher-go/agri-evoucher-go &
PIDS+=($!)
PORT=9493 /app/services/agri-input-marketplace-go/agri-input-marketplace-go &
PIDS+=($!)
PORT=9494 /app/services/agri-iot-sensor-rs/agri_iot_sensor_rs &
PIDS+=($!)
PORT=9495 /app/services/agri-logistics-go/agri-logistics-go &
PIDS+=($!)
PORT=9496 /app/services/agri-reinsurance-go/agri-reinsurance-go &
PIDS+=($!)
PORT=9497 /app/services/agriculture-banking-rs/agriculture_banking_rs &
PIDS+=($!)
PORT=9498 python3 /app/services/cooperative-financials-py/main.py &
PIDS+=($!)
PORT=9499 /app/services/cooperative-management-go/cooperative-management-go &
PIDS+=($!)
PORT=9500 /app/services/cooperative-meetings-go/cooperative-meetings-go &
PIDS+=($!)
PORT=9501 /app/services/crossborder-agri-trade-rs/crossborder_agri_trade_rs &
PIDS+=($!)
PORT=9502 /app/services/esusu-groups-go/esusu-groups-go &
PIDS+=($!)
PORT=9503 /app/services/farm-boundary-mapping-rs/farm_boundary_mapping_rs &
PIDS+=($!)
PORT=9504 /app/services/fisheries-aquaculture-go/fisheries-aquaculture-go &
PIDS+=($!)
PORT=9505 /app/services/livestock-finance-rs/livestock_finance_rs &
PIDS+=($!)
PORT=9506 /app/services/livestock-insurance-rs/livestock_insurance_rs &
PIDS+=($!)
PORT=9507 /app/services/livestock-management-rs/livestock_management_rs &
PIDS+=($!)
PORT=9508 /app/services/multi-peril-crop-insurance-rs/multi_peril_crop_insurance_rs &
PIDS+=($!)
PORT=9509 /app/services/nirsal-agro-geocoop-go/nirsal-agro-geocoop-go &
PIDS+=($!)
PORT=9510 /app/services/nirsal-credit-guarantee-go/nirsal-credit-guarantee-go &
PIDS+=($!)
PORT=9511 /app/services/post-harvest-loss-tracker-go/post-harvest-loss-tracker-go &
PIDS+=($!)
PORT=9512 /app/services/quality-certification-go/quality-certification-go &
PIDS+=($!)
PORT=9513 /app/services/satellite-crop-monitor-rs/satellite_crop_monitor_rs &
PIDS+=($!)
PORT=9514 /app/services/warehouse-management-go/warehouse-management-go &
PIDS+=($!)

echo "[specialized-agri] All 25 services started (ports 9490-9514)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[specialized-agri] A service exited with code $EXIT_CODE"
cleanup
