SHELL := /bin/sh
.DEFAULT_GOAL := help

PY := uv run python

# Load .env (Vertex/ADC + model config) if present, so you never have to
# manually `set -a; source .env; set +a` before each command.
ENV_LOAD := set -a && { [ -f .env ] && . ./.env; }; set +a

.PHONY: help setup auth env run agent ask role skill menu roles skills clean

help: ## Show this help
	@echo "Usage: make <target>  (extra args: MSG=\"...\" NAME=<role|skill>)"
	@echo ""
	@echo "  setup     Install/sync dependencies (uv sync)"
	@echo "  auth      First-time: gcloud application-default login (enables Vertex)"
	@echo "  env       Print the active Gemini/Google env (masked) for sanity-check"
	@echo ""
	@echo "Running the agent:"
	@echo "  run       Interactive REPL (role/skill menu + /commands)"
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

env: ## Print active Gemini/Google env vars (masked)
	@$(ENV_LOAD); \
	for v in GENAI_PROVIDER GOOGLE_GENAI_USE_VERTEXAI GEMINI_MODEL GOOGLE_CLOUD_PROJECT GOOGLE_CLOUD_LOCATION GEMINI_API_KEY; do \
	  val=$$(printenv $$v); \
	  if [ -n "$$val" ]; then printf "  %-28s %s\n" "$$v" "$${val:0:6}…"; \
	  else printf "  %-28s (unset)\n" "$$v"; fi; \
	done

run agent: ## Interactive REPL
	@$(ENV_LOAD); $(PY) -m marketing_agent

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
