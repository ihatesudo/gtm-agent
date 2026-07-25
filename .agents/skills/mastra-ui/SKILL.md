---
name: mastra-ui
description: "Mastra UI component library skill (UI Dojo, CopilotKit, Assistant UI, AI Elements, A2UI). Use when building, integrating, or customizing frontend UIs for Mastra agents and workflows, including generative UI, human-in-the-loop (HITL), BYOC json-render, A2UI catalogs, multi-thread management, and custom tool rendering."
license: Apache-2.0
metadata:
  author: Mastra
  version: "1.0.0"
---

# Mastra UI & UI Dojo Skill

Guide for integrating and building AI user interfaces for Mastra agents using **CopilotKit** (via `@ag-ui/mastra`), **Assistant UI** (via `@mastra/ai-sdk` and `@mastra/react`), **AI Elements**, and **A2UI Dynamic Schema Catalogs**, based on the reference patterns in `docs/ui-dojo`.

---

## Component Architecture & System Overview

Mastra agents communicate with frontend frameworks via standard bridge protocols:

```
                  ┌─────────────────────────────────────────┐
                  │              Mastra Server              │
                  │        (src/mastra/index.ts)            │
                  └────┬──────────────────────────────┬─────┘
                       │                              │
          registerCopilotKit()                  chatRoute() / workflowRoute()
         [@ag-ui/mastra/copilotkit]                [@mastra/ai-sdk]
                       │                              │
                       ▼                              ▼
                 AG-UI Endpoint                  AI-SDK Endpoint
             (/copilotkit, /copilotkit-om)         (/chat/:agentId)
                       │                              │
         ┌─────────────┴─────────────┐  ┌─────────────┴─────────────┐
         ▼                           ▼  ▼                           ▼
   CopilotKit Client           A2UI Dynamic     Assistant UI          AI Elements
   (@copilotkit/react-core)    Catalog Client   (@assistant-ui/react) (@ai-sdk/react)
   • CopilotChatPanel          (renderers.tsx)  • Thread              • Artifact
   • WeatherCard / BYOC                         • ThreadList          • ChainOfThought
   • TimePickerCard (HITL)                      • StepApprovalToolUI  • PromptInput
```

---

## Framework Integration Options

| Framework | Mastra Server Bridge | Client Dependencies | Key Strengths & Use Cases |
| :--- | :--- | :--- | :--- |
| **CopilotKit** | `registerCopilotKit()`, `registerCopilotKitOM()` from `@ag-ui/mastra` | `@copilotkit/react-core`, `@copilotkit/react-ui`, `@ag-ui/client` | Bidirectional state sync, frontend tool execution (`useFrontendTool`), native interrupt/resume HITL (`useInterrupt`), BYOC JSON UI rendering, A2UI catalog, Activity streaming. |
| **Assistant UI** | `chatRoute()`, `workflowRoute()` from `@mastra/ai-sdk` | `@assistant-ui/react`, `@assistant-ui/react-ai-sdk`, `@mastra/react` | Enterprise chat UX based on shadcn/ui, multi-thread sidebars, custom reasoning cards, tool fallback UI, `makeAssistantToolUI` step approval. |
| **AI Elements** | `chatRoute()` from `@mastra/ai-sdk` | `@ai-sdk/react`, `@ai-sdk/ui-utils` | Low-level composable generative primitives: artifacts, canvas, code blocks, inline citations, prompt input bars, shimmer loaders, task queues. |
| **A2UI Catalog** | `registerCopilotKit()` from `@ag-ui/mastra` | `@ag-ui/mastra/a2ui`, `@copilotkit/react-core/v2` | Schema-driven dynamic UI catalog. The server dictates UI component structures over AG-UI protocol without shipping compiled React bundles. |

---

## Detailed References & Manuals

- [`references/component-catalog.md`](references/component-catalog.md) - Full catalog of components across `components/ck`, `components/assistant-ui`, `components/ai-elements`, and `components/a2ui-catalog` with file paths and prop definitions.
- [`references/copilotkit-integration.md`](references/copilotkit-integration.md) - Deep dive into CopilotKit + AG-UI integration (Generative UI, `useInterrupt` HITL, BYOC spec rendering, Activity streams, MCP Apps).
- [`references/assistant-ui-integration.md`](references/assistant-ui-integration.md) - Deep dive into Assistant UI + AI SDK integration (CustomRuntimeProvider, `makeAssistantToolUI`, Thread persistence, Memory API hooks).

---

## Quick Reference Recipes

### 1. Register CopilotKit Bridge in Mastra Server (`src/mastra/index.ts`)

```typescript
import { Mastra } from "@mastra/core/mastra";
import { registerCopilotKit } from "@ag-ui/mastra/copilotkit";

export const mastra = new Mastra({
  agents: { weatherAgent, planningAgent },
  bundler: {
    externals: [
      "@copilotkit/runtime",
      "@copilotkit/runtime/v2",
      "@ag-ui/mastra",
      "@ag-ui/client",
    ],
  },
  server: {
    cors: { origin: "*", allowMethods: ["*"], allowHeaders: ["*"] },
    apiRoutes: [
      registerCopilotKit({
        path: "/copilotkit",
        resourceId: "copilotkit-resource",
      }),
    ],
  },
});
```

### 2. Render CopilotKit Generative Tool Card (`src/pages/copilot-kit/index.tsx`)

```tsx
import { CopilotKit } from "@copilotkit/react-core";
import { useRenderTool, useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { WeatherCard } from "@/components/ck/weather-card";
import { CopilotChatPanel } from "@/components/ck/copilot-chat-panel";

export default function App() {
  return (
    <CopilotKit runtimeUrl="http://localhost:4111/copilotkit" agent="weatherAgent">
      <Chat />
    </CopilotKit>
  );
}

function Chat() {
  useRenderTool({
    name: "get_weather",
    parameters: z.object({ location: z.string() }),
    render: ({ parameters, result, status }) => {
      if (status !== "complete") return <div>Fetching weather...</div>;
      return <WeatherCard location={parameters.location} result={result} />;
    },
  });

  return <CopilotChatPanel agentId="weatherAgent" />;
}
```

### 3. Register Assistant UI Route in Mastra Server & React Client

**Server Route:**
```typescript
import { chatRoute } from "@mastra/ai-sdk";

export const mastra = new Mastra({
  server: {
    apiRoutes: [
      chatRoute({ path: "/chat/:agentId", sendReasoning: true }),
    ],
  },
});
```

**Client Component (`src/pages/assistant-ui/index.tsx`):**
```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";

export default function AssistantApp() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "http://localhost:4111/chat/weatherAgent",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread welcome="Ask about the weather!" />
    </AssistantRuntimeProvider>
  );
}
```

### 4. Human-in-the-Loop (HITL) Approval in Assistant UI (`makeAssistantToolUI`)

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";

export const StepApprovalToolUI = makeAssistantToolUI<{ steps: Array<{ description: string }> }, { accepted: boolean }>({
  toolName: "generateTaskStepsTool",
  render: ({ args, status, addResult }) => {
    return (
      <div className="p-4 border rounded">
        <h4>Approve Plan Steps</h4>
        {args?.steps?.map((step, idx) => <p key={idx}>{step.description}</p>)}
        <button onClick={() => addResult({ accepted: true })}>Approve</button>
        <button onClick={() => addResult({ accepted: false })}>Reject</button>
      </div>
    );
  },
});
```
