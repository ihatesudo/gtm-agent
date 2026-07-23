# UI Harmonization — Migrate Prototype Look-and-Feel to `mastra/ui`

**Date:** 2026-07-24
**Status:** Draft
**Target:** Port the dark-sidebar + light-main-area design system, component structure, and interaction patterns from `workers/frontend/` (prototype) into the production React UI at `mastra/ui/`.

---

## Problem Statement

The GTM Agent currently has two UI codebases: a full-featured HTML/CSS/JS prototype at `workers/frontend/` with a premium dark-sidebar + light-main-area design, and a minimal production React UI at `mastra/ui/` that uses a basic dark-only theme with inline styles, missing the WelcomeView, DesktopPanel, task history, thinking blocks, tool call visualization, and resizable split pane. Users interacting with `make mastra-test` see a bare chat interface that does not convey the product's polish or capabilities.

## Solution

Migrate the prototype's design system and component structure into `mastra/ui/` piece by piece, each piece wired to the real Mastra backend (no fake data). Every change is tested first (TDD). Deliver in small, independently shippable commits.

## User Stories

1. As a user opening the GTM Agent, I want to see a polished welcome screen with "What can I do for you?" and quick-action pills, so that I immediately understand what the agent can do and can start a task with one click.
2. As a user with an active conversation, I want to see a dark collapsible sidebar listing my conversation history, so that I can navigate between past sessions without losing context.
3. As a user reading an agent response, I want to see the agent's thinking/reasoning in a collapsible accordion block, so that I can understand how the agent arrived at its answer while keeping the main view clean.
4. As a user watching the agent work, I want to see tool calls (web_search, save_asset) rendered as visual blocks with status, so that I know what the agent is doing in real time.
5. As a user in the chat view, I want to see messages rendered with clear role indicators (user vs assistant), a streaming cursor while the agent is responding, and a typing indicator when the agent is reasoning, so that the conversation state is always clear.
6. As a user composing a prompt, I want a bottom-anchored input bar with a toolbar (attach files, toggle desktop view, microphone, submit), so that all actions are in one predictable location.
7. As a user who wants to see the agent's live browser actions, I want a simulated desktop/browser panel with traffic-light controls and an address bar, so that I can visually follow what the agent is doing on the web.
8. As a user managing multiple projects, I want the sidebar to show a project/agent switcher and navigation menu (New Task, Agent Settings, Plugins, Scheduled Tasks, Library), so that I can access the full feature set without memorizing commands.
9. As a user resizing the chat and desktop panels, I want a draggable split-pane divider, so that I can allocate screen space based on what I'm focused on.
10. As a returning user, I want my conversation history, agent preference, and credit balance to persist across browser sessions via localStorage, so that I don't lose my work when I close the tab.

## Implementation Decisions

### Incremental delivery order (TDD, small commits)

Each phase is delivered as one or more small commits. Every commit includes the tests first, then the implementation.

**Phase 1 — Design tokens + CSS foundation** (~1 commit)
- Copy font imports (`Instrument Serif`, `Inter`) and CSS custom properties from `workers/frontend/style.css` into `mastra/ui/src/index.css`
- Set up the dual-theme: dark sidebar (`#141416`), light main-area (`#fafafb`), black accent (`#09090b`)
- Keep existing component inline styles working during transition; CSS class names are additive
- **Test**: Vitest test that checks the CSS custom properties are defined on `:root` (snapshot test)

**Phase 2 — WelcomeView + prompt bar** (~1 commit)
- New `WelcomeView.tsx`: central card with "What can I do for you?" heading (Instrument Serif), prompt textarea, toolbar buttons (attachments, Web Canvas toggle, GTM Desktop toggle, mic, submit), quick-action pills, carousel
- Wire the submit button to the real `sendMessageStream()` API — no fake data
- Wire quick-action pills to send predefined prompts to the same API
- **Test**: RTL test that WelcomeView renders the heading and pills; pressing a pill calls the onSend callback with the correct prompt text

**Phase 3 — Sidebar expansion** (~1 commit)
- Expand `Sidebar.tsx` to show: navigation menu items (New Task, Agent, Plugins, Scheduled, Library), conversation history list (loaded from Mastra threads API), project/agent config dropdowns, user profile area
- Wire conversation history to real Mastra thread API (`GET /api/threads` or equivalent) — no fake data
- **Test**: RTL test that sidebar renders nav items; clicking an item triggers the correct navigation callback

**Phase 4 — ChatView: thinking blocks + tool calls** (~1 commit)
- Add collapsible reasoning accordion to assistant messages when `reasoning-delta` events arrive
- Add tool call visualization: show `web_search` and `save_asset` calls as expandable blocks with input/output
- Wire to real SSE stream events — the `reasoning-delta` and tool call events from Mastra are already verified working
- **Test**: RTL test that a message with reasoning renders as an accordion; tool call blocks appear for tool events

**Phase 5 — Resizable split pane + DesktopPanel** (~1 commit)
- New `Resizer.tsx`: draggable divider between chat and desktop panels
- New `DesktopPanel.tsx`: macOS-style window frame with traffic-light buttons, address bar, viewport area
- Wire the desktop panel to real agent tool output when available (e.g. URL navigation, page snapshots)
- **Test**: RTL test that DesktopPanel renders with window frame; dragging the resizer triggers onResize callback

**Phase 6 — TopHeader + localStorage persistence** (~1 commit)
- New `TopHeader.tsx`: model selector dropdown, credits indicator, user badge
- Persist sessions, agent preference, credits to `localStorage` under `gtmagent_*` keys
- Restore state on app mount
- **Test**: RTL test that TopHeader renders model selector; localStorage read/write cycle preserves state

### Data philosophy

- **No fake/mock data in production code.** Every piece of rendered data must come from the real Mastra backend — agents list from `GET /api/agents`, threads from `GET /api/threads` (or equivalent), streaming responses from `POST /api/agents/{id}/stream`.
- **Tests use real API calls where feasible** (the live smoke test pattern from `smoke-test.mjs`). Component-level tests use Vitest + React Testing Library with minimal stubbing only at the `fetch` boundary.
- The `ai` and `@ai-sdk/react` packages currently in `package.json` are unused and should be removed.

### SSE event contract (from Mastra backend, confirmed working)

```typescript
// All events are data: lines with JSON payload — NO event: headers
data: {"type":"start","runId":"...","payload":{"id":"director","messageId":"..."}}
data: {"type":"reasoning-delta","payload":{"id":"...","text":"reasoning text chunk"}}
data: {"type":"reasoning-end","payload":{"id":"...","providerMetadata":{...}}}
data: {"type":"text-start","payload":{"id":"..."}}
data: {"type":"text-delta","payload":{"id":"...","text":"response text chunk"}}
data: {"type":"text-end","payload":{"id":"..."}}
data: {"type":"step-finish","payload":{...}}
data: {"type":"finish","payload":{...}}
data: [DONE]
```

### Component tree (target)

```
App
├── TopHeader          (model selector, credits, user)
├── Sidebar            (nav menu, conversation history, config, user profile)
├── main-area (flex:1)
│   ├── WelcomeView    (shown when no active conversation)
│   │   ├── prompt card (heading + textarea + toolbar + submit)
│   │   └── quick-action pills + carousel
│   └── SplitPane      (shown when active conversation)
│       ├── Resizer    (draggable divider)
│       ├── ChatView   (messages list + bottom input bar)
│       │   ├── messages
│       │   │   ├── user message
│       │   │   └── assistant message
│       │   │       ├── reasoning accordion (collapsible)
│       │   │       ├── tool call block (expandable)
│       │   │       └── text content
│       │   └── input bar (textarea + toolbar + submit)
│       └── DesktopPanel (simulated browser window)
│           ├── traffic-light buttons
│           ├── address bar
│           └── viewport (iframe or content area)
```

## Testing Decisions

### What makes a good test

- **Test external behavior, not implementation details.** Test what the user sees and does, not internal state or prop drilling.
- **SSE parser tests** are the foundation: verify that every event type in the contract above produces the correct callback output. Already partially done in `smoke-test.mjs`; port to Vitest.
- **Component tests** verify: component renders, user interaction triggers callbacks, conditional content appears/disappears based on props.
- **E2E test** (Playwright): boot the Mastra server, open the custom UI in a headless browser, send a message, verify response text appears in the chat view. This is the highest-value single test.

### What will be tested

| Test | Location | Tool | Description |
|------|----------|------|-------------|
| SSE parser | `mastra/ui/src/__tests__/api.test.ts` | Vitest | Port from `smoke-test.mjs`: all event types, [DONE], error, non-JSON, finish without text |
| Sidebar | `mastra/ui/src/__tests__/Sidebar.test.tsx` | Vitest + RTL | Renders agent list, select triggers callback |
| WelcomeView | `mastra/ui/src/__tests__/WelcomeView.test.tsx` | Vitest + RTL | Renders heading + pills, pill click sends correct prompt |
| ChatView | `mastra/ui/src/__tests__/ChatView.test.tsx` | Vitest + RTL | Renders messages, streaming cursor, reasoning accordion, tool call blocks |
| DesktopPanel | `mastra/ui/src/__tests__/DesktopPanel.test.tsx` | Vitest + RTL | Renders window frame, address bar updates |
| TopHeader | `mastra/ui/src/__tests__/TopHeader.test.tsx` | Vitest + RTL | Renders model selector, credits |
| E2E | `mastra/ui/e2e/smoke.spec.ts` | Playwright | Boot server, open UI, send message, verify response |
| CSS design tokens | `mastra/ui/src/__tests__/design-tokens.test.ts` | Vitest | CSS custom properties defined on `:root` |

### Prior art

`mastra/ui/scripts/smoke-test.mjs` already has SSE parser tests and a live server test. The Vitest equivalents should follow the same test patterns but in the standard test runner. No existing Vitest tests exist yet — this spec creates the first ones.

## Out of Scope

- Voice input / audio waveform (Milestone B from the PRD backlog)
- Interactive Workflow Canvas with React Flow (Milestone A)
- Live browser mirror with Playwright/Puppeteer backend (Milestone C)
- Cloud Filesystem / Monaco editor (Milestone D)
- CSS Modules or Tailwind integration — stick with vanilla CSS + CSS variables for now
- Any backend changes to the Mastra server or agents

## Further Notes

- The prototype at `workers/frontend/` is the reference implementation. When porting a component, read the prototype first to extract the interaction logic, then reimplement as a React component wired to real API calls.
- The SSE event contract has been verified against the running Mastra server (see `smoke-test.mjs` live test — 13/13 passed). No backend changes are needed for the SSE format.
- Each commit must pass `npm run test:smoke` (offline) before being committed.
