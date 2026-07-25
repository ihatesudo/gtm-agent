import { readFileSync } from 'node:fs';
// IMPORTANT: use the /edge subpath. The main entry routes service-account auth
// through `google-auth-library`, which signs the JWT with Node's
// `crypto.createSign` — unavailable in the Cloudflare Workers V8 isolate
// (workerd#3172). The /edge build signs with WebCrypto (`crypto.subtle`),
// which works in both Node 18+ and Workers.
import { createGoogleVertex } from '@ai-sdk/google-vertex/edge';
import { createOpenAI } from '@ai-sdk/openai';

export type AgentRole = 'director' | 'specialist';

/**
 * Runtime model choice, selected in the UI and forwarded via requestContext.
 * Each key maps to a concrete provider instance (see resolveModelForChoice).
 */
export type ModelChoice = 'gemini-flash' | 'gemini-pro' | 'openrouter' | 'glm';

/**
 * Resolve the model id for a given role. Director and Specialist each read
 * their OWN env var, so the two roles never compete for the same fallback
 * chain. `defaultModel` only applies when the role-specific var is absent.
 */
function resolveModelId(role: AgentRole, defaultModel: string, env: NodeJS.ProcessEnv): string {
  if (role === 'director') return (env.DIRECTOR_MODEL as string) || defaultModel;
  return (env.SPECIALIST_MODEL as string) || defaultModel;
}

export interface VertexCredentials {
  clientEmail: string;
  privateKey: string;
  privateKeyId?: string;
}

/** Shell-sourced .env leaves literal "\n" in the PEM; normalize to real newlines. */
function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n');
}

/**
 * Resolve Vertex service-account fields from env. Service account is the ONLY
 * accepted Vertex auth shape — AI Studio / Express API keys are intentionally
 * NOT supported, so the project always burns GCP trial credits via SA auth.
 *
 * Accepts three shapes (no .env rewrite required when switching between them):
 *   1. Inline SA JSON in GOOGLE_APPLICATION_CREDENTIALS — deploy shape, works
 *      in both Node dev and Cloudflare Workers.
 *   2. File path in GOOGLE_APPLICATION_CREDENTIALS — local-dev convenience
 *      (Node only; Workers can't touch the filesystem).
 *   3. Separate fields GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_PRIVATE_KEY_ID.
 * Returns null when none yield both required fields.
 */
export function resolveVertexCredentials(env: Record<string, string | undefined> = process.env): VertexCredentials | null {
  const raw = (env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  let clientEmail: string | undefined;
  let privateKey: string | undefined;
  let privateKeyId: string | undefined;

  if (raw.startsWith('{')) {
    // Inline SA JSON (deploy shape — works in Node and Workers).
    try {
      const parsed = JSON.parse(raw);
      clientEmail = parsed.client_email;
      privateKey = parsed.private_key;
      privateKeyId = parsed.private_key_id;
    } catch {
      // fall through to the file-path / split-field forms
    }
  } else if (raw) {
    // File path (local-dev convenience — Node only). In Cloudflare, set
    // GOOGLE_APPLICATION_CREDENTIALS to the inline JSON instead.
    try {
      const parsed = JSON.parse(readFileSync(raw, 'utf8'));
      clientEmail = parsed.client_email;
      privateKey = parsed.private_key;
      privateKeyId = parsed.private_key_id;
    } catch {
      // fall through to the split-field form
    }
  }

  clientEmail = clientEmail || env.GOOGLE_CLIENT_EMAIL;
  privateKey = privateKey || env.GOOGLE_PRIVATE_KEY;
  privateKeyId = privateKeyId || env.GOOGLE_PRIVATE_KEY_ID;

  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey: normalizePrivateKey(privateKey), privateKeyId };
}

/**
 * Pick the default provider. `GENAI_PROVIDER` overrides explicitly (`vertex` or
 * `openrouter`); when unset, the choice is DYNAMIC — burn GCP trial credits via
 * service account if one is configured, otherwise fall back to the OpenRouter
 * free tier. So `.env` does not need to pin GENAI_PROVIDER: drop a SA in and
 * Vertex is used automatically; remove it and you're back on OpenRouter.
 */
export type DefaultProvider = 'vertex' | 'openrouter';
export function pickProvider(env: Record<string, string | undefined> = process.env): DefaultProvider {
  const explicit = (env.GENAI_PROVIDER || '').toLowerCase();
  if (explicit === 'vertex') return 'vertex';
  if (explicit === 'openrouter') return 'openrouter';
  return resolveVertexCredentials(env) ? 'vertex' : 'openrouter';
}

/**
 * Returns a configured AI SDK LanguageModel instance. `role` picks Director vs
 * Specialist model independently — no shared fallback chain. Provider selection
 * is dynamic via `pickProvider` (SA present → Vertex/trial credits; else
 * OpenRouter). Returning an instantiated model object bypasses Mastra's
 * internal ModelsDevGateway string-ModelRouter gateway.
 */
export function getAgentModel(role: AgentRole, defaultModel: string) {
  const env = process.env;
  const provider = pickProvider(env);
  const customModel = resolveModelId(role, defaultModel, env);

  // Vertex AI — burn GCP trial credits via service account. The ONLY path to
  // Gemini models; AI Studio / Express API keys are intentionally unsupported.
  if (provider === 'vertex') {
    const modelId = customModel.replace(/^(google\/|vertex\/)/, '');
    return createVertexProvider(env)(modelId);
  }

  // 2. Default: OpenRouter (free-tier models). One key (OPENROUTER_API_KEY) is enough.
  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY || '',
  });
  // Role-specific model wins; otherwise the shared OPENROUTER_MODEL; else auto.
  const roleModel = role === 'director' ? env.DIRECTOR_MODEL : env.SPECIALIST_MODEL;
  const modelId = roleModel || env.OPENROUTER_MODEL || 'openrouter/auto';
  return openrouter(modelId);
}

// ─── Provider factories (reused by getAgentModel and resolveModelForChoice) ┤

/**
 * Vertex AI via /edge (WebCrypto JWT, Worker-compatible). Service account is
 * the ONLY accepted auth — AI Studio / Express API keys are rejected by design,
 * so trial credits are always burned through SA auth. Throws if no SA JSON is
 * configured for the chosen provider.
 */
function createVertexProvider(env: Record<string, string | undefined> = process.env) {
  const googleCredentials = resolveVertexCredentials(env);
  if (!googleCredentials) {
    throw new Error(
      'Vertex AI requires a service account. Set GOOGLE_APPLICATION_CREDENTIALS to the SA JSON ' +
        '(inline object for deploy, or a file path for local dev). AI Studio / Express API keys ' +
        'are intentionally NOT supported — the project burns GCP trial credits via SA auth only.',
    );
  }
  return createGoogleVertex({
    project: env.GOOGLE_CLOUD_PROJECT || env.GOOGLE_VERTEX_PROJECT || 'project-babe4c82-37e1-4f22-ac0',
    location: env.GOOGLE_CLOUD_LOCATION || env.GOOGLE_VERTEX_LOCATION || 'us-central1',
    googleCredentials,
  });
}

/** OpenAI-compatible OpenRouter. */
function createOpenRouterProvider(env: Record<string, string | undefined> = process.env) {
  return createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY || '',
  });
}

/**
 * Zhipu GLM via the Coding Plan OpenAI-compatible endpoint.
 * Domestic (open.bigmodel.cn) by default; override with ZHIPU_BASE_URL.
 */
function createZhipuProvider(env: Record<string, string | undefined> = process.env) {
  return createOpenAI({
    baseURL: env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/coding/paas/v4',
    apiKey: env.ZHIPU_API_KEY || '',
  });
}

/**
 * Resolve a UI-selected ModelChoice to a concrete provider instance.
 * Returns null when choice is absent/unknown — caller falls back to
 * getAgentModel(role, default). This is what makes the UI dropdown work:
 * the agent.model function reads the choice from requestContext and returns
 * the matching instance, so the request never falls through to Mastra's
 * string-based ModelRouter gateway.
 */
export function resolveModelForChoice(
  choice: ModelChoice | undefined,
  env: Record<string, string | undefined> = process.env,
) {
  switch (choice) {
    case 'gemini-flash':
      return createVertexProvider(env)('gemini-2.5-flash');
    case 'gemini-pro':
      return createVertexProvider(env)('gemini-2.5-pro');
    case 'openrouter':
      return createOpenRouterProvider(env)('openrouter/auto');
    case 'glm':
      return createZhipuProvider(env)('glm-5.2');
    default:
      return null;
  }
}

/**
 * Agent `model` resolver: picks the provider instance from the UI's runtime
 * choice (threaded through requestContext), falling back to the role's default
 * provider/model when no choice is present. Used as the `model` field on every
 * agent so the dropdown actually switches the model at request time.
 */
export function modelFromChoice(role: AgentRole, defaultModel: string) {
  return async ({ requestContext }: { requestContext?: { get: (key: string) => unknown } }) => {
    const choice = requestContext?.get('modelChoice') as ModelChoice | undefined;
    return resolveModelForChoice(choice) ?? getAgentModel(role, defaultModel);
  };
}
