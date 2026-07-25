import { resolveVertexCredentials } from './model.js';

export type ProviderName = 'openrouter' | 'google' | 'vertex';

export interface ProviderState {
  configured: boolean;
  reachable: boolean;
  error?: string;
}

export interface ConnectivityResult {
  active: ProviderName;
  providers: Record<ProviderName, ProviderState>;
  checkedAt: number;
}

type Env = Record<string, string | undefined>;

const TIMEOUT_MS = 5000;

/** Merge request-scoped Worker bindings over process.env. */
function mergeEnv(envSource: Record<string, unknown> = {}): Env {
  const env: Env = {};
  for (const [k, v] of Object.entries(process.env)) env[k] = v as string | undefined;
  for (const [k, v] of Object.entries(envSource)) {
    if (typeof v === 'string') env[k] = v;
  }
  return env;
}

/** Must mirror getAgentModel's provider selection exactly. */
export function detectActiveProvider(env: Env): ProviderName {
  const provider = (env.GENAI_PROVIDER || 'openrouter').toLowerCase();
  if (provider === 'openrouter' || env.OPENROUTER_API_KEY) return 'openrouter';
  if (provider === 'vertex' || env.GOOGLE_GENAI_USE_VERTEXAI === 'true') return 'vertex';
  return 'google';
}

async function checkOpenRouter(key?: string): Promise<ProviderState> {
  if (!key) return { configured: false, reachable: false };
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // GET /key returns the key's limit/usage metadata — no tokens consumed.
    if (res.ok) return { configured: true, reachable: true };
    return { configured: true, reachable: false, error: `HTTP ${res.status} ${res.statusText}`.trim() };
  } catch (e) {
    return { configured: true, reachable: false, error: errMsg(e) };
  }
}

async function checkGoogle(key?: string): Promise<ProviderState> {
  if (!key) return { configured: false, reachable: false };
  try {
    // listModels is free and does not consume generation tokens.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (res.ok) return { configured: true, reachable: true };
    return { configured: true, reachable: false, error: `HTTP ${res.status} ${res.statusText}`.trim() };
  } catch (e) {
    return { configured: true, reachable: false, error: errMsg(e) };
  }
}

function checkVertex(env: Env): ProviderState {
  const expressKey = env.GOOGLE_VERTEX_API_KEY; // Express mode (API key, no SA)
  const creds = resolveVertexCredentials(env); // SA JSON or split fields
  const project = env.GOOGLE_CLOUD_PROJECT || env.GOOGLE_VERTEX_PROJECT;

  if (!expressKey && !creds) return { configured: false, reachable: false };
  // SA mode needs a project; Express mode (API key) does not.
  if (!expressKey && !project) {
    return { configured: true, reachable: false, error: 'GOOGLE_CLOUD_PROJECT missing' };
  }
  // We intentionally do NOT run an independent token exchange here: the /edge
  // provider signs the SA JWT with WebCrypto, and duplicating that signing in
  // the health check isn't worth it. Treat credentials-present as optimistically
  // reachable; the first real generation request surfaces any auth failure via
  // the UI onError path.
  return { configured: true, reachable: true };
}

/** Vertex is configured if either Express key or SA fields are present. */
function vertexConfigured(env: Env): boolean {
  return !!(env.GOOGLE_VERTEX_API_KEY || resolveVertexCredentials(env));
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message || 'unknown error';
  return String(e);
}

/**
 * Probe ONLY the active provider's reachability with a free metadata call.
 * Other providers are reported as configured-only (no token spend on probes
 * the user won't actually use).
 */
export async function runConnectivityCheck(envSource: Record<string, unknown> = {}): Promise<ConnectivityResult> {
  const env = mergeEnv(envSource);
  const active = detectActiveProvider(env);

  const openrouterKey = env.OPENROUTER_API_KEY;
  const googleKey = env.GOOGLE_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY;

  const openrouter = active === 'openrouter' ? await checkOpenRouter(openrouterKey) : { configured: !!openrouterKey, reachable: false };
  const google = active === 'google' ? await checkGoogle(googleKey) : { configured: !!googleKey, reachable: false };
  const vertex = active === 'vertex' ? checkVertex(env) : { configured: vertexConfigured(env), reachable: false };

  return { active, providers: { openrouter, google, vertex }, checkedAt: Date.now() };
}

// --- Lazy + TTL cache: Workers have no startup hook, so the first status
// request triggers the probe and the result is reused for `ttlMs`.
let cached: ConnectivityResult | null = null;
let cacheTs = 0;
let inflight: Promise<ConnectivityResult> | null = null;

export async function getCachedConnectivity(envSource: Record<string, unknown> = {}, ttlMs = 60000): Promise<ConnectivityResult> {
  if (cached && Date.now() - cacheTs < ttlMs) return cached;
  if (!inflight) {
    inflight = runConnectivityCheck(envSource)
      .then((r) => {
        cached = r;
        cacheTs = Date.now();
        return r;
      })
      .catch((err) => {
        const degraded: ConnectivityResult = {
          active: 'openrouter',
          providers: {
            openrouter: { configured: false, reachable: false, error: errMsg(err) },
            google: { configured: false, reachable: false },
            vertex: { configured: false, reachable: false },
          },
          checkedAt: Date.now(),
        };
        cached = degraded;
        cacheTs = Date.now();
        return degraded;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Test hook: clear the cache between checks. */
export function _resetConnectivityCache() {
  cached = null;
  cacheTs = 0;
  inflight = null;
}
