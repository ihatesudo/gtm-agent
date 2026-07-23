# Changelog

## v0.2.0 (2026-07-24)

### Mastra campaign orchestrator (`mastra/`)

New TypeScript engine built on [Mastra](https://mastra.ai) — multi-turn conversations, campaign workflows, Director delegation, and cross-session project memory.

- **Multi-turn agent** with Mastra Agent + Memory (Phase 0)
- **Campaign workflow** with state tracking across plan → execute → review (Phase 1)
- **Supervisor agent** that delegates to 5 specialists (paid-search, social-ads, seo, b2b-linkedin, lifecycle-retention) (Phase 2)
- **Cross-session project memory** — stores product name, ICP, brand voice, past campaigns, key decisions (Phase 3)
- **Cloudflare deployer** ready — deploy to Workers via `@mastra/deployer-cloudflare` (Phase 4)

Default model: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` via OpenRouter (free tier).

### How to use

```bash
cd mastra
cp .env.example .env   # set OPENROUTER_API_KEY
npm run dev             # Mastra Studio at http://localhost:4111
node run.mjs            # one-shot campaign generation
```

### Notes

- The Python CLI (`marketing_agent/`) continues to work as before — two runtimes, one brain.
- Roles, skills, and playbooks remain in `roles/`, `skills/`, `tools/` — shared by both runtimes.
- See `mastra/` README section for full documentation.

---

## v0.1.0 (2026-07-??)

Initial release: Python CLI agent with LangGraph + Gemini, 7 specialist roles, 47 skill playbooks, 100+ platform integrations.
