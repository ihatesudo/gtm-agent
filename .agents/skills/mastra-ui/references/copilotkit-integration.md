# CopilotKit & AG-UI Integration Guide for Mastra

This reference documents integrating **CopilotKit** and the **AG-UI protocol** with Mastra agents based on `docs/ui-dojo`.

---

## 1. Mastra Server Configuration

To expose Mastra agents to CopilotKit, register the AG-UI copilotkit route helper in your Mastra server config (`src/mastra/index.ts`).

```typescript
import { Mastra } from "@mastra/core/mastra";
import { registerCopilotKit } from "@ag-ui/mastra/copilotkit";
import { registerCopilotKitOM } from "./copilotkit-om-route";

export const mastra = new Mastra({
  agents: { weatherAgent, planningAgent, hitlAgent },
  bundler: {
    // CRITICAL: Exclude runtime packages from server bundle to prevent 500 build errors
    externals: [
      "@copilotkit/runtime",
      "@copilotkit/runtime/v2",
      "@ag-ui/mastra",
      "@ag-ui/client",
      "@ag-ui/core",
    ],
  },
  server: {
    port: 4111,
    cors: { origin: "*", allowMethods: ["*"], allowHeaders: ["*"] },
    apiRoutes: [
      registerCopilotKit({
        path: "/copilotkit",
        resourceId: "copilotkit-resource",
      }),
      // Observational Memory activity stream route
      registerCopilotKitOM({
        path: "/copilotkit-om",
        resourceId: "copilotkit-resource-om",
        observationalMemory: ["ck_observational_memory"],
      }),
    ],
  },
});
```

---

## 2. Basic CopilotKit Setup in React / Next.js

```tsx
import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChatPanel } from "@/components/ck/copilot-chat-panel";

export default function App() {
  return (
    <CopilotKit runtimeUrl="http://localhost:4111/copilotkit" agent="weatherAgent">
      <CopilotChatPanel agentId="weatherAgent" />
    </CopilotKit>
  );
}
```

---

## 3. Generative UI with `useRenderTool`

Render bespoke React cards whenever a Mastra agent executes a specific tool.

```tsx
import { useRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { WeatherCard } from "@/components/ck/weather-card";

function Chat() {
  useRenderTool({
    name: "get_weather",
    parameters: z.object({ location: z.string() }),
    render: ({ parameters, result, status }) => {
      if (status !== "complete") {
        return <div className="text-sm text-muted-foreground">Fetching weather...</div>;
      }
      return <WeatherCard location={parameters.location} result={result} />;
    },
  });

  return <CopilotChatPanel agentId="weatherAgent" />;
}
```

---

## 4. Frontend Tools with `useFrontendTool`

Allow the Mastra agent to execute actions directly inside the browser environment.

```tsx
import { useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

function Chat() {
  useFrontendTool({
    name: "change_background",
    description: "Change CSS background style of the page",
    parameters: z.object({
      background: z.string().describe("CSS background value"),
    }),
    handler: async ({ background }) => {
      document.body.style.background = background;
      return { status: "success", message: `Background set to ${background}` };
    },
  });

  return <CopilotChatPanel agentId="bgAgent" />;
}
```

---

## 5. Native Human-in-the-Loop (HITL) with `useInterrupt`

Mastra tools can call `suspend()` to pause agent execution and wait for human decision. CopilotKit intercepts the suspend outcome via `useInterrupt` and resumes the agent when `resolve()` is called.

**Mastra Server Tool (`schedule_meeting.ts`):**
```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const scheduleMeetingTool = createTool({
  id: "schedule_meeting",
  description: "Schedules a meeting with approval",
  inputSchema: z.object({ topic: z.string(), attendee: z.string() }),
  execute: async ({ context, suspend }) => {
    // Pause execution and send payload to frontend
    return await suspend({
      suspendPayload: { topic: context.topic, attendee: context.attendee },
    });
  },
});
```

**Frontend HITL Component (`human-in-the-loop.tsx`):**
```tsx
import { useInterrupt } from "@copilotkit/react-core/v2";
import { TimePickerCard } from "@/components/ck/time-picker-card";

function ChatContent() {
  useInterrupt({
    agentId: "ck_interrupt",
    renderInChat: true,
    render: ({ event, resolve }) => {
      const parsed = typeof event.value === "string" ? JSON.parse(event.value) : event.value;
      const payload = parsed?.suspendPayload ?? {};

      return (
        <TimePickerCard
          topic={payload.topic ?? "Meeting"}
          attendee={payload.attendee}
          onPick={(slot) => resolve({ chosen_time: slot.iso, chosen_label: slot.label })}
          onCancel={() => resolve({ cancelled: true })}
        />
      );
    },
  });

  return <CopilotChatPanel agentId="ck_interrupt" />;
}
```

---

## 6. BYOC Declarative JSON Spec Rendering (`@json-render/react`)

Allows Mastra agents to emit declarative JSON UI schemas (`render_ui`) that render dynamically via `@json-render/react` without requiring per-response React code compilation.

```tsx
import { useRenderTool } from "@copilotkit/react-core/v2";
import { byocSpecSchema, ByocSpecView } from "@/components/ck/byoc-spec-view";

function Chat() {
  useRenderTool({
    name: "render_ui",
    parameters: byocSpecSchema,
    render: ({ parameters, result, status }) => {
      const spec = parameters ?? result;
      if (status !== "complete" && !byocSpecSchema.safeParse(spec).success) {
        return <div className="text-sm text-muted-foreground">Building UI…</div>;
      }
      return <ByocSpecView spec={spec} />;
    },
  });

  return <CopilotChatPanel agentId="ck_byoc" />;
}
```

---

## 7. Dynamic A2UI Schema Catalog Integration

```tsx
import { CopilotKit } from "@copilotkit/react-core";
import { dynamicSchemaCatalog } from "@/components/a2ui-catalog";

export default function A2UIDemo() {
  return (
    <CopilotKit
      runtimeUrl="http://localhost:4111/copilotkit"
      agent="ck_a2ui_dynamic_schema"
      a2ui={{ catalog: dynamicSchemaCatalog }}
    >
      <CopilotChatPanel agentId="ck_a2ui_dynamic_schema" />
    </CopilotKit>
  );
}
```

---

## 8. Custom Activity Message Renderers (Background Tasks & Memory)

```tsx
import { CopilotKit } from "@copilotkit/react-core";
import { backgroundTaskRenderer } from "@/components/ck/background-task-card";
import { observationalMemoryRenderer } from "@/components/ck/observational-memory-card";

export default function App() {
  return (
    <CopilotKit
      runtimeUrl="http://localhost:4111/copilotkit-bg"
      agent="ck_background_tasks"
      renderActivityMessages={[backgroundTaskRenderer, observationalMemoryRenderer]}
    >
      <CopilotChatPanel agentId="ck_background_tasks" />
    </CopilotKit>
  );
}
```
