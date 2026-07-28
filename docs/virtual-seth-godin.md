# Virtual Seth Godin — Mentor for Marketing Interns

> Goal: a software mentor that channels 24 years of Seth Godin's blog
> (9,838 posts, 2002–2026) to coach new marketing interns in his thinking, not
> just his quotes.

---

## Part 1 — What the corpus actually says

I mined the full archive (word frequency, n-grams, standalone aphorisms, and
concept counts). Here is what is *really* high-frequency, not what sounds good.

### A. The heartbeat vocabulary (top words, stopwords removed)

```
people  work  time  make  better  change  enough  simply
go  world  way  need  new  things  story  trust
```

Translation: Seth's mind runs on **agency verbs** (make, go, change, do) and
**relational nouns** (people, trust, story, world). Marketing, to him, is a verb
people do *with* each other, not a thing done *to* them.

### B. The signature refrains (sentences he repeats verbatim, 3×+)

| Refrain | Occurrences | What it encodes |
|---|---|---|
| **"People like us do things like this."** | 6× | Identity > demographics. Markets are tribes defined by shared behavior, not age/income. |
| **"No one wants to be hustled."** | 3× | Permission and trust beat interruption. |

The first is his entire theory of positioning in one sentence.

### C. The conceptual backbone (mention counts across all 9,838 posts)

These are his load-bearing ideas, ranked by how often he returns to them:

```
story/stories      2,135   ← narrative is his #1 instrument
trust              1,125   ← the asset everything else compounds on
connection           789
art/artist           875   ← marketing as a craft, not a department
permission           667   ← permission marketing (his coinage)
status               722   ← status dynamics drive all buying
ship/shipping        518   ← shipping beats perfection
tribe                472
remarkable           469
responsibility       457
purple cow           220   ← be remarkable or be invisible
generosity           214
empathy              196
freedom              253
practice             325   ← it's a practice, not a gig
the dip              247   ← strategic quitting
show up              340   ← consistency > brilliance
```

### D. His operating logic (distilled from definitional posts)

Reading the posts where he *defines* marketing (e.g. "The right marketing
question", "Eight marketing maxims"), his logic is a chain:

> **Make a change → for the right people → with a true story → that helps them
> get where they're going → that they'll tell to their peers.**

And the eight maxims, which are effectively his constitution:

1. Trust is worth more than attention.
2. Helping people get to where they seek to go > hustling them to where you're going.
3. Choose your customers, choose your future.
4. Tell ten people. If they don't tell the others, make a better product.
5. Creating the conditions for the word to spread *is the job* of the marketer.
6. Customer service is free.
7. "You'll pay a lot but get more than you paid for."
8. Act like people are watching. They are.

### E. His voice / rhetorical shape (so the mentor sounds like him, not like ChatGPT)

- Short posts. Often one idea, one page.
- Two-part rhythm: name a common belief → invert it ("The wrong question is…
  The right question is…").
- Standalone single-sentence paragraphs as punchlines.
- Concrete noun + verb, never abstract jargon. "Ship the work", "show up",
  "make things better for people who care."
- Second person ("you"), present tense, declarative.
- Ends on agency: the reader can do something *now*.

---

## Part 2 — Software design: "Virtual Seth"

The mentor's job is **not** to be a search engine over his blog. It is to make
an intern *think in his framework* before they ship a campaign.

### North star

> An intern comes with a half-formed idea ("we should run a TikTok contest").
> The mentor does not say yes/no. It runs the idea through Seth's five-link
> chain and the eight maxims, shows where the idea breaks, and assigns one
> Seth-style aphorism as the thing to remember.

### Three product surfaces (build in this order)

#### Surface 1 — Daily Quote / "Today's Seth"  (your favorite, ship first)

- A cron job picks one high-signal post per day from the corpus.
- Renders: the date it was originally written, the title, one *punchy*
  standalone sentence (the aphorism), and a one-line "what this asks of you
  today" reframing.
- Deterministic rotation weighted by concept diversity (so you don't get three
  "ship the work" days in a row) — not random.
- This is the **retention hook**. Interns open the app daily.

#### Surface 2 — The Socratic Reviewer (the core mentor)

The intern pastes in anything: a landing page, a campaign brief, ad copy, a
positioning statement. The mentor responds in a fixed **Seth lens**, not a
generic critique:

```
1. WHO IS IT FOR?      — Name the "people like us". If it's "everyone", fail.
2. WHAT CHANGE?         — Status quo → what? If none, it's not marketing, it's maintenance.
3. TRUE STORY?          — Would a user feel lied to? Trust is the only compounding asset.
4. HELPS THEM?          — Where are THEY trying to go? Or is this hustling them to where YOU go?
5. WILL THEY TELL?      — Tell ten people. If they don't tell others, the product is the problem, not the ad.
```

Each section returns: one verdict (✓ / ⚠ / ✗), one sentence of Seth-voice
reasoning, and **one citation** — a real post from the corpus (date + title +
link + the exact line) that backs the verdict. The citation is the proof that
this is *his* thinking, not the model's opinion.

This is where the corpus earns its keep: **grounding every critique in a
primary source.**

#### Surface 3 — Concept Tutor / "Ask Seth about ___"

Free chat, but scoped. The intern asks "what does Seth say about pricing?" and
gets a synthesized answer built *only* from retrieved posts, with inline
citations. Refuses to opine beyond the corpus — if Seth hasn't written about
it, it says so. This keeps the mentor honest and distinct from a generic LLM.

### How it fits your existing codebase

Your `gtm-agent` already has the perfect scaffold:

- **Roles** (`roles/*.yaml`) → add `roles/seth.yaml`. Seth becomes a 7th
  selectable persona that layers on top of the Director base prompt, exactly
  like `seo` or `social-ads`. His persona block encodes the five-link chain
  + eight maxims + voice rules from Part 1.
- **Skills** (`skills/<name>/SKILL.md`) → add `skills/seth-review/SKILL.md`
  (the Socratic reviewer playbook) and `skills/seth-quote/SKILL.md` (the daily
  quote logic).
- **The corpus becomes a knowledge base**, not prompt context. 9,838 posts is
  too big to stuff into a prompt. Build a retrieval layer (Part 3).

### What makes it "Virtual Seth" and not "ChatGPT pretending"

Three guardrails, and they matter:

1. **Citation-or-shut-up.** Every substantive claim links to a real post.
   No citation = the model is hallucinating his views. Reject it.
2. **Framework-first, answer-second.** The mentor always maps the intern's
   question onto the five-link chain before answering. This forces *his*
   structure of thinking, which is the actual lesson.
3. **Voice consistency.** A small style guide (Part 1.E) constrains output:
   short, declarative, second person, ends on a next action. No bullet-point
   dumps, no corporate hedging.

---

## Part 3 — The retrieval layer (the real engineering)

The corpus is 9,838 markdown files with clean frontmatter (title, date, url,
slug). This is the asset. Three options, increasing sophistication:

### Option A — Cheap & good: keyword + concept index (ship in a day)

- A build script reads all posts, tags each with the concepts it contains
  (from the backbone list in Part 1.C: `tribe`, `purple-cow`, `the-dip`, etc.).
- Produces `seth_index.json`: `{concept: [{title, date, url, slug, one-line}…]}`.
- The mentor retrieves by concept match, then re-ranks with the LLM.
- No embeddings, no vector DB. Surprisingly effective because Seth's vocabulary
  is *consistent* — he uses the same words for the same ideas for 24 years.

### Option B — Better: semantic embeddings (ship in a week)

- Embed every post with a small model, store in a vector store (you already
  have Mastra + Cloudflare in this repo — Vectorize fits).
- Retrieve top-k posts per intern question, pass to the mentor as grounding.
- Handles paraphrased queries ("how do I find my audience" → retrieves
  "smallest viable market" posts even without exact words).

### Option C — Best: concept-graph + embeddings hybrid

- Build a graph: posts ↔ concepts ↔ maxims. So "trust" links to 1,125 posts,
  but also to maxim #1 and to the "true story" link in the chain.
- Retrieval walks the graph: an intern question hits a concept, the graph
  surfaces the *maxim* it violates and the *best 3 posts* on that concept.
- This is what makes the mentor feel like it *understands* Seth's system,
  not just searches it.

**Recommendation: ship A first (validate interns use it), upgrade to B, then C.**

---

## Part 4 — The aphorism engine (your "daily quote" done right)

A naive daily quote = random sentence = gets stale fast. Do this instead:

1. **Mine the corpus once** for standalone punchy lines (6–18 words, single
   sentence, declarative). I already extracted these — there are hundreds.
2. **Score each** by: concept diversity (prefer ones touching underused
   concepts), recency (bias to mature-voice later posts), and "teachability"
   (does it imply a clear action?).
3. **Pair every quote with a reframing.** Not just the quote, but:
   > Quote: *"People like us do things like this."*
   > Today: Before you write any copy, name the "us". If you can't, you don't
   > have a market — you have a demographic.
4. **Rotate by concept**, not randomly, so the intern sees the whole framework
   over a quarter, not three "ship it" days in a row.

This turns a quote widget into a *curriculum*.

---

## Part 5 — MVP scope (what to build first, 3 days)

| Day | Deliverable |
|---|---|
| 1 | `scripts/build_seth_index.py` — reads corpus, emits `seth_index.json` (concepts + best aphorisms). Run it, commit the index. |
| 1 | `roles/seth.yaml` + `skills/seth-review/SKILL.md` — the persona + Socratic playbook. Test via `make role NAME=seth MSG="..."`. |
| 2 | The daily-quote job — picks from index, renders quote + reframe. Wire to cron or a slash command. |
| 2 | Citation tool — `lookup_seth_post(concept)` returns real posts; wire into the reviewer so every verdict cites a source. |
| 3 | Embedding index (Option B) if day 1–2 validates. Replace keyword retrieval. |

The MVP *is* Surface 1 + Surface 2. Surface 3 (free chat) comes after, once the
framework and voice are proven.

---

## The one-sentence pitch

> Virtual Seth doesn't quote Seth Godin at interns — it makes interns think
> through his five-link chain before they ship, and proves every critique with
> a line he actually wrote.
