SHELL := /bin/sh
.DEFAULT_GOAL := help

PY := uv run python
WRK := cd workers/backend
# Load environment variables from .env and/or mastra/.env if present
ENV_LOAD := set -a && { [ -f .env ] && . ./.env; [ -f mastra/.env ] && . ./mastra/.env; true; }; set +a

.PHONY: help setup setup-deps lint auth env run agent ask role skill menu roles skills clean \
        web-dev web-deploy web-secrets \
        dev test ui-build smoke smoke-live integration integration-live db-bootstrap prd campaign deploy deploy-dry-run secrets

help: ## Show this help
	@echo "Usage: make <target>"
	@echo ""
	@echo "Python CLI (development):"
	@echo "  setup       Install/sync Python dependencies (uv sync)"
	@echo "  setup-deps  Install Mastra npm dependencies (npm install)"
	@echo "  lint        Check Makefile conventions (every rule documented)"
	@echo "  auth      First-time: gcloud auth application-default login"
	@echo "  env       Print active env vars (masked)"
	@echo "  run       Interactive REPL"
	@echo "  ask       One-shot task:           make ask MSG=\"3 headlines\""
	@echo "  role      One-shot as a role:      make role NAME=seo MSG=\"...\""
	@echo "  roles     Print role menu and exit"
	@echo "  menu      Print skill menu and exit"
	@echo ""
	@echo "Mastra orchestration engine:"
	@echo "  dev            Dev mode — full Studio UI, hot reload     → :4111"
	@echo "  test           Test mode — custom chat UI in the local Worker runtime → :4111"
	@echo "  db-bootstrap   Verify Turso and create GTM application tables"
	@echo "  ui-build       Build custom chat UI for test/prod mode"
	@echo "  prd            Build for Cloudflare Workers deployment"
	@echo "  secrets        Upload secrets to Cloudflare Workers (GEMINI_API_KEY, TURSO_*)"
	@echo "  campaign       One-shot campaign generation via CLI"
	@echo ""
	@echo "Cloudflare Workers (deployment):"
	@echo "  web-dev      Run the Workers dev server locally (port 8787)"
	@echo "  web-deploy   Generate data + deploy to Cloudflare Workers"
	@echo "  web-secrets  Batch-set wrangler secrets from mastra/.env: make web-secrets [ENV_FILE=path]"
	@echo ""
	@echo "Housekeeping:"
	@echo "  clean     Remove .venv and build artifacts"

setup: ## Install/sync Python dependencies
	uv sync

setup-deps: ## Install Mastra npm dependencies (including @ai-sdk/google-vertex)
	@$(MASTRA) && npm install

lint: ## Check Makefile conventions (every rule has a ## doc comment)
	@printf "Linting Makefile...\n"; \
	awk '\
	  /^\.PHONY:/ { next } \
	  /^[A-Za-z0-9_.-]+:/ { \
	    if ($$0 !~ /##/) { \
	      name=$$0; sub(/:.*/, "", name); \
	      printf "  ✗ %s — missing \x27## doc\x27 comment\n", name; \
	      bad=1; \
	    } \
	  } \
	  END { if (!bad) printf "  ✓ all rules documented\n"; exit (bad ? 1 : 0) } \
	' Makefile

auth: ## Application Default Credentials for Vertex AI (run once)
	@gcloud auth application-default login && echo "ADC ready."

env: ## Print active model/Auth env vars (masked)
	@$(ENV_LOAD); \
	for v in GENAI_PROVIDER OPENROUTER_MODEL OPENROUTER_API_KEY GEMINI_MODEL GEMINI_API_KEY; do \
	  val=$$(printenv $$v); \
	  if [ -n "$$val" ]; then printf "  %-28s %.6s…\n" "$$v" "$$val"; \
	  else printf "  %-28s (unset)\n" "$$v"; fi; \
	done

run agent: ## Interactive REPL (Python CLI)
	@$(ENV_LOAD); $(PY) -m marketing_agent

# ─── Mastra engine targets ────────────────────────────────────────────

MASTRA = cd mastra

dev: ## Dev mode — full Studio UI with mastra/.env loaded (port 4111)
	@$(ENV_LOAD); $(MASTRA) && npm run dev

test: ## Start production-like custom UI with mastra/.env loaded (port 4111)
	@$(ENV_LOAD); $(MASTRA) && npm run test

ui-build: ## Build custom chat UI for test/prod mode
	@$(MASTRA) && npm run ui:build

prd: ## Build for Cloudflare Workers deployment
	@$(MASTRA) && npm run prd
	@echo "Built. Deploy with: make deploy"

deploy-dry-run: ## Validate the Cloudflare Worker bundle without deploying
	@$(MASTRA) && npm run deploy:dry-run

deploy: ## Build and deploy the Mastra Cloudflare Worker
	@$(MASTRA) && npm run deploy

campaign: ## One-shot campaign via Mastra CLI
	@$(MASTRA) && npx tsx run.mjs

smoke: ## Run SSE smoke tests (no server needed)
	@$(MASTRA) && npm run test:smoke

smoke-live: ## Run live smoke tests against the local server on :4111
	@$(ENV_LOAD); $(MASTRA) && npm run test:smoke:live

integration: ## Run end-to-end chat component integration tests
	@$(ENV_LOAD); $(MASTRA) && npm run test:integration

integration-live: ## Run chat integration tests against running server on :4111
	@$(ENV_LOAD); $(MASTRA) && npm run test:integration:live

db-bootstrap: ## Verify remote Turso connectivity and provision GTM tables
	@$(ENV_LOAD); $(MASTRA) && npm run db:bootstrap

secrets: ## Upload Cloudflare Workers secrets for the Mastra deployment
	@echo "Uploading secrets for gtm-agent-mastra worker..."
	@cd mastra && npx wrangler secret put GEMINI_API_KEY
	@cd mastra && npx wrangler secret put TURSO_DATABASE_URL
	@cd mastra && npx wrangler secret put TURSO_AUTH_TOKEN
	@echo "Done. Run 'make prd' then 'cd mastra && npx wrangler deploy'."

# ─── Web/Workers targets ──────────────────────────────────────────────

web-dev: ## Run the Workers dev server at http://localhost:8787
	@$(WRK) && npm run dev

web-deploy: ## Deploy to Cloudflare Workers
	@$(WRK) && npm run deploy
	@echo "Deployed! Set secrets: make web-secrets"

web-secrets: ## Batch-set wrangler secrets from mastra/.env: make web-secrets [ENV_FILE=path]
	@$(WRK) && \
	  f="${ENV_FILE:-../../mastra/.env}"; \
	  [ -f "$$f" ] || { echo "ERROR: $$f not found"; exit 1; }; \
	  echo "Setting secrets from $$f ..."; \
	  while IFS='=' read -r key val; do \
	    case "$$key" in ''|\#*) continue;; esac; \
	    val=$$(echo "$$val" | xargs); \
	    [ -z "$$val" ] && continue; \
	    echo "  $$key"; \
	    npx wrangler secret put "$$key" <<< "$$val"; \
	  done < "$$f"

# ─── Python CLI one-shot targets ──────────────────────────────────────

ask: ## One-shot task via Python CLI: make ask MSG="..."
	@$(ENV_LOAD); $(PY) -m marketing_agent "$(MSG)"

skill: ## One-shot with a skill: make skill NAME=copywriting MSG="..."
	@$(ENV_LOAD); $(PY) -m marketing_agent --skill $(NAME) "$(MSG)"

role: ## One-shot as a specialist role: make role NAME=seo MSG="..."
	@$(ENV_LOAD); $(PY) -m marketing_agent --role $(NAME) "$(MSG)"

roles: ## Print the role menu and exit
	@$(ENV_LOAD); $(PY) -m marketing_agent --list-roles

menu skills: ## Print the skill menu and exit
	@$(ENV_LOAD); $(PY) -m marketing_agent --list-skills

# ─── Housekeeping ─────────────────────────────────────────────────────

clean: ## Remove .venv and node_modules
	rm -rf .venv workers/backend/node_modules
