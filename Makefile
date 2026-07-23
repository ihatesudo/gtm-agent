SHELL := /bin/sh
.DEFAULT_GOAL := help

PY := uv run python
WRK := cd workers/backend
ENV_LOAD := set -a && { [ -f .env ] && . ./.env; }; set +a

.PHONY: help setup auth env run agent ask role skill menu roles skills clean \
        web-dev web-deploy web-secrets

help: ## Show this help
	@echo "Usage: make <target>"
	@echo ""
	@echo "Python CLI (development):"
	@echo "  setup     Install/sync Python dependencies (uv sync)"
	@echo "  auth      First-time: gcloud auth application-default login"
	@echo "  env       Print active env vars (masked)"
	@echo "  run       Interactive REPL"
	@echo "  ask       One-shot task:           make ask MSG=\"3 headlines\""
	@echo "  role      One-shot as a role:      make role NAME=seo MSG=\"...\""
	@echo "  skill     One-shot with a skill:   make skill NAME=copywriting MSG=\"...\""
	@echo "  roles     Print role menu and exit"
	@echo "  menu      Print skill menu and exit"
	@echo "  skills    Alias for 'menu'"
	@echo ""
	@echo "Cloudflare Workers (deployment):"
	@echo "  web-dev      Run the Workers dev server locally (port 8787)"
	@echo "  web-deploy   Generate data + deploy to Cloudflare Workers"
	@echo "  web-secrets  Batch-set wrangler secrets from .env: make web-secrets [ENV_FILE=path]"
	@echo ""
	@echo "Housekeeping:"
	@echo "  clean     Remove .venv and build artifacts"

setup: ## Install/sync Python dependencies
	uv sync

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

web-dev: ## Run the Workers dev server at http://localhost:8787
	@$(WRK) && npm run dev

web-deploy: ## Deploy to Cloudflare Workers
	@$(WRK) && npm run deploy
	@echo "Deployed! Set secrets: make web-secrets"

web-secrets: ## Batch-set wrangler secrets from .env: make web-secrets [ENV_FILE=path]
	@$(WRK) && \
	  f="${ENV_FILE:-../../.env}"; \
	  [ -f "$$f" ] || { echo "ERROR: $$f not found"; exit 1; }; \
	  echo "Setting secrets from $$f ..."; \
	  while IFS='=' read -r key val; do \
	    case "$$key" in ''|\#*) continue;; esac; \
	    val=$$(echo "$$val" | xargs); \
	    [ -z "$$val" ] && continue; \
	    echo "  $$key"; \
	    npx wrangler secret put "$$key" <<< "$$val"; \
	  done < "$$f"

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

clean: ## Remove .venv and node_modules
	rm -rf .venv workers/backend/node_modules
