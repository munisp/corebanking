#!/bin/bash
# Seed Microservices Script - Initialize service configurations
# Usage: ./scripts/seed-microservices.sh

set -euo pipefail

echo "=== Seeding Microservices Configuration ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Check if services directory exists
if [ ! -d "services" ]; then
  echo "✗ services/ directory not found"
  exit 1
fi

# Count services
SERVICE_COUNT=$(find services -maxdepth 1 -type d -name "*-go" -o -name "*-py" -o -name "*-rs" | wc -l)
echo "Found $SERVICE_COUNT services"

# Create .env files for services if they don't exist
for service_dir in services/*/; do
  service_name=$(basename "$service_dir")
  if [ ! -f "$service_dir/.env" ] && [ -f "$service_dir/.env.example" ]; then
    cp "$service_dir/.env.example" "$service_dir/.env"
    echo "✓ Created .env for $service_name"
  fi
done

echo "✓ Microservices configuration seeded"
