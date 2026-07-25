import { useState } from "react";
import { MastraClient } from "@mastra/client-js";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { Loader } from "@/components/ai-elements/loader";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import { MASTRA_BASE_URL } from "@/constants";
import {
  jsonRenderRegistry,
  jsonRenderSpecSchema,
  type JsonRenderSpec,
} from "@/lib/json-render";

const client = new MastraClient({
  baseUrl: MASTRA_BASE_URL,
});

const agent = client.getAgent("json-render-agent");

const suggestions = [
  "Create a simple trip checklist for a weekend in Lagos",
  "Create a compact study plan for learning React hooks",
  "Create a recipe summary for jollof rice",
];

export default function JsonRenderPage() {
  const [input, setInput] = useState("");
  const [spec, setSpec] = useState<JsonRenderSpec | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateUi(prompt: string) {
    if (!prompt.trim() || isGenerating) {
      return;
    }

    setInput("");
    setError(null);
    setIsGenerating(true);

    try {
      const result = await agent.generate(prompt, {
        structuredOutput: {
          schema: jsonRenderSpecSchema,
          jsonPromptInjection: true,
        },
      } as never);

      const nextSpec = result.object as unknown as JsonRenderSpec | undefined;

      if (!nextSpec) {
        throw new Error("Mastra did not return a UI spec.");
      }

      setSpec(nextSpec);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "UI generation failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSubmit(message: PromptInputMessage) {
    if (!message.text) {
      return;
    }

    void generateUi(message.text);
  }

  return (
    <div className="relative mx-auto size-full max-w-4xl p-0 md:p-6">
      <div className="flex h-full flex-col gap-6">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
          Mastra generates a validated `json-render` spec with structured
          output, then the client renders that spec with `Renderer`.
        </div>

        <Suggestions>
          {suggestions.map((suggestion) => (
            <Suggestion
              key={suggestion}
              onClick={() => void generateUi(suggestion)}
              suggestion={suggestion}
            />
          ))}
        </Suggestions>

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(event) => setInput(event.target.value)}
              placeholder="Describe a small interface to generate..."
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <Button
                className="h-8"
                onClick={() => {
                  setSpec(null);
                  setError(null);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear
              </Button>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={!input && !isGenerating}
              status={isGenerating ? "streaming" : "ready"}
            />
          </PromptInputFooter>
        </PromptInput>

        <div className="min-h-80 rounded-xl border border-border/60 bg-background p-4">
          {isGenerating ? (
            <Loader />
          ) : spec ? (
            <JSONUIProvider registry={jsonRenderRegistry}>
              <Renderer registry={jsonRenderRegistry} spec={spec} />
            </JSONUIProvider>
          ) : (
            <div className="flex min-h-72 items-center justify-center text-center text-sm text-muted-foreground">
              Submit a prompt to render a generated UI here.
            </div>
          )}
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
    </div>
  );
}
