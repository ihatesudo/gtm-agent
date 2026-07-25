import { createGoogle } from '@ai-sdk/google';
import { createGoogleVertex } from '@ai-sdk/google-vertex';
import { createOpenAI } from '@ai-sdk/openai';

/**
 * Returns a configured AI SDK LanguageModel instance based on GENAI_PROVIDER.
 * Returning an instantiated model object completely bypasses Mastra's internal
 * ModelsDevGateway GOOGLE_API_KEY requirement.
 */
export function getAgentModel(defaultModel: string) {
  const provider = (process.env.GENAI_PROVIDER || 'openrouter').toLowerCase();
  const customModel = process.env.DIRECTOR_MODEL || process.env.SPECIALIST_MODEL || defaultModel;

  // 1. OpenRouter Provider
  if (provider === 'openrouter' || process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
    });
    const modelId = process.env.OPENROUTER_MODEL || 'openrouter/auto';
    return openrouter(modelId);
  }

  // 2. Vertex AI Provider (GCP Trial Credits via Service Account / ADC)
  if (provider === 'vertex' || process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true') {
    let googleAuthOptions;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
        const parsed = raw.startsWith('{') ? JSON.parse(raw) : undefined;
        if (parsed) {
          googleAuthOptions = { credentials: parsed };
        }
      } catch {
        // ignore JSON parse error
      }
    }

    const vertex = createGoogleVertex({
      project: process.env.GOOGLE_CLOUD_PROJECT || 'project-babe4c82-37e1-4f22-ac0',
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      googleAuthOptions,
    });
    const modelId = customModel.replace(/^(google\/|vertex\/)/, '');
    return vertex(modelId);
  }

  // 3. Fallback Google Provider
  const google = createGoogle({
    apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || 'dummy-key',
  });
  return google(customModel.replace(/^google\//, ''));
}
