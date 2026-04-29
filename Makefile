.DEFAULT_GOAL := help
PORT ?= 9000

# ── Dev ───────────────────────────────────────────────────────────────────────
serve: ## Start local dev server
	cd frontend && npm run dev

kill: ## Kill whatever is running on PORT (default 9000)
	@lsof -ti :$(PORT) | xargs kill 2>/dev/null && echo "Killed process on :$(PORT)" || echo "Nothing running on :$(PORT)"

# ── Tests ─────────────────────────────────────────────────────────────────────
test: test-py test-js test-contract ## Run all tests

test-py: ## Run Python tests (migrate.py parsing)
	python3 tests/test_migrate.py

test-js: ## Run JavaScript tests (metrics.ts computation)
	cd frontend && npm test

test-contract: ## Run API contract compliance tests
	python3 tests/test_api_contract.py

test-ocr: ## Run OCR integration tests (hits live edge function — requires network)
	pytest tests/test_ocr.py -v

# ── Supabase ──────────────────────────────────────────────────────────────────
deploy-fn: ## Deploy the ocr-image edge function to Supabase
	supabase functions deploy ocr-image --no-verify-jwt

secrets: ## Show which secrets are set on the Supabase project
	supabase secrets list

# ── Data migration ────────────────────────────────────────────────────────────
migrate-dry: ## Dry-run: parse drivvo_ada_export.json and print row counts
	python3 migrate.py --dry-run

migrate: ## Import drivvo_ada_export.json into Supabase (requires env vars)
	@test -n "$(SUPABASE_SERVICE_KEY)" || (echo "ERROR: set SUPABASE_SERVICE_KEY"; exit 1)
	SUPABASE_URL=https://cofmlyvqhxjkmyzbtrsy.supabase.co \
	SUPABASE_SERVICE_KEY=$(SUPABASE_SERVICE_KEY) \
	python3 migrate.py

# ── Help ──────────────────────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
