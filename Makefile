.PHONY: setup hello interact agent clean help

# Default: show available targets
help:
	@echo "Available targets:"
	@echo "  setup    Install/sync dependencies via uv"
	@echo "  hello    Run hello.py (generate_content)"
	@echo "  interact Run interact.py (Interactions API)"
	@echo "  agent    Run the LangGraph marketing agent (interactive REPL)"
	@echo "  clean    Remove the venv and build artifacts"

# Always run scripts through `uv run` so the project venv (google-genai>=2.10)
# is used instead of the system Python, which may have an older SDK.

setup:
	uv sync

hello:
	uv run python hello.py

interact:
	uv run python interact.py

agent:
	uv run python -m marketing_agent

clean:
	rm -rf .venv
