#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${REGISTRY:-registry.digitalocean.com/talentgraph-auth}"
IMAGE="$REGISTRY/smoke-test-runner:0.0.2"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Building smoke-test-runner image..."
docker build \
  -f "$REPO_ROOT/docker/Dockerfile.test-runner" \
  -t "$IMAGE" \
  "$REPO_ROOT"

echo "Pushing $IMAGE..."
docker push "$IMAGE"

echo "Done. Apply the CronJob with:"
echo "  kubectl apply -f infrastructure/kubernetes/smoke-test-cronjob.yaml"
