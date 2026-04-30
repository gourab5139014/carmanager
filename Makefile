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
deploy-fn: ## Deploy the ocr-image edge function to Supabase (Production)
	cd frontend && npm run build
	cp -r dist supabase/functions/ocr-image/
	cp openapi.yaml supabase/functions/ocr-image/
	supabase functions deploy ocr-image --no-verify-jwt
	rm -rf supabase/functions/ocr-image/dist
	rm supabase/functions/ocr-image/openapi.yaml

deploy-dev: ## Deploy to the ocr-image-dev edge function (Testing/Preview)
	cd frontend && VITE_API_BASE_PATH=/functions/v1/ocr-image-dev npm run build
	cp -r dist supabase/functions/ocr-image-dev/
	cp openapi.yaml supabase/functions/ocr-image-dev/
	supabase functions deploy ocr-image-dev --no-verify-jwt
	# Set dev specific env vars
	# supabase secrets set --env-file .env.dev (if file exists)
	# Alternatively set them directly:
	supabase secrets set DB_SCHEMA=dev API_BASE_PATH=/ocr-image-dev
	rm -rf supabase/functions/ocr-image-dev/dist
	rm supabase/functions/ocr-image-dev/openapi.yaml


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
