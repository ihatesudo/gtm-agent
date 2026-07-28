# money-hxn Integration Plan

## What money-hxn is

A 25-skill autonomous-business suite (`/Users/miczhuang/tools/skills/money-hxn/`)
distributed as `@orrisai/show-me-the-money` (SMTM). It's a **full-stack solo-
founder operating system**: discover ideas → strategy → product → quality →
content → SEO → social → outreach → ads → ops → finance → diagnose, with a
4-reviewer council (panel), session save/restore, learnings, and retros.

## The core tension (and how I resolve it)

money-hxn is **broader than marketing** — it covers product building, finance,
ops, code quality, and business strategy. Our `gtm-agent` is a **marketing agent**.
If I dump all 25 skills under the Director role, the agent loses its identity:
it stops being "the growth team" and becomes "a generic business assistant."
That violates the brief: **不要窜味，失去自己的品味** (don't blur the flavor, lose
your own taste).

**Resolution: a new `founder` role, not a skill dump.**

money-hxn is a *different persona* — the solo founder running the whole business,
of which marketing is one department. So:

- The **existing 8 roles stay marketing-focused** (Director + 6 specialists + Seth). Untouched.
- A **new `founder` role** is added, whose persona IS the SMTM orchestrator. It
  owns the money-hxn skills the way `seo` owns SEO skills.
- money-hxn skills are discovered from their **external path**
  (`/Users/miczhuang/tools/skills/money-hxn/`), NOT copied into `skills/`. This
  keeps them upstream-syncable and avoids forking.

## Skill → role mapping (by category)

| money-hxn skill | Category | Maps to |
|---|---|---|
| money-discover, money-strategy, money-diagnose | strategy | **founder** (business-level, not channel) |
| money-product, money-quality | product | **founder** (building, not marketing) |
| money-ops, money-finance, money-save, money-restore, money-report, money-learn, money-retro, money-skillify, money-upgrade | ops/meta | **founder** (operations/state) |
| money-content | content | existing **content** / copywriting overlap — founder can invoke, but it's a shared skill |
| money-seo | seo | existing **seo** role overlap |
| money-social | social | existing **social-ads** role overlap |
| money-ads | ads | existing **paid-search**/**social-ads** overlap |
| money-outreach | outreach | existing **b2b-linkedin** overlap |
| money-panel + 4 reviewers | review | **founder** (the council is a business-level gate, not a marketing tactic) |

**The principle:** channel-execution skills (ads/seo/social/outreach/content) have
*marketing-native* versions already in `skills/`. The money-hxn versions are
broader/business-typed but marketing-thinner. So for those, the existing role
wins; the founder can still call money-hxn's for business-type-aware context.
The **strategy/product/ops/review** skills are net-new capability → they go to `founder`.

## Architecture: external skill discovery

money-hxn lives outside the repo. Rather than copy 25 skills into `skills/`
(which forks them and breaks upstream sync), add a **secondary skill root**:

```python
# skills_loader.py — add EXTERNAL_SKILLS_DIR
EXTERNAL_SKILLS_ROOTS = [
    Path.home() / "tools/skills/money-hxn",   # SMTM suite
]
```

`list_skills()` discovers from both `skills/` (native) and external roots.
External skills get a `(external)` tag in the menu so they're visually distinct.
`load_skill_body()` resolves by name across both roots (native wins on collision).

This is a ~30-line change to `skills_loader.py` and respects the existing
"skill = a SKILL.md in a dir" contract.

## The `founder` role (new)

```yaml
# roles/founder.en.yaml
role:
  name: founder
  title: "Solo Founder (SMTM orchestrator)"
  persona: |
    You are a solo founder running an autonomous business — not just its marketing.
    You think in the full SMTM pipeline: discover → strategy → product → quality →
    content → SEO → social → outreach → ads → ops → finance. You run the 4-person
    review council (investor/customer/operator/skeptic) before shipping anything
    consequential. You save state between sessions.
    ... (the Standard Skill Startup + Value Quantification contract)
  owned_skills: [money-discover, money-strategy, money-diagnose, money-product,
                  money-quality, money-panel, money-review-investor,
                  money-review-customer, money-review-operator, money-review-skeptic,
                  money-ops, money-finance, money-save, money-restore, money-report,
                  money-learn, money-retro]
  shared_skills: [money-content, money-seo, money-social, money-ads, money-outreach]
  when_to_use: |
    Use when the question is about the whole business — not just a marketing channel.
    Idea validation, business strategy, product decisions, financial modeling,
    the review council, or running the full pipeline. For pure marketing execution
    (write ad copy, technical SEO audit), switch to the matching specialist.
```

A matching `founder.zh.yaml` mirrors it in Chinese.

## What NOT to do

- **Don't merge money-hxn skills into the Director.** The Director is the growth
  lead; the founder is the CEO. Different jobs. Merging blurs both.
- **Don't copy the skills into `skills/`.** They'd drift from upstream. Discover
  them externally.
- **Don't auto-activate money-hxn for marketing questions.** The channel overlap
  is intentional — the marketing-native skills are sharper for marketing work.

## Build steps (when you approve)

1. Add external skill discovery to `skills_loader.py` (~30 lines + a test).
2. Create `roles/founder.{en,zh}.yaml`.
3. Add a `tools/integrations/money-hxn.md` note documenting the external path +
   how to sync (`npm update -g @orrisai/show-me-the-money`).
4. Test: `make skills` shows both native + `(external)` money-hxn skills;
   `make role NAME=founder` loads the orchestrator persona.

## Open question for you

The money-hxn skills use `~/.smtm/` for their own session state (snapshots,
learnings). Our new session/memory layer uses `.sessions/`. Should the `founder`
role bridge these (read/write SMTM state), or keep them separate? My lean:
**separate** — our memory is conversation-level; SMTM's is business-state.
But if you want the founder to auto-load `~/.smtm/projects/{slug}/learnings.jsonl`
into context, that's a clean add to `_compose_prompt`.
