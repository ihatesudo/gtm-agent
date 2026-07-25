import { createGoogle } from '@ai-sdk/google';
import { createGoogleVertex } from '@ai-sdk/google-vertex';
import { createOpenAI } from '@ai-sdk/openai';

export type AgentRole = 'director' | 'specialist';

/**
 * Resolve the model id for a given role. Director and Specialist each read
 * their OWN env var, so the two roles never compete for the same fallback
 * chain. `defaultModel` only applies when the role-specific var is absent.
 */
function resolveModelId(role: AgentRole, defaultModel: string, env: NodeJS.ProcessEnv): string {
  if (role === 'director') return (env.DIRECTOR_MODEL as string) || defaultModel;
  return (env.SPECIALIST_MODEL as string) || defaultModel;
}

/**
 * Parse inline JSON service-account credentials from GOOGLE_APPLICATION_CREDENTIALS.
 * A bare file path is returned as undefined so the SDK falls back to ADC in Node
 * (file reads aren't possible inside a Cloudflare Worker).
 */
export function resolveGoogleCredentials(env: Record<string, string | undefined> = process.env) {
  const raw = (env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (!raw || !raw.startsWith('{')) return undefined;
  try {
    return { credentials: JSON.parse(raw) };
  } catch {
    return undefined;
  }
}

/**
 * Returns a configured AI SDK LanguageModel instance based on GENAI_PROVIDER.
 * `role` picks Director vs Specialist model independently — no more shared
 * fallback chain. Returning an instantiated model object bypasses Mastra's
 * internal ModelsDevGateway GOOGLE_API_KEY requirement.
 */
export function getAgentModel(role: AgentRole, defaultModel: string) {
  const env = process.env;
  const provider = (env.GENAI_PROVIDER || 'openrouter').toLowerCase();
  const customModel = resolveModelId(role, defaultModel, env);

  // 1. OpenRouter Provider
  if (provider === 'openrouter' || env.OPENROUTER_API_KEY) {
    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: env.OPENROUTER_API_KEY || '',
    });
    // Role-specific model wins; otherwise the shared OPENROUTER_MODEL; else auto.
    const roleModel = role === 'director' ? env.DIRECTOR_MODEL : env.SPECIALIST_MODEL;
    const modelId = roleModel || env.OPENROUTER_MODEL || 'openrouter/auto';
    return openrouter(modelId);
  }

  // 2. Vertex AI Provider (GCP Trial Credits via Service Account / ADC)
  if (provider === 'vertex' || env.GOOGLE_GENAI_USE_VERTEXAI === 'true') {
    const vertex = createGoogleVertex({
      project: env.GOOGLE_CLOUD_PROJECT || 'project-babe4c82-37e1-4f22-ac0',
      location: env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      googleAuthOptions: resolveGoogleCredentials(env),
    });
    const modelId = customModel.replace(/^(google\/|vertex\/)/, '');
    return vertex(modelId);
  }

  // 3. Fallback Google Provider
  const google = createGoogle({
    apiKey: env.GOOGLE_API_KEY || env.GEMINI_API_KEY || 'dummy-key',
  });
  return google(customModel.replace(/^google\//, ''));
}
