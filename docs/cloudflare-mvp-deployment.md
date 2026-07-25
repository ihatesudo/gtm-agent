# Cloudflare MVP deployment

This is the smallest production-shaped deployment for a marketing teammate. It serves the custom chat UI and the Mastra API from the same Worker, keeps conversations and project memory in Turso, and stores generated assets in R2.

## One-time setup

1. Install dependencies with `cd mastra && npm install`.
2. Authenticate Wrangler: `cd mastra && npx wrangler login`.
3. Create the two R2 buckets once:
   ```sh
   cd mastra
   npx wrangler r2 bucket create gtm-agent-assets
   npx wrangler r2 bucket create gtm-agent-assets-preview
   ```
4. Create a Turso database and copy its URL and auth token.
5. Provision the application schema (safe to run repeatedly):
   ```sh
   make mastra-db-bootstrap
   ```
6. Upload secrets from the terminal (they are never placed in `wrangler.json`):
   ```sh
   make mastra-secrets
   ```
   Required values are `GEMINI_API_KEY`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN`.

## Validate and deploy

```sh
make mastra-deploy-dry-run
make mastra-deploy
```

The build generates `mastra/.mastra/output/wrangler.json`; deployment deliberately uses this generated configuration so the Mastra Cloudflare entrypoint, static UI, Browser Run binding, and R2 binding are deployed together.

## MVP access

For a single marketing teammate, use the Worker URL after deployment. Before inviting more people, protect that hostname with Cloudflare Access (Google or GitHub login) and allow only the intended email addresses. This keeps the POC simple while avoiding a public endpoint that can spend Gemini credits.

## What is intentionally deferred

- Direct execution of third-party marketing actions (Resend, Ahrefs, GA4) remains out of the first POC. The agent can research and produce plans/copy; connect each action API as a reviewed `fetch()` tool before enabling it.
- Token credit accounting and replay files are the next iteration. They need a user identity supplied by Cloudflare Access, so they should ship together rather than as a partial anonymous-credit system.
