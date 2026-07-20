# The Reflex backend is a normal Python web service. Render supplies PORT at runtime.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uv run --no-sync reflex run --env prod --backend-only --backend-port \"${PORT:-8000}\""]
