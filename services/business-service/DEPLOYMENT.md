# Deployment Guide - Business Service

## Prerequisites

- Kubernetes 1.24+ cluster
- kubectl configured and able to access the cluster
- Helm 3.0+
- Docker with registry access
- PostgreSQL 16+ (if not using managed database)
- Kafka cluster (if not using managed Kafka)

## Pre-Deployment Checklist

- [ ] Verify cluster connectivity: `kubectl cluster-info`
- [ ] Check namespace exists: `kubectl get namespace banking-platform`
- [ ] Verify RBAC permissions
- [ ] Confirm PostgreSQL connectivity
- [ ] Verify Kafka connectivity
- [ ] Check Keycloak availability
- [ ] Review DNS and networking

## Step-by-Step Deployment

### 1. Prepare Secrets

Create and configure secrets for sensitive data:

```bash
# Option A: Using kubectl
kubectl create secret generic business-service-secrets \
  -n banking-platform \
  --from-literal=DATABASE_URI='postgresql://user:password@host:5432/db' \
  --from-literal=KEYCLOAK_CLIENT_SECRET='your-secret' \
  --dry-run=client -o yaml | kubectl apply -f -

# Option B: Using Helm (recommended)
# Edit charts/business-service/values.yaml and set secrets
helm install business-service ./charts/business-service \
  -n banking-platform \
  --set secrets.DATABASE_URI='postgresql://...' \
  --set secrets.KEYCLOAK_CLIENT_SECRET='...'
```

### 2. Deploy with kubectl

```bash
# Create namespace if needed
kubectl create namespace banking-platform

# Apply ConfigMaps and Secrets
kubectl apply -f infrastructure/kubernetes/configmap.yaml
kubectl apply -f infrastructure/kubernetes/secret.yaml

# Apply Deployment and Service
kubectl apply -f infrastructure/kubernetes/deployment.yaml
kubectl apply -f infrastructure/kubernetes/service.yaml

# Apply Network Policy
kubectl apply -f infrastructure/kubernetes/network-policy.yaml

# Apply HPA and PDB
kubectl apply -f infrastructure/kubernetes/hpa.yaml
kubectl apply -f infrastructure/kubernetes/pdb.yaml
```

### 3. Deploy with Helm (Recommended)

```bash
# Add repository (if using chart repo)
# helm repo add 54link https://charts.54link.com
# helm repo update

# Install the chart
helm install business-service ./charts/business-service \
  -n banking-platform \
  --create-namespace \
  --set image.tag=0.0.1 \
  --set image.repository=54link-dev-ecr.registry/business-service \
  --set secrets.DATABASE_URI="postgresql://..." \
  --set secrets.KEYCLOAK_URL="https://..." \
  --set secrets.KEYCLOAK_CLIENT_SECRET="..." \
  --set secrets.PERMIFY_HOST="permify.banking-platform.svc.cluster.local" \
  --set secrets.KAFKA_BROKERS="kafka-cluster.kafka.svc.cluster.local:9092"

# Verify installation
helm list -n banking-platform
helm get values business-service -n banking-platform
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -n banking-platform -l app=business-service

# Check service
kubectl get svc -n banking-platform -l app=business-service

# Check rollout status
kubectl rollout status deployment/business-service -n banking-platform

# View events
kubectl get events -n banking-platform --sort-by='.lastTimestamp'
```

### 5. Access the Service

```bash
# Port forward
kubectl port-forward -n banking-platform svc/business-service 8086:80

# Test health endpoint
curl http://localhost:8086/health

# Test readiness endpoint
curl http://localhost:8086/ready

# View OpenAPI docs (if available)
open http://localhost:8086/docs
```

### 6. View Logs

```bash
# View current logs
kubectl logs -n banking-platform -l app=business-service

# Stream logs
kubectl logs -n banking-platform -l app=business-service -f

# View logs from all replicas
kubectl logs -n banking-platform -l app=business-service --all-containers=true

# View logs with timestamps
kubectl logs -n banking-platform -l app=business-service -f --timestamps=true
```

## Post-Deployment Verification

### Health Checks

```bash
# Verify liveness probe response
kubectl exec -it -n banking-platform deployment/business-service \
  -- curl -s http://localhost:8086/health | jq .

# Verify readiness probe response
kubectl exec -it -n banking-platform deployment/business-service \
  -- curl -s http://localhost:8086/ready | jq .
```

### Database Connectivity

```bash
# Check database connection from pod
kubectl exec -it -n banking-platform deployment/business-service \
  -- python -c "from database import engine; print(engine.execute('SELECT 1'))"
```

### Kafka Connectivity

```bash
# Check Kafka topics
kubectl exec -it -n kafka kafka-0 -- \
  kafka-topics --list --bootstrap-server localhost:9092
```

## Monitoring

### Metrics

```bash
# Get pod metrics (requires metrics-server)
kubectl top pods -n banking-platform -l app=business-service

# Get node metrics
kubectl top nodes
```

### Logs Analysis

```bash
# Tail logs from all pods
kubectl logs -f -n banking-platform -l app=business-service --tail=50

# Search for errors
kubectl logs -n banking-platform -l app=business-service | grep ERROR

# Export logs to file
kubectl logs -n banking-platform -l app=business-service > business-service.log
```

## Scaling

### Manual Scaling

```bash
# Scale deployment to 5 replicas
kubectl scale deployment business-service -n banking-platform --replicas=5

# Check replicas
kubectl get deployment business-service -n banking-platform
```

### Auto Scaling (HPA)

```bash
# Check HPA status
kubectl get hpa -n banking-platform

# Watch HPA metrics
kubectl get hpa -n banking-platform --watch

# Describe HPA
kubectl describe hpa business-service-hpa -n banking-platform
```

## Troubleshooting

### Pod not starting

```bash
# Check pod status and events
kubectl describe pod <pod-name> -n banking-platform

# Check logs for errors
kubectl logs <pod-name> -n banking-platform

# Check resource availability
kubectl top nodes
kubectl describe nodes
```

### Service not accessible

```bash
# Check service endpoints
kubectl get endpoints business-service -n banking-platform

# Test service connectivity
kubectl run -it --rm debug --image=busybox --restart=Never \
  -- wget -qO- http://business-service.banking-platform.svc.cluster.local/health

# Check network policies
kubectl get networkpolicies -n banking-platform
```

### Database connection issues

```bash
# Test database connectivity from pod
kubectl exec -it -n banking-platform deployment/business-service \
  -- python -c "import psycopg2; conn = psycopg2.connect('postgresql://...')"

# Check connection string
kubectl get secret business-service-secrets -n banking-platform -o jsonpath='{.data.DATABASE_URI}' | base64 -d
```

## Rollback

```bash
# Check deployment history
kubectl rollout history deployment/business-service -n banking-platform

# Rollback to previous version
kubectl rollout undo deployment/business-service -n banking-platform

# Rollback to specific revision
kubectl rollout undo deployment/business-service -n banking-platform --to-revision=2
```

## Uninstall

### With kubectl

```bash
# Delete all resources
kubectl delete -f infrastructure/kubernetes/
```

### With Helm

```bash
# Uninstall release
helm uninstall business-service -n banking-platform
```

## Advanced Configuration

### Environment-Specific Values

```bash
# Production
helm install business-service ./charts/business-service \
  -n banking-platform \
  -f charts/business-service/values.yaml \
  -f charts/business-service/values-production.yaml

# Staging
helm install business-service ./charts/business-service \
  -n banking-platform \
  -f charts/business-service/values.yaml \
  -f charts/business-service/values-staging.yaml
```

### Custom Resource Definitions

Implement Kubernetes CRDs for business service configuration if needed.

### Service Mesh Integration (Optional)

If using Istio or Linkerd:

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: business-service
spec:
  hosts:
  - business-service
  http:
  - match:
    - uri:
        prefix: /api/v1
    route:
    - destination:
        host: business-service
        port:
          number: 80
```

## Support

For deployment issues or questions, check:
1. Service logs: `kubectl logs -n banking-platform -l app=business-service`
2. Events: `kubectl get events -n banking-platform`
3. Documentation: See README.md
4. Issues: Contact dev@54link.com
