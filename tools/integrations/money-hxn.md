# money-hxn — Show Me The Money (SMTM) Skill Suite

**Not a platform tool.** This is an external skill suite — 25 skills for running
a solo business end-to-end (discover → strategy → product → quality → content →
SEO → social → outreach → ads → ops → finance → diagnose), plus a 4-reviewer
council and session save/restore.

## Where it lives

```
~/tools/skills/money-hxn/
├── money/              # the router/orchestrator
├── money-discover/     # idea discovery
├── money-strategy/     # business strategy + market research
├── money-product/      # build the product
├── money-quality/      # quality gates
├── money-panel/        # 4-reviewer council orchestrator
├── money-review-investor/   # VC lens
├── money-review-customer/   # ICP lens
├── money-review-operator/   # solo-execution lens
├── money-review-skeptic/    # devil's advocate
├── money-ops/          # 24/7 autonomous operations
├── money-finance/      # revenue/expense/pricing
├── money-save/         # checkpoint business state
├── money-restore/      # resume from snapshot
├── money-report/       # merge snapshots into a report
├── money-learn/        # atomic project learnings
├── money-retro/        # weekly retrospective
├── money-content/ money-seo/ money-social/ money-ads/ money-outreach/  # channel skills
├── money-diagnose/     # deep diagnosis when stuck
├── money-skillify/     # codify a workflow into a skill
└── money-upgrade/      # update the suite
```

## How gtm-agent integrates it

Skills are **discovered externally**, not copied into `skills/`. The loader
(`marketing_agent/skills_loader.py`) merges `EXTERNAL_SKILLS_ROOTS` into the
catalogue, tagging them `external=True`. This keeps them upstream-syncable and
avoids forking.

- Native skills always win on a name collision (external is supplemental).
- In the `/skills` menu, external skills are marked `(external)`.
- Activate any of them with `/skill money-strategy`, etc.

The **`founder` role** (`roles/founder.{en,zh}.yaml`) is the SMTM orchestrator
persona — it owns the business-level skills (strategy/product/ops/finance/review
council). The marketing roles stay untouched: channel skills (seo/ads/social)
have marketing-native versions in `skills/` that are sharper for pure marketing
work.

## Syncing upstream

```bash
npm update -g @orrisai/show-me-the-money
# or, if installed by path:
cd ~/tools/skills/money-hxn && git pull
```

After updating, the new/changed skills appear automatically — no gtm-agent edit
needed (the loader re-discovers on next run / `/skills`).

## SMTM's own state directory

money-hxn keeps its business state under `~/.smtm/` (sessions, projects,
learnings, reports). This is **separate** from gtm-agent's `.sessions/`
(conversation memory + project memory). They serve different layers:
- `~/.smtm/` = business state (snapshots, validated learnings, retros)
- `.sessions/` = conversation state (multi-turn history, agent-editable memory)

The `founder` role can read both: SMTM skills manage `~/.smtm/` themselves;
gtm-agent's `remember`/`recall` tools manage `.sessions/`.
