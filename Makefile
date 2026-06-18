# 54Bank Core Banking Platform — Development Commands
# Usage: make [target]

.PHONY: help build test lint check clean docker security

# Default target
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Build ---
build-go: ## Build all Go services
	@echo "Building Go services..." && \
	fail=0; pass=0; \
	for d in $$(find services -name "main.go" -exec dirname {} \;); do \
		if (cd "$$d" && go build -o /dev/null . 2>/dev/null); then pass=$$((pass+1)); \
		else fail=$$((fail+1)); echo "FAIL: $$(basename $$d)"; fi; \
	done; \
	echo "Go: $$pass passed, $$fail failed"

build-rust: ## Check all Rust services
	@echo "Checking Rust services..." && \
	fail=0; pass=0; \
	for d in $$(find services -name "Cargo.toml" -exec dirname {} \; | grep -v middleware); do \
		if (cd "$$d" && cargo check 2>/dev/null); then pass=$$((pass+1)); \
		else fail=$$((fail+1)); echo "FAIL: $$(basename $$d)"; fi; \
	done; \
	echo "Rust: $$pass passed, $$fail failed"

build-python: ## Compile-check all Python services
	@echo "Checking Python services..." && \
	fail=0; pass=0; \
	for f in $$(find services -name "main.py"); do \
		if python3 -m py_compile "$$f" 2>/dev/null; then pass=$$((pass+1)); \
		else fail=$$((fail+1)); echo "FAIL: $$f"; fi; \
	done; \
	echo "Python: $$pass passed, $$fail failed"

build: build-go build-python ## Build/check all services (Go + Python, Rust requires cargo)

# --- Test ---
test-go: ## Run Go tests
	@for d in $$(find services -name "*_test.go" -exec dirname {} \; | sort -u); do \
		echo "Testing $$(basename $$d)..." && (cd "$$d" && go test ./... -timeout 30s); \
	done

test: test-go ## Run all tests

# --- Lint ---
lint-go: ## Lint Go services (requires golangci-lint)
	@which golangci-lint > /dev/null 2>&1 || (echo "Install: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest" && exit 1)
	@for d in $$(find services -name "main.go" -exec dirname {} \;); do \
		(cd "$$d" && golangci-lint run --timeout 2m 2>/dev/null) || echo "Lint issues: $$(basename $$d)"; \
	done

lint-python: ## Lint Python services (requires ruff)
	@which ruff > /dev/null 2>&1 || (echo "Install: pip install ruff" && exit 1)
	@ruff check services/ --select E,W,F --ignore E501

lint: lint-python ## Lint all (Python by default, Go with golangci-lint)

# --- Checks ---
check-cors: ## Verify all services have CORS headers
	@echo "Go CORS:" $$(grep -rl "corsMiddleware\|Access-Control" services/ --include="main.go" | wc -l) / $$(find services -name "main.go" | wc -l)
	@echo "Rust CORS:" $$(grep -rl "Cors\|cors" services/ --include="main.rs" | wc -l) / $$(find services -name "main.rs" | wc -l)
	@echo "Python CORS:" $$(grep -rl "cors\|CORS\|Access-Control" services/ --include="main.py" | wc -l) / $$(find services -name "main.py" | wc -l)

check-docker: ## Verify Dockerfile security (non-root USER + HEALTHCHECK)
	@echo "USER:" $$(grep -rl "^USER" services/ --include="Dockerfile" | wc -l) / $$(find services -name "Dockerfile" | wc -l)
	@echo "HEALTHCHECK:" $$(grep -rl "HEALTHCHECK" services/ --include="Dockerfile" | wc -l) / $$(find services -name "Dockerfile" | wc -l)

check-shutdown: ## Verify graceful shutdown coverage
	@echo "Go shutdown:" $$(grep -rl "signal.Notify\|Shutdown" services/ --include="main.go" | wc -l) / $$(find services -name "main.go" | wc -l)
	@echo "Python shutdown:" $$(grep -rl "signal\|SIGTERM" services/ --include="main.py" | wc -l) / $$(find services -name "main.py" | wc -l)

check-health: ## Verify health endpoints
	@echo "Go:" $$(grep -rl "healthz" services/ --include="main.go" | wc -l) / $$(find services -name "main.go" | wc -l)
	@echo "Rust:" $$(grep -rl "healthz" services/ --include="main.rs" | wc -l) / $$(find services -name "main.rs" | wc -l)
	@echo "Python:" $$(grep -rl "healthz" services/ --include="main.py" | wc -l) / $$(find services -name "main.py" | wc -l)

check: check-cors check-docker check-shutdown check-health ## Run all quality checks

# --- Security ---
security-trivy: ## Scan Docker images with Trivy
	@which trivy > /dev/null 2>&1 || (echo "Install: curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh" && exit 1)
	@for f in $$(find services -name "Dockerfile" | head -20); do \
		echo "Scanning $$(dirname $$f)..." && trivy config "$$f" --severity HIGH,CRITICAL 2>/dev/null; \
	done

security-secrets: ## Check for hardcoded secrets
	@echo "Checking for hardcoded secrets..." && \
	grep -rn "password123\|secret123\|admin123\|sk_live_\|sk_test_" services/ --include="main.go" --include="main.py" --include="main.rs" 2>/dev/null | head -20 || echo "No hardcoded secrets found"

security: security-secrets ## Run security checks

# --- Docker ---
docker-build: ## Build all Docker images
	@for d in $$(find services -name "Dockerfile" -exec dirname {} \; | head -10); do \
		name=$$(basename $$d); \
		echo "Building $$name..." && docker build -t "54bank/$$name" "$$d" 2>/dev/null || echo "Failed: $$name"; \
	done

# --- Clean ---
clean: ## Clean build artifacts
	@find services -name "*.exe" -delete 2>/dev/null
	@find services -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
	@echo "Cleaned build artifacts"

# --- Info ---
stats: ## Show platform statistics
	@echo "=== 54Bank Platform Statistics ==="
	@echo "Go services:     $$(find services -name 'main.go' | wc -l)"
	@echo "Rust services:   $$(find services -name 'main.rs' | wc -l)"
	@echo "Python services: $$(find services -name 'main.py' | wc -l)"
	@echo "Flutter screens: $$(ls mobile/flutter/lib/screens/*_screen.dart 2>/dev/null | wc -l)"
	@echo "Dockerfiles:     $$(find services -name 'Dockerfile' | wc -l)"
	@echo "K8s manifests:   $$(find k8s -name '*.yaml' 2>/dev/null | wc -l)"
	@echo ".env.example:    $$(find services -name '.env.example' | wc -l)"
