#!/bin/bash
# Build, test, and deploy script for Business Service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SERVICE_NAME="business-service"
REGISTRY="${REGISTRY:-54link-dev-ecr.registry}"
IMAGE_NAME="${REGISTRY}/${SERVICE_NAME}"
VERSION="${VERSION:-0.0.1}"
NAMESPACE="${NAMESPACE:-banking-platform}"

echo -e "${BLUE}Building Business Service...${NC}"

# Step 1: Install dependencies
echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
pip install -q -r requirements.txt

# Step 2: Run tests
echo -e "${YELLOW}Step 2: Running tests...${NC}"
pytest tests/ -v --cov=. --cov-report=term-missing || { echo -e "${RED}Tests failed!${NC}"; exit 1; }

# Step 3: Build Docker image
echo -e "${YELLOW}Step 3: Building Docker image...${NC}"
docker build -t ${IMAGE_NAME}:${VERSION} -t ${IMAGE_NAME}:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Docker image built successfully${NC}"
else
    echo -e "${RED}✗ Docker image build failed${NC}"
    exit 1
fi

# Step 4: Push to registry
echo -e "${YELLOW}Step 4: Pushing image to registry...${NC}"
docker push ${IMAGE_NAME}:${VERSION} || { echo -e "${RED}Failed to push versioned tag${NC}"; exit 1; }
docker push ${IMAGE_NAME}:latest || { echo -e "${RED}Failed to push latest tag${NC}"; exit 1; }
echo -e "${GREEN}✓ Image pushed to registry${NC}"

# Step 5: Deploy to Kubernetes
echo -e "${YELLOW}Step 5: Deploying to Kubernetes...${NC}"

# Check if namespace exists
if kubectl get namespace ${NAMESPACE} > /dev/null 2>&1; then
    echo "Namespace ${NAMESPACE} exists"
else
    echo "Creating namespace ${NAMESPACE}..."
    kubectl create namespace ${NAMESPACE}
fi

# Deploy with Helm
helm upgrade --install ${SERVICE_NAME} ./charts/${SERVICE_NAME} \
    -n ${NAMESPACE} \
    --set image.tag=${VERSION} \
    --set image.repository=${IMAGE_NAME} \
    --wait \
    --timeout 5m

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Deployed successfully${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

# Step 6: Verify deployment
echo -e "${YELLOW}Step 6: Verifying deployment...${NC}"
kubectl rollout status deployment/${SERVICE_NAME} -n ${NAMESPACE} --timeout=5m

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Deployment verified${NC}"
else
    echo -e "${RED}✗ Deployment verification failed${NC}"
    exit 1
fi

# Step 7: Run health checks
echo -e "${YELLOW}Step 7: Running health checks...${NC}"
sleep 5  # Wait for service to be ready

# Port forward
kubectl port-forward -n ${NAMESPACE} svc/${SERVICE_NAME} 8086:80 > /dev/null 2>&1 &
PF_PID=$!
sleep 2

# Check health
HEALTH=$(curl -s http://localhost:8086/health | grep -o '"status":"healthy"')
if [ ! -z "$HEALTH" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    kill $PF_PID 2>/dev/null || true
    exit 1
fi

# Check readiness
READY=$(curl -s http://localhost:8086/ready | grep -o '"status":"ready"')
if [ ! -z "$READY" ]; then
    echo -e "${GREEN}✓ Readiness check passed${NC}"
else
    echo -e "${RED}✗ Readiness check failed${NC}"
    kill $PF_PID 2>/dev/null || true
    exit 1
fi

kill $PF_PID 2>/dev/null || true

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Build and deployment successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Service Details:"
echo "  Image: ${IMAGE_NAME}:${VERSION}"
echo "  Namespace: ${NAMESPACE}"
echo "  Pod: $(kubectl get pods -n ${NAMESPACE} -l app=${SERVICE_NAME} -o jsonpath='{.items[0].metadata.name}')"
echo ""
echo "Check logs:"
echo "  kubectl logs -n ${NAMESPACE} -l app=${SERVICE_NAME} -f"
echo ""
echo "Port forward:"
echo "  kubectl port-forward -n ${NAMESPACE} svc/${SERVICE_NAME} 8086:80"
