# Mastra UI Component Catalog & Reference

This document maps all UI components, patterns, and schema catalog elements in `docs/ui-dojo`.

---

## Directory Structure & Component Categories

```
src/components/
├── ck/                        # CopilotKit (AG-UI) Generative UI & Card Components
├── assistant-ui/              # Assistant UI Chat Thread & Tool Components
├── ai-elements/               # AI Elements Low-level Generative Primitives
├── a2ui-catalog/              # Dynamic Schema Catalog & Renderer Registry
└── ui/                        # Atomic Design System (shadcn/ui primitives)
```

---

## 1. CopilotKit Component Suite (`src/components/ck/`)

| File Path | Component Name | Description & Usage | Key Props / State |
| :--- | :--- | :--- | :--- |
| `ck/copilot-chat-panel.tsx` | `CopilotChatPanel` | Full-height drop-in chat wrapper for CopilotKit with customized header and layout styles. | `agentId: string`, `containerStyle?: React.CSSProperties`, `containerClassName?: string` |
| `ck/weather-card.tsx` | `WeatherCard` | Generative UI card displaying city weather, temperature (°C/°F), humidity, wind, and conditions. Used inside `useRenderTool("get_weather")`. | `location?: string`, `result: unknown` |
| `ck/time-picker-card.tsx` | `TimePickerCard` | Human-in-the-loop interactive date/time selector card. Invoked inside `useInterrupt` to resolve suspended Mastra agent execution. | `topic?: string`, `attendee?: string`, `onPick: (slot: { iso: string; label: string }) => void`, `onCancel: () => void` |
| `ck/calculator-card.tsx` | `CalculatorCard` | Interactive calculator widget rendered for math/calculator tool calls. Displays expression, result, and keypad. | `expression?: string`, `result?: number \| string`, `status?: string` |
| `ck/activity-card.tsx` | `ActivityCard` | Generative UI card for activity suggestions with ratings, categories, duration, and interactive booking button. | `activity: ActivityItem`, `onBook?: (id: string) => void` |
| `ck/agent-step-card.tsx` | `AgentStepCard` | Step-by-step progress visualizer for workflow runs and multi-step agents. Shows completed, in-progress, and pending steps. | `steps: Step[]`, `title?: string`, `status?: "running" \| "complete" \| "error"` |
| `ck/tool-call-card.tsx` | `ToolCallCard` | Generic visualizer for active and completed Mastra tool calls with collapsible JSON input/output inspector. | `name: string`, `parameters: unknown`, `result?: unknown`, `status: string` |
| `ck/observational-memory-card.tsx` | `ObservationalMemoryCard`, `observationalMemoryRenderer` | Custom activity message renderer for Mastra Observational Memory sessions. Shows user preferences and memory updates inline. | `activity: ActivityMessage` |
| `ck/background-task-card.tsx` | `BackgroundTaskCard`, `backgroundTaskRenderer` | Custom activity message renderer for asynchronous background tasks. Displays status spinner, progress, and final task outcome. | `activity: ActivityMessage` |
| `ck/shared-recipe-card.tsx` | `SharedRecipeCard` | Interactive recipe card demonstrating shared bidirectional state between agent and React frontend via `useSharedState`. | `recipe: Recipe`, `onUpdate: (recipe: Recipe) => void` |
| `ck/recipe-assistant-popup.tsx` | `RecipeAssistantPopup` | Floating `CopilotPopup` helper tuned for recipe modification and kitchen assistance. | `agentId?: string` |
| `ck/byoc-spec-view.tsx` | `ByocSpecView`, `byocSpecSchema` | Bring-Your-Own-Component declarative JSON spec renderer powered by `@json-render/react`. Renders server-driven JSON specs. | `spec: JsonRenderSpec` |
| `ck/byoc-json-render.tsx` | `ByocJsonRender` | Component registry for `json-render` mapping JSON node types (`card`, `metric`, `badge`, `list`) to React components. | `node: JsonNode` |
| `ck/empty-chat-disclaimer.tsx` | `EmptyChatDisclaimer` | Compact disclaimer banner shown in empty chat views regarding AI generation boundaries. | None |

---

## 2. Assistant UI Component Suite (`src/components/assistant-ui/`)

| File Path | Component Name | Description & Usage | Key Props / State |
| :--- | :--- | :--- | :--- |
| `assistant-ui/thread.tsx` | `Thread` | Main chat view container built on `@assistant-ui/react`. Features auto-scroll, message stream rendering, and suggestion chips. | `welcome?: string`, `suggestions?: Suggestion[]`, `agentName?: string` |
| `assistant-ui/thread-list.tsx` | `ThreadList`, `ThreadListSkeleton` | Sidebar navigation component for listing, switching, and deleting chat threads backed by Mastra Memory API. | `threads: StorageThreadType[]`, `threadId: string`, `onDelete: (id: string) => void` |
| `assistant-ui/reasoning.tsx` | `Reasoning` | Collapsible card displaying AI reasoning/Chain-of-Thought (CoT) reasoning parts with timing indicators and scroll locking. | `part: ReasoningPart` |
| `assistant-ui/attachment.tsx` | `Attachment` | File, image, and document attachment preview and upload bar component for multi-modal messages. | `attachments: Attachment[]`, `onRemove: (id: string) => void` |
| `assistant-ui/markdown-text.tsx` | `MarkdownText` | Custom GFM markdown parser with syntax-highlighted code blocks, copy buttons, and LaTeX math support. | `content: string` |
| `assistant-ui/tool-fallback.tsx` | `ToolFallback` | Fallback card container for displaying unhandled tool call inputs and outputs cleanly in Assistant UI. | `toolCall: ToolCall` |
| `assistant-ui/tooltip-icon-button.tsx` | `TooltipIconButton` | Accessible icon button wrapper with integrated tooltip for quick chat action controls. | `tooltip: string`, `icon: ReactNode`, `onClick: () => void` |
| `assistant-ui/tools/step-approval-tool-ui.tsx` | `StepApprovalToolUI` | Interactive Human-in-the-Loop tool UI created with `makeAssistantToolUI`. Allows toggling plan steps and approving/rejecting. | `toolName: "generateTaskStepsTool"` |

---

## 3. AI Elements Primitives (`src/components/ai-elements/`)

AI Elements provides unstyled, accessible UI components for building generative AI apps with `@ai-sdk/react`:

- `artifact.tsx`: Container for side-by-side artifact rendering (code, markdown, preview canvas).
- `chain-of-thought.tsx`: Step-by-step reasoning view with status spinners.
- `code-block.tsx`: Multi-language code editor/viewer with line highlighting and copy actions.
- `inline-citation.tsx`: Text citations linking responses to retrieved RAG documents/sources.
- `loader.tsx` & `shimmer.tsx`: Skeleton and shimmer loading states for streaming responses.
- `message.tsx` & `response.tsx`: Message bubble primitives with avatar and metadata.
- `plan.tsx` & `task.tsx`: Structured execution plan and task checklist cards.
- `prompt-input.tsx`: Rich multi-modal prompt bar with stop button, attachment menu, and auto-expanding textarea.
- `web-preview.tsx`: Live iframe sandbox for web artifacts generated by agent tools.

---

## 4. A2UI Dynamic Schema Catalog (`src/components/a2ui-catalog/`)

The A2UI catalog enables server-driven UI synthesis over the AG-UI protocol:

- `apis.ts`: API definitions and type definitions for dynamic schema components (`Card`, `Metric`, `Badge`, `Table`, `Grid`).
- `renderers.tsx`: `dynamicSchemaCatalog` registry mapping A2UI schema payloads to custom styled React components.
- `index.ts`: Export hub for `dynamicSchemaCatalog` used in `<CopilotKit a2ui={{ catalog: dynamicSchemaCatalog }}>`.
