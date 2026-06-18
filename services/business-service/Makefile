.PHONY: help build test run clean docker-build docker-push deploy

help:
	@echo "Business Service - Available commands:"
	@echo "  make install       - Install dependencies"
	@echo "  make run          - Run service locally"
	@echo "  make test         - Run tests"
	@echo "  make build        - Build (install + test)"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-push  - Push Docker image to registry"
	@echo "  make deploy       - Deploy to Kubernetes"
	@echo "  make clean        - Clean up"

install:
	pip install -r requirements.txt

run:
	python -m uvicorn main:app --host 0.0.0.0 --port 8086 --reload

test:
	pytest tests/ -v --cov=. --cov-report=html

build: install test
	@echo "Build successful!"

docker-build:
	docker build -t business-service:latest -t business-service:0.0.1 .

docker-push:
	docker push business-service:latest
	docker push business-service:0.0.1

docker-run:
	docker-compose up -d

docker-down:
	docker-compose down

deploy:
	kubectl apply -f infrastructure/kubernetes/

deploy-helm:
	helm upgrade --install business-service ./charts/business-service \
		-n banking-platform \
		--set image.tag=0.0.1

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + || true
	find . -type f -name "*.pyc" -delete || true
	rm -rf .pytest_cache coverage .coverage htmlcov dist build *.egg-info
