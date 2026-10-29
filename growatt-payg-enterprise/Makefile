.PHONY: help up down logs restart test test-vfs test-usecases test-backend migrate build run-api run-mqtt run-cron seed clean

SHELL := /bin/bash
COMPOSE ?= docker compose
GO_ENV := GOTOOLCHAIN=local CGO_ENABLED=0 GOCACHE=/tmp/go-build GOPATH=/tmp/go

help:
	@echo "Growatt PAYG Enterprise Management Commands:"
	@echo "  make up            - Start PostgreSQL (Timescale+pgvector), EMQX, and Redis containers"
	@echo "  make down          - Stop and remove containers"
	@echo "  make logs          - View live logs from docker containers"
	@echo "  make migrate       - Run database migrations manually"
	@echo "  make test-vfs      - Run atomic VFS unit and concurrency tests"
	@echo "  make test-usecases - Run sizing calculator and guardrail tests"
	@echo "  make test-backend  - Run all Go core-backend tests"
	@echo "  make test          - Run all tests"
	@echo "  make build         - Compile all Go binaries"
	@echo "  make run-api       - Run API server locally"
	@echo "  make run-mqtt      - Run MQTT gateway locally"
	@echo "  make run-cron      - Run Cron scheduler locally"

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

restart:
	$(COMPOSE) restart

migrate:
	@echo "Applying PostgreSQL schema migrations..."
	@PGPASSWORD=$${POSTGRES_PASSWORD:-payg_secure_pass_2026} psql -h $${POSTGRES_HOST:-localhost} -p $${POSTGRES_PORT:-5432} -U $${POSTGRES_USER:-payg_admin} -d $${POSTGRES_DB:-payg_enterprise} -f core-backend/migrations/001_init_schema.sql || \
	docker exec -i payg_timescale_postgres psql -U payg_admin -d payg_enterprise < core-backend/migrations/001_init_schema.sql

test-vfs:
	@echo "Running VFS Unit and Atomic Concurrency Tests..."
	cd core-backend && $(GO_ENV) go test -v ./internal/adapters/vfs_store/...

test-usecases:
	@echo "Running Usecases (Sizing Calculator & Nigerian Guardrails) Tests..."
	cd core-backend && $(GO_ENV) go test -v ./internal/usecases/...

test-backend:
	@echo "Running all backend tests..."
	cd core-backend && $(GO_ENV) go test -v ./...

test-forecasting:
	@echo "Running Python Intelligence Engine Forecasting Tests..."
	cd intelligence-engine && .venv/bin/pytest -v

test: test-vfs test-usecases test-forecasting

build:
	@echo "Building Go binaries..."
	mkdir -p core-backend/bin
	cd core-backend && $(GO_ENV) go build -o bin/api-server ./cmd/api-server/main.go
	cd core-backend && $(GO_ENV) go build -o bin/mqtt-gateway ./cmd/mqtt-gateway/main.go
	cd core-backend && $(GO_ENV) go build -o bin/cron-scheduler ./cmd/cron-scheduler/main.go
	@echo "Build complete. Artifacts in core-backend/bin/"

start:
	./start_all.sh

stop:
	./stop_all.sh

run-api:
	cd core-backend && $(GO_ENV) go run ./cmd/api-server/main.go

run-mqtt:
	cd core-backend && $(GO_ENV) go run ./cmd/mqtt-gateway/main.go

run-cron:
	cd core-backend && $(GO_ENV) go run ./cmd/cron-scheduler/main.go

run-python:
	cd intelligence-engine && PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

clean:
	rm -rf core-backend/bin/
	rm -rf data/vfs/

