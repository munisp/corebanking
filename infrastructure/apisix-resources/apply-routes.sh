#!/usr/bin/env bash
set -euo pipefail

ROUTES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/routes" && pwd)"
NAMESPACE="${NAMESPACE:-54link-dev}"
DRY_RUN="${DRY_RUN:-}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

passed=0
failed=0
failed_files=()

kubectl_args=(apply -f)
if [[ -n "$DRY_RUN" ]]; then
  kubectl_args+=(--dry-run=client)
  echo -e "${YELLOW}DRY RUN mode enabled${NC}"
fi

echo "Applying APISIX routes from: $ROUTES_DIR"
echo "Namespace: $NAMESPACE"
echo "---"

for yaml in "$ROUTES_DIR"/*.yaml; do
  filename="$(basename "$yaml")"
  if kubectl "${kubectl_args[@]}" "$yaml" --namespace="$NAMESPACE" 2>&1; then
    echo -e "${GREEN}✓ $filename${NC}"
    ((passed++))
  else
    echo -e "${RED}✗ $filename${NC}"
    ((failed++))
    failed_files+=("$filename")
  fi
done

echo ""
echo "---"
echo -e "${GREEN}Applied: $passed${NC}"
if [[ $failed -gt 0 ]]; then
  echo -e "${RED}Failed:  $failed${NC}"
  echo ""
  echo "Failed files:"
  for f in "${failed_files[@]}"; do
    echo "  - $f"
  done
  exit 1
else
  echo "All routes applied successfully."
fi
