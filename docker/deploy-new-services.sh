#!/bin/bash
# Builds, pushes, and deploys the three newly separated standalone services:
#   - beneficial-ownership-go    (port 9096)
#   - sanctions-screening-service (port 8283)
#   - compliance-service          (port 8024)
#
# Prerequisites:
#   doctl auth init           (DigitalOcean CLI, authenticated)
#   doctl kubernetes cluster kubeconfig save <cluster-name>
#   helm >= 3.x
#
# Usage:
#   ./docker/deploy-new-services.sh                  # build + push + deploy all three
#   ./docker/deploy-new-services.sh beneficial-ownership-go
#   ./docker/deploy-new-services.sh sanctions-screening-service
#   ./docker/deploy-new-services.sh compliance-service
#   BUILD_ONLY=1 ./docker/deploy-new-services.sh     # skip push + deploy
#   DEPLOY_ONLY=1 ./docker/deploy-new-services.sh    # skip build + push
set -euo pipefail

REGISTRY="registry.digitalocean.com/talentgraph-auth"
NAMESPACE="54link-dev"
CHARTS_DIR="infrastructure/charts"
ROUTES_DIR="infrastructure/apisix-resources/routes"
BUILD_ONLY="${BUILD_ONLY:-0}"
DEPLOY_ONLY="${DEPLOY_ONLY:-0}"
TARGET="${1:-all}"

cd "$(dirname "$0")/.."

# ── Service definitions: name|image-tag|port ──────────────────────────────────
declare -A TAGS=(
  [beneficial-ownership-go]="0.0.1"
  [sanctions-screening-service]="0.0.1"
  [compliance-service]="0.0.2"
)

build_push() {
  local svc="$1"
  local tag="${TAGS[$svc]}"
  local image="${REGISTRY}/54link-${svc}:${tag}"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Building : $svc"
  echo "  Image    : $image"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  docker build \
    --file "services/$svc/Dockerfile" \
    --tag "$image" \
    "services/$svc"

  echo "[push] $image"
  docker push "$image"
}

deploy_helm() {
  local svc="$1"
  local tag="${TAGS[$svc]}"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Deploying : $svc  (tag: $tag)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  helm upgrade --install "$svc" "./$CHARTS_DIR/$svc" \
    --namespace "$NAMESPACE" \
    --set "image.tag=$tag" \
    --wait \
    --timeout 5m

  echo "[apisix] applying route for $svc"
  kubectl apply -f "$ROUTES_DIR/$svc.yaml" -n "$NAMESPACE"

  echo "[ok] $svc deployed ✓"
}

run_service() {
  local svc="$1"

  if [[ -z "${TAGS[$svc]+x}" ]]; then
    echo "Unknown service: $svc. Valid options: ${!TAGS[*]}"
    exit 1
  fi

  if [[ "$DEPLOY_ONLY" != "1" ]]; then
    build_push "$svc"
  fi

  if [[ "$BUILD_ONLY" != "1" ]]; then
    deploy_helm "$svc"
  fi
}

if [[ "$TARGET" == "all" ]]; then
  for svc in beneficial-ownership-go sanctions-screening-service compliance-service; do
    run_service "$svc"
  done
else
  run_service "$TARGET"
fi

echo ""
echo "Done."
