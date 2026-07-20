SHELL := /bin/sh
.DEFAULT_GOAL := help

PY := uv run python
REFLEX := uv run reflex
RELEASE_ENV ?= .env.production
REFLEX_PROJECT ?=

# Load .env (Vertex/ADC + model config) if present, so you never have to
# manually `set -a; source .env; set +a` before each command.
ENV_LOAD := set -a && { [ -f .env ] && . ./.env; }; set +a

.PHONY: help setup auth env run web deploy release release-check release-build release-login release-secrets appwrite-platform agent ask role skill menu roles skills clean

help: ## Show this help
	@echo "Usage: make <target>  (extra args: MSG=\"...\" NAME=<role|skill>)"
	@echo ""
	@echo "  setup     Install/sync dependencies (uv sync)"
	@echo "  auth      First-time: gcloud application-default login (enables Vertex)"
	@echo "  env       Print the active model/Auth env (masked) for sanity-check"
	@echo ""
	@echo "Running the agent:"
	@echo "  run       Interactive REPL (role/skill menu + /commands)"
	@echo "  web       Run the deployable Reflex web app locally"
	@echo "  release-login    Sign in to Reflex Cloud"
	@echo "  release-check    Validate $(RELEASE_ENV) without printing credentials"
	@echo "  release-build    Compile the production Reflex app"
	@echo "  release          Validate, build, upload credentials, and deploy"
	@echo "  release-secrets  Update credentials on an existing Reflex Cloud app"
	@echo "  appwrite-platform Print the hostname to add in Appwrite after deployment"
	@echo "  agent     Alias for 'run'"
	@echo "  ask       One-shot task:           make ask MSG=\"write 3 headlines\""
	@echo "  role      One-shot as a role:      make role NAME=seo MSG=\"...\""
	@echo "  skill     One-shot with a skill:   make skill NAME=copywriting MSG=\"...\""
	@echo ""
	@echo "Browsing roles & skills:"
	@echo "  roles     Print the role menu and exit"
	@echo "  menu      Print the skill menu and exit"
	@echo "  skills    Alias for 'menu'"
	@echo ""
	@echo "Housekeeping:"
	@echo "  clean     Remove .venv and build artifacts"

setup: ## Install/sync dependencies via uv
	uv sync

auth: ## Application Default Credentials for Vertex AI (run once)
	@gcloud auth application-default login && echo "ADC ready."

env: ## Print active model/Auth env vars (masked)
	@$(ENV_LOAD); \
	for v in GENAI_PROVIDER OPENROUTER_MODEL OPENROUTER_API_KEY APPWRITE_ENDPOINT APPWRITE_PROJECT_ID GEMINI_MODEL GEMINI_API_KEY; do \
	  val=$$(printenv $$v); \
	  if [ -n "$$val" ]; then printf "  %-28s %.6s…\n" "$$v" "$$val"; \
	  else printf "  %-28s (unset)\n" "$$v"; fi; \
	done

run agent: ## Interactive REPL
	@$(ENV_LOAD); $(PY) -m marketing_agent

web: ## Run the Reflex web app locally
	@$(ENV_LOAD); uv run reflex run

deploy: release ## Alias for the production release workflow

release-login: ## Authenticate with Reflex Cloud
	@$(REFLEX) login

release-check: ## Validate required production credentials without exposing them
	@set -eu; \
	if [ ! -f "$(RELEASE_ENV)" ]; then \
	  echo "Missing $(RELEASE_ENV). Copy .env.sample to $(RELEASE_ENV) and fill it in."; exit 2; \
	fi; \
	set -a; . "./$(RELEASE_ENV)"; set +a; \
	for v in GENAI_PROVIDER OPENROUTER_API_KEY OPENROUTER_MODEL APPWRITE_ENDPOINT APPWRITE_PROJECT_ID; do \
	  value=$$(printenv "$$v" 2>/dev/null || true); \
	  case "$$value" in \
	    ''|*replace-me*|*'<region>'*|*'<project-id>'*) echo "Missing or placeholder value: $$v"; exit 2 ;; \
	  esac; \
	done; \
	if [ "$$GENAI_PROVIDER" != "openrouter" ]; then \
	  echo "GENAI_PROVIDER is '$$GENAI_PROVIDER'; set GENAI_PROVIDER=openrouter in $(RELEASE_ENV)."; exit 2; \
	fi; \
	echo "Production credentials are configured."

release-build: ## Compile the production Reflex app before deploying
	@$(REFLEX) export --frontend-only --no-zip --env prod

release: release-check release-build ## Deploy production app and upload RELEASE_ENV as Reflex Cloud secrets
	@$(REFLEX) deploy --envfile "$(RELEASE_ENV)" $(if $(REFLEX_PROJECT),--project "$(REFLEX_PROJECT)")

release-secrets: release-check ## Update the secrets of an already deployed Reflex Cloud app
	@$(REFLEX) cloud secrets update --envfile "$(RELEASE_ENV)" --reboot

appwrite-platform: ## Print the deployed hostname to register as an Appwrite Web platform
	@if [ -z "$(APP_URL)" ]; then \
	  echo "Usage: make appwrite-platform APP_URL=https://your-app.reflex.run"; exit 2; \
	fi; \
	echo "Add this hostname in Appwrite → Project → Add platform → Web:"; \
	printf '%s\n' "$(APP_URL)" | sed 's|https\?://||; s|/.*||'

ask: ## One-shot task: make ask MSG="..."
	@$(ENV_LOAD); $(PY) -m marketing_agent "$(MSG)"

skill: ## One-shot with a skill: make skill NAME=copywriting MSG="..."
	@$(ENV_LOAD); $(PY) -m marketing_agent --skill $(NAME) "$(MSG)"

role: ## One-shot as a specialist role: make role NAME=seo MSG="..."
	@$(ENV_LOAD); $(PY) -m marketing_agent --role $(NAME) "$(MSG)"

roles: ## Print the role menu and exit
	@$(ENV_LOAD); $(PY) -m marketing_agent --list-roles

menu skills: ## Print the skill menu and exit
	@$(ENV_LOAD); $(PY) -m marketing_agent --list-skills

clean: ## Remove the venv and build artifacts
	rm -rf .venv
