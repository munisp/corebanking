#!/bin/bash
set -e

echo "🚀 Deploying Escrow Service to Production..."

# Configuration
IMAGE_REPO="registry.digitalocean.com/talentgraph-auth/54link-escrow-service"
NEW_VERSION="0.0.12"
CHART_PATH="../../infrastructure/charts/escrow-service"
NAMESPACE="54link"

# Step 1: Build Docker image
echo "📦 Building Docker image..."
docker build -t ${IMAGE_REPO}:${NEW_VERSION} .

# Step 2: Push to registry
echo "⬆️  Pushing image to registry..."
docker push ${IMAGE_REPO}:${NEW_VERSION}

# Step 3: Update Helm values
echo "📝 Updating Helm chart version..."
sed -i "s/tag: .*/tag: ${NEW_VERSION}/" ${CHART_PATH}/values.yaml

# Step 4: Upgrade Helm release
echo "🔄 Upgrading Helm release..."
helm upgrade escrow-service ${CHART_PATH} \
  --namespace ${NAMESPACE} \
  --wait \
  --timeout 5m

echo "✅ Deployment completed successfully!"
echo "🔍 Checking pod status..."
kubectl get pods -n ${NAMESPACE} -l app=escrow-service

echo ""
echo "📊 To view logs, run:"
echo "   kubectl logs -f -n ${NAMESPACE} -l app=escrow-service"
