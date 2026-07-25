# Assistant UI Integration Guide for Mastra

This reference documents integrating **Assistant UI** with Mastra agents and workflows using `@mastra/ai-sdk` and `@mastra/react`, based on patterns in `docs/ui-dojo`.

---

## 1. Mastra Server Route Configuration

Mastra provides native AI SDK-compatible endpoints for Assistant UI via `@mastra/ai-sdk`. Register routes in `src/mastra/index.ts`:

```typescript
import { Mastra } from "@mastra/core/mastra";
import { chatRoute, workflowRoute, networkRoute } from "@mastra/ai-sdk";

export const mastra = new Mastra({
  agents: { ghibliAgent, weatherAgent, hitlPlanningAgent },
  workflows: { orderFulfillmentWorkflow },
  server: {
    port: 4111,
    cors: { origin: "*", allowMethods: ["*"], allowHeaders: ["*"] },
    apiRoutes: [
      // Standard AI SDK agent chat endpoint
      chatRoute({
        path: "/chat/:agentId",
        sendReasoning: true, // Enables streaming Chain-of-Thought (CoT) reasoning parts
      }),
      // Workflow execution endpoint
      workflowRoute({
        path: "/workflow/:workflowId",
        sendReasoning: true,
      }),
      // Multi-agent network endpoint
      networkRoute({
        path: "/network",
        agent: "routingAgent",
      }),
    ],
  },
});
```

---

## 2. Basic Setup with `useChatRuntime` and `AssistantChatTransport`

For standalone, single-thread applications:

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";

export default function AssistantApp() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "http://localhost:4111/chat/ghibliAgent",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-screen w-full">
        <Thread welcome="Hi! Ask me anything about Studio Ghibli movies." />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

---

## 3. Multi-Thread & Persistence Integration with `@mastra/react`

For production applications requiring chat thread history, sidebar switching, and persistent memory backed by Mastra's Memory API (`@mastra/core/memory`).

```tsx
import { useChat, toAssistantUIMessage } from "@mastra/react";
import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import { AssistantRuntimeProvider, useExternalStoreRuntime } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { useAgentMessages } from "@/hooks/use-agent-messages";

export function PersistentChat({ agentId, threadId }: { agentId: string; threadId: string }) {
  // Fetch existing messages from Mastra Memory
  const { data } = useAgentMessages({ agentId, threadId, memory: true });

  const initialMessages = data?.messages
    ? (toAISdkV5Messages(data.messages) as any[])
    : [];

  return (
    <CustomRuntimeProvider agentId={agentId} threadId={threadId} initialMessages={initialMessages}>
      <Thread welcome="Welcome back!" />
    </CustomRuntimeProvider>
  );
}

function CustomRuntimeProvider({ children, agentId, threadId, initialMessages }: any) {
  const { messages, sendMessage, cancelRun, isRunning, setMessages } = useChat({
    agentId,
    initialMessages,
  });

  const runtime = useExternalStoreRuntime({
    messages: messages.map(toAssistantUIMessage),
    isRunning,
    onNew: async (message) => {
      const text = message.content.find((c: any) => c.type === "text")?.text ?? "";
      await sendMessage({ content: text, threadId });
    },
    onCancel: async () => {
      await cancelRun();
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
```

---

## 4. Human-in-the-Loop (HITL) Tool UI with `makeAssistantToolUI`

`makeAssistantToolUI` bridges Assistant UI tool calls to interactive React widgets, allowing users to inspect parameters, toggle choices, and submit results back to Mastra.

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";
import { useState, useCallback } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Step = { description: string; status: "enabled" | "disabled" };
type Args = { steps: Step[] };
type Result = { accepted: boolean; steps: Step[] };

export const StepApprovalToolUI = makeAssistantToolUI<Args, Result>({
  toolName: "generateTaskStepsTool",
  render: function Render({ args, status, addResult }) {
    const [steps, setSteps] = useState<Step[]>(args?.steps ?? []);

    const handleConfirm = useCallback(() => {
      addResult({
        accepted: true,
        steps: steps.filter((s) => s.status === "enabled"),
      });
    }, [addResult, steps]);

    const handleReject = useCallback(() => {
      addResult({ accepted: false, steps: [] });
    }, [addResult]);

    if (!args?.steps?.length) return null;

    return (
      <Card className="p-4 my-3">
        <CardTitle className="text-lg">Approve Generated Plan</CardTitle>
        <div className="my-2 space-y-2">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={step.status === "enabled"}
                onChange={() => {
                  setSteps((prev) =>
                    prev.map((s, i) =>
                      i === idx ? { ...s, status: s.status === "enabled" ? "disabled" : "enabled" } : s
                    )
                  );
                }}
              />
              <span>{step.description}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleConfirm}>Confirm & Proceed</Button>
          <Button variant="outline" onClick={handleReject}>Reject</Button>
        </div>
      </Card>
    );
  },
});
```

---

## 5. Chain-of-Thought Reasoning Renderers

When `sendReasoning: true` is configured in Mastra's `chatRoute`, the agent streams thinking steps in real time. Assistant UI renders these via `Reasoning` (`src/components/assistant-ui/reasoning.tsx`):

```tsx
import { Reasoning } from "@/components/assistant-ui/reasoning";

// Embedded inside Thread message list:
<Thread
  components={{
    Reasoning: Reasoning,
  }}
/>
```
