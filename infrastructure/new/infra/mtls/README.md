# mTLS Configuration

Mutual TLS configuration for inter-service communication in 54Bank platform.

## Overview

All service-to-service communication uses mTLS with:
- **CA certificate**: `/etc/54bank/certs/ca.crt`
- **Service certificate**: `/etc/54bank/certs/service.crt`  
- **Service private key**: `/etc/54bank/certs/service.key`

## Certificate Generation

```bash
# Generate CA key and certificate
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 365 \
  -out ca.crt -subj "/CN=54Bank Internal CA/O=54Bank/C=NG"

# Generate service certificate (per service)
openssl genrsa -out service.key 2048
openssl req -new -key service.key -out service.csr \
  -subj "/CN=${SERVICE_NAME}.54bank.internal/O=54Bank/C=NG"
openssl x509 -req -in service.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out service.crt -days 90 -sha256
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TLS_CERT_PATH` | Path to service certificate | `/etc/54bank/certs/service.crt` |
| `TLS_KEY_PATH` | Path to service private key | `/etc/54bank/certs/service.key` |
| `TLS_CA_PATH` | Path to CA certificate | `/etc/54bank/certs/ca.crt` |
| `TLS_ENABLED` | Enable mTLS | `false` |
| `TLS_VERIFY_CLIENT` | Require client certificates | `true` |

## Secret Management

All secrets are managed via environment variables. In production:
- Use Kubernetes Secrets or Vault for injection
- Never store secrets in source code
- Rotate certificates every 90 days
- Use `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` env vars
- Service-specific secrets use `<SERVICE_NAME>_<SECRET>` naming

## Kubernetes Integration

Certificates are mounted from Kubernetes Secrets:
```yaml
volumes:
  - name: tls-certs
    secret:
      secretName: ${SERVICE}-tls
volumeMounts:
  - name: tls-certs
    mountPath: /etc/54bank/certs
    readOnly: true
```
