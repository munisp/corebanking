# Omini-Service - Multi-Channel Banking Communication Platform

> **Last Updated:** February 9, 2026  
> **Service Type:** Multi-service (Go, Python)  
> **Ports:** 8102-8104, 8123-8124

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Docker Setup](#docker-setup)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Monitoring & Metrics](#monitoring--metrics)
- [Troubleshooting](#troubleshooting)

---

## Overview

The **Omini-Service** is a comprehensive multi-channel banking communication platform that provides seamless customer interactions across multiple channels:

- **Telegram Banking** - Full-featured banking through Telegram bot
- **WhatsApp Banking** - WhatsApp-based banking services
- **USSD Banking** - USSD menu-driven banking for feature phones
- **SMS Banking** - SMS-based banking commands and notifications
- **Communication Hub** - Central orchestration and routing service

### Key Features

✅ **Multi-Channel Support** - Telegram, WhatsApp, USSD, SMS  
✅ **Real-time Messaging** - Powered by Kafka event streaming  
✅ **Session Management** - Redis-based state management  
✅ **Transaction Support** - TigerBeetle integration for ledger operations  
✅ **Security** - Keycloak authentication & Permify authorization  
✅ **Analytics** - Lakehouse integration for data analytics  
✅ **Observability** - Prometheus metrics and health checks  
✅ **Scalability** - Kubernetes-ready with auto-scaling

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Communication Hub                        │
│                    (Central Orchestrator)                    │
│                         Port: 8124                           │
└────────────┬──────────────────────────────────┬─────────────┘
             │                                  │
    ┌────────┴────────┐                ┌───────┴──────────┐
    │                 │                │                  │
┌───▼─────┐  ┌───────▼────┐  ┌───────▼────┐  ┌─────────▼──┐
│Telegram │  │  WhatsApp  │  │    USSD    │  │    SMS     │
│Service  │  │  Service   │  │  Service   │  │  Service   │
│8123     │  │   8102     │  │   8103     │  │   8104     │
└─────────┘  └────────────┘  └────────────┘  └────────────┘
     │             │               │                │
     └─────────────┴───────────────┴────────────────┘
                           │
         ┌─────────────────┴──────────────────┐
         │                                    │
    ┌────▼──────┐  ┌──────────┐  ┌──────────▼─────┐
    │   Kafka   │  │  Redis   │  │  TigerBeetle   │
    │  Events   │  │ Sessions │  │    Ledger      │
    └───────────┘  └──────────┘  └────────────────┘
```

---

## Services

### 1. Communication Hub (Port: 8124)

**Central orchestration service** that routes messages between channels and core banking systems.

- **Language:** Go
- **Key Features:**
  - Message routing and orchestration
  - Channel health monitoring
  - Rate limiting & circuit breakers
  - Broadcasting to multiple channels
  - Conversation history management

### 2. Telegram Service (Port: 8123)

**Telegram bot** for full-featured banking interactions.

- **Language:** Go
- **Key Features:**
  - Account balance inquiries
  - Fund transfers
  - Transaction history
  - Bill payments
  - Interactive menus

### 3. WhatsApp Service (Port: 8102)

**WhatsApp Business API** integration for banking services.

- **Language:** Python
- **Key Features:**
  - Rich media messages
  - Interactive buttons
  - Account notifications
  - Transaction confirmations

### 4. USSD Service (Port: 8103)

**USSD gateway** for feature phone banking.

- **Language:** Go
- **Key Features:**
  - Menu-driven interface
  - Balance checking
  - Airtime purchase
  - Mini statements

### 5. SMS Service (Port: 8104)

**SMS banking** for commands and notifications.

- **Language:** Go
- **Key Features:**
  - Command-based banking
  - Transaction alerts
  - Account notifications
  - OTP delivery

---

## Prerequisites

### Required Services

| Service     | Port | Status Check                 | Required    |
| ----------- | ---- | ---------------------------- | ----------- |
| PostgreSQL  | 5432 | `pg_isready`                 | ✅ Yes      |
| Redis       | 6379 | `redis-cli ping`             | ✅ Yes      |
| Kafka       | 9092 | `nc -zv localhost 9092`      | ✅ Yes      |
| TigerBeetle | 3000 | Check process running        | ✅ Yes      |
| Keycloak    | 8080 | `curl localhost:8080/health` | ⚠️ Optional |
| Temporal    | 7233 | `curl localhost:8233`        | ⚠️ Optional |

### Development Tools

- **Go:** 1.22 or later
- **Python:** 3.11 or later
- **Docker:** 20.10 or later
- **Kubernetes:** 1.28 or later (for K8s deployment)
- **Helm:** 3.12 or later (for K8s deployment)

---

## Local Development Setup

### Step 1: Clone and Navigate

```bash
cd services/omini-service
```

### Step 2: Setup Go Services

#### Communication Hub

```bash
cd communication-hub
cp .env.example .env
# Edit .env with your configuration
go mod download
go build -o communication-hub .
./communication-hub
```

#### Telegram Service

```bash
cd telegram-service
cp .env.example .env
# Add your Telegram bot token
go mod download
go build -o telegram-service .
./telegram-service
```

#### USSD Service

```bash
cd ussd-service
cp .env.example .env
go mod download
go build -o ussd-service .
./ussd-service
```

#### SMS Service

```bash
cd sms-banking
cp .env.example .env
# Add your SMS provider credentials
go mod download
go build -o sms-service .
./sms-service
```

### Step 3: Setup Python Service

#### WhatsApp Service

```bash
cd whatsapp-service
cp .env.example .env
# Add your WhatsApp credentials
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python whatsapp_middleware_integration.py
```

### Step 4: Verify Services

Check that all services are running:

```bash
# Communication Hub
curl http://localhost:8124/health

# Telegram Service
curl http://localhost:8123/health

# WhatsApp Service
curl http://localhost:8102/health

# USSD Service
curl http://localhost:8103/health

# SMS Service
curl http://localhost:8104/health
```

---

## Docker Setup

### Build Images

```bash
# Communication Hub
cd communication-hub
docker build -t 54link-communication-hub:latest .

# Telegram Service
cd ../telegram-service
docker build -t 54link-telegram-service:latest .

# WhatsApp Service
cd ../whatsapp-service
docker build -t 54link-whatsapp-service:latest .

# USSD Service
cd ../ussd-service
docker build -t 54link-ussd-service:latest .

# SMS Service
cd ../sms-banking
docker build -t 54link-sms-service:latest .
```

### Run with Docker Compose

Create `docker-compose.yml`:

```yaml
version: "3.8"

services:
  communication-hub:
    image: 54link-communication-hub:latest
    ports:
      - "8124:8124"
    env_file:
      - communication-hub/.env
    depends_on:
      - redis
      - kafka
      - postgres

  telegram-service:
    image: 54link-telegram-service:latest
    ports:
      - "8123:8123"
    env_file:
      - telegram-service/.env
    depends_on:
      - redis
      - kafka
      - postgres

  whatsapp-service:
    image: 54link-whatsapp-service:latest
    ports:
      - "8102:8102"
    env_file:
      - whatsapp-service/.env
    depends_on:
      - redis
      - kafka

  ussd-service:
    image: 54link-ussd-service:latest
    ports:
      - "8103:8103"
    env_file:
      - ussd-service/.env
    depends_on:
      - redis
      - kafka

  sms-service:
    image: 54link-sms-service:latest
    ports:
      - "8104:8104"
    env_file:
      - sms-banking/.env
    depends_on:
      - redis
      - kafka
```

Start services:

```bash
docker-compose up -d
```

---

## Kubernetes Deployment

### Prerequisites

1. Kubernetes cluster running
2. `kubectl` configured
3. Helm installed
4. Docker registry credentials configured

### Deploy Services

```bash
# Navigate to infrastructure directory
cd ../../infrastructure

# Create namespace
kubectl create namespace 54link

# Setup service account (if not already done)
./01_setup_service_account.sh

# Setup Docker registry authentication
./02_setup_docker_registry_auth.sh

# Deploy Communication Hub
helm install communication-hub ./charts/communication-hub \
  --namespace 54link \
  --values ./charts/communication-hub/values.yaml

# Deploy Telegram Service
helm install telegram-service ./charts/telegram-service \
  --namespace 54link \
  --values ./charts/telegram-service/values.yaml

# Note: Create similar charts for other services following the same pattern
```

### Verify Deployment

```bash
# Check pods
kubectl get pods -n 54link | grep -E '(communication-hub|telegram-service)'

# Check services
kubectl get svc -n 54link | grep -E '(communication-hub|telegram-service)'

# Check logs
kubectl logs -f deployment/communication-hub -n 54link
```

### Update Deployment

```bash
# Update image tag in values.yaml, then:
helm upgrade communication-hub ./charts/communication-hub \
  --namespace 54link \
  --values ./charts/communication-hub/values.yaml
```

---

## Configuration

### Environment Variables

See individual `.env.example` files in each service directory:

- [`communication-hub/.env.example`](communication-hub/.env.example)
- [`telegram-service/.env.example`](telegram-service/.env.example)
- [`whatsapp-service/.env.example`](whatsapp-service/.env.example)
- [`ussd-service/.env.example`](ussd-service/.env.example)
- [`sms-banking/.env.example`](sms-banking/.env.example)

### Common Configuration

All services share these common settings:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis
REDIS_URL=localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092

# TigerBeetle
TIGERBEETLE_ADDR=localhost:3000

# Keycloak
KEYCLOAK_URL=http://localhost:8080

# Permify
PERMIFY_URL=http://localhost:3476

# Lakehouse
LAKEHOUSE_URL=http://localhost:8181
```

---

## API Documentation

### Communication Hub API

#### Send Message

```bash
POST /api/v1/send
Content-Type: application/json
X-Tenant-ID: default

{
  "channel": "telegram",
  "recipient": "user123",
  "content": "Hello, how can I help you?",
  "type": "text"
}
```

#### Broadcast Message

```bash
POST /api/v1/broadcast
Content-Type: application/json
X-Tenant-ID: default

{
  "channels": ["telegram", "whatsapp", "sms"],
  "recipients": ["user123", "user456"],
  "content": "System maintenance tonight at 10 PM",
  "type": "notification"
}
```

#### Get Conversation

```bash
GET /api/v1/conversation?customer_id=user123&channel=telegram
X-Tenant-ID: default
```

#### Health Check

```bash
GET /health

Response:
{
  "status": "healthy",
  "channels": {
    "telegram": "healthy",
    "whatsapp": "healthy",
    "ussd": "healthy",
    "sms": "healthy"
  }
}
```

### Service-Specific Endpoints

Each service exposes:

- `GET /health` - Health check endpoint
- `GET /metrics` - Prometheus metrics
- `POST /webhook` - Channel-specific webhook (Telegram, WhatsApp)

---

## Monitoring & Metrics

### Prometheus Metrics

All services expose metrics at `/metrics`:

```bash
# Example metrics
curl http://localhost:8124/metrics
```

**Available Metrics:**

- `communication_hub_messages_total` - Total messages by channel
- `communication_hub_message_latency_seconds` - Message processing latency
- `communication_hub_active_connections` - Active connections by channel
- `communication_hub_channel_health` - Channel health status

### Health Checks

```bash
# Communication Hub
curl http://localhost:8124/health

# Telegram Service
curl http://localhost:8123/health

# WhatsApp Service
curl http://localhost:8102/health

# USSD Service
curl http://localhost:8103/health

# SMS Service
curl http://localhost:8104/health
```

---

## Troubleshooting

### Issue: Service won't start

**Solution:** Check dependencies

```bash
# Check PostgreSQL
pg_isready -h localhost -p 5432

# Check Redis
redis-cli ping

# Check Kafka
echo "dump" | nc localhost 9092
```

### Issue: Telegram bot not responding

**Solution:** Verify bot token and webhook

```bash
# Check environment variable
echo $TELEGRAM_BOT_TOKEN

# Test webhook
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

### Issue: Messages not being processed

**Solution:** Check Kafka topics

```bash
# List topics
kafka-topics --list --bootstrap-server localhost:9092

# Check consumer group
kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group omini-service
```

### Issue: High memory usage

**Solution:** Adjust resource limits in values.yaml

```yaml
resources:
  limits:
    memory: 1Gi # Increase if needed
```

### Logs

```bash
# Local development
tail -f /var/log/omini-service/*.log

# Kubernetes
kubectl logs -f deployment/communication-hub -n 54link
kubectl logs -f deployment/telegram-service -n 54link
```

---

## Development

### Running Tests

```bash
# Go services
go test ./...

# Python service
cd whatsapp-service
pytest
```

### Code Quality

```bash
# Go lint
golangci-lint run

# Python lint
cd whatsapp-service
flake8 .
black --check .
```

---

## License

Copyright © 2026 54link. All rights reserved.

---

## Support

For issues or questions:

- Create an issue in the repository
- Contact the development team

---

**Happy Banking! 🏦💬**
