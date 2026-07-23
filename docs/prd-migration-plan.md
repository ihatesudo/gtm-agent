# 📋 PRD & Migration Plan: GTM Agent UI Harmonization

**Author**: Project Manager / Lead Architect  
**Status**: Draft  
**Target**: Migrate worktree prototype look-and-feel to the main `mastra/ui` production React codebase.

---

## 1. Project Overview & Objectives

In the prototype phase, we designed a high-fidelity clone of the `manus.im` UI, rebranded as **GTM Agent**, on the Cloudflare Workers stack. However, the production orchestration UI lives in the `mastra/` workspace under [mastra/ui/](file:///Users/miczhuang/.herdr/worktrees/gtm-agent/worktree-rapid-river-e646/mastra/ui), which is a React-based TypeScript application built with Vite.

The goal of this project is to:
1. Migrate the premium layout, fonts, and dark sidebar/light main-area design system to the production React architecture.
2. Port the custom simulated desktop/sandbox logic into modular React components.
3. Establish a phased timeline to implement advanced missing features (Interactive Workflow Canvas, Voice Input, and Real-time Crawler Preview).

---

## 2. Target React Component Architecture (`mastra/ui`)

Instead of single-file CSS/HTML, we will structure the `mastra/ui` Vite app using React components.

```
mastra/ui/src/
├── main.tsx
├── App.tsx                    # Main Viewport Split-Pane state orchestrator
├── index.css                  # Tailored CSS variables & baseline resets
├── types.ts                   # Types for Session, Messages, ToolCalls
├── components/
│   ├── Sidebar.tsx            # Left Collapsible Sidebar (navigation, tasks history)
│   ├── TopHeader.tsx          # Model Dropdown, Credits indicator, user badge
│   ├── WelcomeView.tsx        # "What can I do for you?" central card & pills
│   ├── ChatPanel.tsx          # Chat thread container, typing loader, input box
│   ├── Resizer.tsx            # Mouse-drag split panel resizer component
│   └── DesktopPanel.tsx       # Simulated Window Frame (macOS traffic lights, url bar)
└── lib/
    ├── markdown.ts            # Markdown parser utility
    └── useWebSocket.ts        # Custom React hook managing streaming state
```

---

## 3. Step-by-Step Migration Phases

### 📍 Phase 1: Style Token Migration & Setup (Weeks 1)
- Copy font imports (`Instrument Serif` & `Inter`) and CSS variables from our custom [style.css](file:///Users/miczhuang/.herdr/worktrees/gtm-agent/worktree-rapid-river-e646/workers/frontend/style.css) to `mastra/ui/src/index.css`.
- **UI/UX Max Skill Color Polish**: Optimize the color palette for maximum visual quality. Avoid generic colors; use HSL-tailored tones, sleek dark shades for the sidebar, and harmonious off-white light shades for the workspace to create a highly premium, state-of-the-art visual experience.
- Set up CSS classes for layouts: `.split-pane-layout`, `.browser-window`, `.prompt-box-card`, etc.
- Integrate Tailwind configs if needed (or maintain clean custom Vanilla CSS imports inside the React bundle).

### 📍 Phase 2: Component Refactoring (Weeks 2)
- Recreate the sidebar structure in `Sidebar.tsx`. Prepopulate it with active and mock sessions from React state.
- Split the welcome page and prompt textarea into `WelcomeView.tsx`.
- Package the MacOS browser mockup as `DesktopPanel.tsx`. Add state hooks for:
  - `activeScreen`: `'idle' | 'search' | 'asset' | 'canvas'`
  - `urlAddress`: binding to the virtual Address Bar input
  - `iframeSource`: binding to the interactive IFrame `src`

### 📍 Phase 3: State & Hook Hookups (Weeks 3)
- Refactor the current `App.tsx` state to handle the WebSocket stream payloads from Mastra's server (`thought`, `tool_call`, `tool_result`, `answer`, `done`).
- When a `thought` event is received, append it to the active thinking block inside `ChatPanel.tsx`.
- Connect the **Quick Action Pills** to automatically invoke queries via the React socket connection.
- Enable `localStorage` persistence under the `gtmagent_sessions` and `gtmagent_credits` keys.

---

## 4. Feature Implementation Backlog & Roadmap

The prototype successfully mock-simulates executing web searches and iframe previews. The following missing production-level features must be implemented step-by-step:

### 🧩 1. Interactive Workflow Canvas (Milestone A)
*   **Description**: The "Web Canvas/Nodes" button on the prompt card toolbar should toggle a canvas node graph panel.
*   **Technical Spec**: 
    - Integrate `reactflow` (React Flow) library into `mastra/ui`.
    - Render a node for the user prompt, nodes for each tool execution block (`web_search`, `save_asset`), and connect them dynamically as tool events stream in.
    - Provide zoom, pan, and manual node-reordering controls.

### 🎙️ 2. Voice Input & Audio Waveform (Milestone B)
*   **Description**: Implement real-time microphone recording when clicking the Mic button, including a pulsing audio waveform.
*   **Technical Spec**:
    - Use the HTML5 `MediaRecorder` API to capture microphone inputs in chunks.
    - Bind a Canvas-based audio context visualizer to render the `.audio-wave` bar levels dynamically.
    - Forward the audio blob to the backend Gemini API for transcription, and populate the textarea with the output.

### 🔍 3. Live Browser / Crawler Mirror (Milestone C)
*   **Description**: Instead of showing DuckDuckGo scraped text mockups, display real screenshots or snapshots from the crawler in the sandbox viewport.
*   **Technical Spec**:
    - Update the backend crawler tool (`web_search`) to launch headless Playwright/Puppeteer instances.
    - Capturing page screenshots at key actions (e.g. click, scroll, fill).
    - Stream screenshots as base64 images via WebSocket `tool_result` event: `{ type: 'page_snapshot', image: 'data:image/png;base64,...' }`.
    - Render these snapshots directly in `DesktopPanel.tsx` to visualize the actual automated browser execution.

### 📂 4. Cloud Filesystem & Multi-File Editor (Milestone D)
*   **Description**: Expand the R2 asset viewer into a tabbed filesystem editor (similar to VSCode).
*   **Technical Spec**:
    - Use `monaco-editor` React package to show a full code editor for generated files (`.html`, `.js`, `.py`).
    - Let the user directly edit files inside the sandbox pane, and automatically sync edits to the R2 bucket.
    - Expose a "Terminal" tab showing serverless code compilation log outputs.

---

## 5. Risk Assessment & Mitigations

*   **Risk**: CSS collisions between the existing Mastra Studio UI and the custom GTM Agent look-and-feel.
    - *Mitigation*: Wrap all GTM Agent specific CSS selectors in a parent `#gtm-agent-root` wrapper class, or use CSS Modules to scope styling rules locally.
*   **Risk**: High asset rendering load in IFrames if websites have complex scripts.
    - *Mitigation*: Apply `sandbox="allow-scripts allow-same-origin"` parameters on the iframe viewport to prevent script hijacking and security warnings.
