SHELL := /bin/sh
.DEFAULT_GOAL := help

PY := uv run python
REFLEX := uv run reflex
RELEASE_ENV ?= .env.production
REFLEX_PROJECT ?=
REFLEX_PROJECT_NAME ?= Default Project
BACKEND_URL ?=
SITE_URL ?=
APPWRITE_ENDPOINT ?=
APPWRITE_PROJECT_ID ?=
PRODUCTION_BACKEND_URL := https://marketing-agent-api-ib4z.onrender.com
PRODUCTION_SITE_URL := https://6a5e450300344d9a2bb8.appwrite.network
PRODUCTION_APPWRITE_ENDPOINT := https://syd.cloud.appwrite.io/v1
PRODUCTION_APPWRITE_PROJECT_ID := 6a5e1fb200164405f869
LOCAL_APPWRITE_ENDPOINT ?= $(PRODUCTION_APPWRITE_ENDPOINT)
LOCAL_APPWRITE_PROJECT_ID ?= $(PRODUCTION_APPWRITE_PROJECT_ID)
LOCAL_PORT ?= 3001

# Load .env (Vertex/ADC + model config) if present, so you never have to
# manually `set -a; source .env; set +a` before each command.
ENV_LOAD := set -a && { [ -f .env ] && . ./.env; }; set +a

.PHONY: help setup auth env run web web-auth-local deploy release release-check release-deps release-build release-login release-project release-secrets appwrite-platform hosting-check hosting-build hosting-auth-artifact-check web-auth-test appwrite-login appwrite-init appwrite-auth-check appwrite-deploy deploy-static agent ask role skill menu roles skills clean

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
	@echo "  web-auth-local  Test Appwrite Magic Link locally at http://localhost:3001"
	@echo ""
	@echo "Appwrite Sites + Render (recommended):"
	@echo "  hosting-check   Check the backend and site URLs required for a static build"
	@echo "  hosting-build   Build the static frontend for Appwrite Sites"
	@echo "  hosting-auth-artifact-check  Verify the built Magic Link browser bridge"
	@echo "  web-auth-test   Run Magic Link deployment regression checks"
	@echo "  appwrite-login  Sign in to the Appwrite CLI"
	@echo "  appwrite-init   Create the Appwrite Sites CLI config (run once)"
	@echo "  appwrite-deploy Build and deploy the frontend (custom URLs)"
	@echo "  deploy-static   Deploy production frontend — use this command"
	@echo ""
	@echo "Legacy Reflex Cloud release:"
	@echo "  release-login    Sign in to Reflex Cloud"
	@echo "  release-project  Select the Reflex Cloud project used by release"
	@echo "  release-check    Validate $(RELEASE_ENV) without printing credentials"
	@echo "  release-deps     Sync locked dependencies and ensure pip freeze is available"
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

web-auth-local: web-auth-test ## Run a production-mode local Appwrite Magic Link test server
	@echo "Open http://localhost:$(LOCAL_PORT)/login after the server starts. Press Ctrl-C to stop it."
	@$(ENV_LOAD); APPWRITE_ENDPOINT="$(LOCAL_APPWRITE_ENDPOINT)" APPWRITE_PROJECT_ID="$(LOCAL_APPWRITE_PROJECT_ID)" REFLEX_API_URL="http://localhost:$(LOCAL_PORT)" REFLEX_DEPLOY_URL="http://localhost:$(LOCAL_PORT)" $(REFLEX) run --env prod --single-port --frontend-port "$(LOCAL_PORT)"

hosting-check: ## Validate Appwrite and public URLs for the Appwrite Sites static build
	@set -eu; \
	for pair in "BACKEND_URL=$(BACKEND_URL)" "SITE_URL=$(SITE_URL)" "APPWRITE_ENDPOINT=$(APPWRITE_ENDPOINT)"; do \
	  value=$${pair#*=}; name=$${pair%%=*}; \
	  case "$$value" in https://*) ;; *) echo "$$name must be an https URL. Example: make appwrite-deploy BACKEND_URL=https://your-api.onrender.com SITE_URL=https://your-site.appwrite.network APPWRITE_ENDPOINT=https://region.cloud.appwrite.io/v1 APPWRITE_PROJECT_ID=your-project-id"; exit 2 ;; esac; \
	done; \
	case "$(APPWRITE_PROJECT_ID)" in ''|*replace-me*|*'<project-id>'*) echo "APPWRITE_PROJECT_ID must be set."; exit 2 ;; esac; \
	echo "Static build will connect $(SITE_URL) to $(BACKEND_URL) with Appwrite project $(APPWRITE_PROJECT_ID)."

hosting-build: hosting-check ## Export the static Reflex frontend for Appwrite Sites
	@APPWRITE_ENDPOINT="$(APPWRITE_ENDPOINT)" APPWRITE_PROJECT_ID="$(APPWRITE_PROJECT_ID)" REFLEX_API_URL="$(BACKEND_URL)" REFLEX_DEPLOY_URL="$(SITE_URL)" $(REFLEX) export --frontend-only --no-zip --env prod
	@$(MAKE) hosting-auth-artifact-check
	@echo "Static site is ready in .web/build/client."

hosting-auth-artifact-check: ## Verify the exported frontend waits for the Appwrite auth bridge
	@rg -q 'window.GTMAuth = \{' .web/build/client || { echo "Missing Appwrite auth bridge in static build."; exit 2; }
	@rg -q 'GTM_APPWRITE_CONFIG' .web/build/client || { echo "Missing Appwrite public configuration in static build."; exit 2; }

web-auth-test: ## Run regression checks for the static Appwrite Magic Link flow
	@$(PY) -m unittest discover -s tests -p 'test_*.py'

appwrite-login: ## Authenticate the Appwrite CLI
	@appwrite login

appwrite-init: ## Interactively create Appwrite Sites configuration (set output directory to .web/build/client)
	@appwrite init sites
	@echo "When prompted, set the static site's output directory/path to .web/build/client."

appwrite-auth-check: ## Verify Appwrite CLI login and the Sites configuration
	@command -v appwrite >/dev/null 2>&1 || { echo "Appwrite CLI is required. Install it with: npm install -g appwrite-cli"; exit 2; }
	@appwrite whoami >/dev/null 2>&1 || { echo "Appwrite CLI is not signed in. Run: make appwrite-login"; exit 2; }
	@test -f appwrite.config.json || { echo "Missing appwrite.config.json. Run 'make appwrite-init' first."; exit 2; }

appwrite-deploy: appwrite-auth-check web-auth-test hosting-build ## Test, build, and push the configured static site
	@appwrite push sites --all --force

deploy-static: ## Build and deploy the configured production static frontend
	@$(MAKE) appwrite-deploy \
		BACKEND_URL="$(PRODUCTION_BACKEND_URL)" \
		SITE_URL="$(PRODUCTION_SITE_URL)" \
		APPWRITE_ENDPOINT="$(PRODUCTION_APPWRITE_ENDPOINT)" \
		APPWRITE_PROJECT_ID="$(PRODUCTION_APPWRITE_PROJECT_ID)"

deploy: release ## Alias for the production release workflow

release-login: ## Authenticate with Reflex Cloud
	@$(REFLEX) login

release-project: ## Select the Reflex Cloud project (override REFLEX_PROJECT or REFLEX_PROJECT_NAME)
	@$(REFLEX) cloud project select $(if $(REFLEX_PROJECT),"$(REFLEX_PROJECT)",--project-name "$(REFLEX_PROJECT_NAME)")

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
	if ! $(REFLEX) cloud project selected >/dev/null 2>&1; then \
	  echo "No Reflex Cloud project is selected. Run 'make release-project' first."; exit 2; \
	fi; \
	echo "Production credentials are configured."

release-deps: ## Sync dependencies and refresh requirements.txt in Reflex-compatible format
	@uv sync
	@$(PY) -m pip freeze > requirements.txt
	@echo "Locked dependencies are ready; requirements.txt was refreshed for Reflex Cloud."

release-build: ## Compile the production Reflex app before deploying
	@$(REFLEX) export --frontend-only --no-zip --env prod

release: release-check release-deps release-build ## Prepare, validate, build, deploy, and upload RELEASE_ENV as Reflex Cloud secrets
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
