import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { changeBgColor } from "@/mastra/tools/color-change-tool";
import { MASTRA_BASE_URL } from "@/constants";

const suggestions = [
  {
    title: "Dark blue",
    action: "Change the background color to a dark blue",
  },
  {
    title: "Rebeccapurple",
    action: "Change the background color to rebeccapurple",
  },
];

const ClientAssistantUIDemo = () => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      // Defined through chatRoute() in src/mastra/index.ts
      api: `${MASTRA_BASE_URL}/chat/bgColorAgent`,
    }),
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "colorChangeTool") {
        changeBgColor((toolCall.input as { color: string }).color);
      }
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="size-full">
        <Thread
          suggestions={suggestions}
          welcome="Ask me to change the background color"
        />
      </div>
    </AssistantRuntimeProvider>
  );
};

export default ClientAssistantUIDemo;
