import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  pickProvider,
  resolveVertexCredentials,
  resolveModelForChoice,
  getAgentModel,
} from '../mastra/model.js';

/** A valid-shaped service account object for tests (private key is fake but well-formed). */
const SA_JSON = {
  type: 'service_account',
  project_id: 'project-babe4c82-37e1-4f22-ac0',
  client_email: 'mastra-agent-sa@project-babe4c82-37e1-4f22-ac0.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIBVgIBADANBgkqhkiG9w0BAQEFAASCAUAwggE8AgEAAkEA\n-----END PRIVATE KEY-----\n',
  private_key_id: 'd40aca312a6881b3f10298f21be7aded9bb10a30',
  token_uri: 'https://oauth2.googleapis.com/token',
};

describe('pickProvider', () => {
  it('defaults to openrouter when no SA and no explicit choice', () => {
    expect(pickProvider({})).toBe('openrouter');
  });

  it('picks vertex when a service account is resolvable (burn trial credits)', () => {
    expect(pickProvider({ GOOGLE_APPLICATION_CREDENTIALS: JSON.stringify(SA_JSON) })).toBe('vertex');
  });

  it('explicit `openrouter` overrides even when a SA is present', () => {
    const env = {
      GENAI_PROVIDER: 'openrouter',
      GOOGLE_APPLICATION_CREDENTIALS: JSON.stringify(SA_JSON),
    };
    expect(pickProvider(env)).toBe('openrouter');
  });

  it('explicit `vertex` wins even with no SA configured', () => {
    expect(pickProvider({ GENAI_PROVIDER: 'vertex' })).toBe('vertex');
  });
});

describe('resolveVertexCredentials', () => {
  it('returns null when nothing is configured', () => {
    expect(resolveVertexCredentials({})).toBeNull();
  });

  it('parses inline SA JSON (deploy shape)', () => {
    const c = resolveVertexCredentials({ GOOGLE_APPLICATION_CREDENTIALS: JSON.stringify(SA_JSON) });
    expect(c?.clientEmail).toBe(SA_JSON.client_email);
    expect(c?.privateKey).toContain('BEGIN PRIVATE KEY');
    expect(c?.privateKeyId).toBe(SA_JSON.private_key_id);
  });

  it('reads a SA from a file path (local-dev shape)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sa-'));
    const file = join(dir, 'sa.json');
    writeFileSync(file, JSON.stringify(SA_JSON));
    const c = resolveVertexCredentials({ GOOGLE_APPLICATION_CREDENTIALS: file });
    expect(c?.clientEmail).toBe(SA_JSON.client_email);
  });

  it('accepts split fields (GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY)', () => {
    const c = resolveVertexCredentials({
      GOOGLE_CLIENT_EMAIL: SA_JSON.client_email,
      GOOGLE_PRIVATE_KEY: SA_JSON.private_key,
    });
    expect(c?.clientEmail).toBe(SA_JSON.client_email);
  });

  it('normalizes literal "\\n" in the PEM to real newlines', () => {
    const c = resolveVertexCredentials({
      GOOGLE_CLIENT_EMAIL: SA_JSON.client_email,
      GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nMIIB\\n-----END PRIVATE KEY-----\\n',
    });
    expect(c?.privateKey).toContain('\n');
    expect(c?.privateKey).not.toContain('\\n');
  });
});

describe('resolveModelForChoice (UI dropdown routing)', () => {
  it('returns null for undefined choice so the caller falls back to the default provider', () => {
    expect(resolveModelForChoice(undefined, {})).toBeNull();
  });

  it('builds an OpenRouter chat-completions model for "openrouter"', () => {
    const model = resolveModelForChoice('openrouter', { OPENROUTER_API_KEY: 'or-key' });
    expect(model).toBeTruthy();
    expect(model?.provider).toBe('openai.chat');
  });

  // ── OpenRouter must use a concrete :free model, never the paid `auto` alias ──
  // BUG: the "openrouter" choice mapped to `openrouter/auto`, which routes to
  // *paid* models (burns credits). The free tier requires explicit `:free`
  // model ids. This locks the contract: the resolved model id must end with
  // `:free` and must NEVER be `openrouter/auto`.
  describe('OpenRouter free-model pinning (never use the paid auto alias)', () => {
    it('the "openrouter" choice resolves to a concrete :free model (not openrouter/auto)', () => {
      const model = resolveModelForChoice('openrouter', { OPENROUTER_API_KEY: 'or-key' });
      expect(model?.modelId, 'expected a :free model id').toMatch(/:free$/);
      expect(model?.modelId).not.toBe('openrouter/auto');
    });

    it('respects OPENROUTER_MODEL override but still requires a :free model', () => {
      const model = resolveModelForChoice('openrouter', {
        OPENROUTER_API_KEY: 'or-key',
        OPENROUTER_MODEL: 'nvidia/nemotron-3-super-120b-a12b:free',
      });
      expect(model?.modelId).toBe('nvidia/nemotron-3-super-120b-a12b:free');
    });

    it('rejects a non-free OPENROUTER_MODEL override (would silently burn credits)', () => {
      // If someone sets OPENROUTER_MODEL to a paid slug like 'openrouter/auto'
      // or 'anthropic/claude-opus-5', that defeats the free-tier policy. We
      // throw rather than silently route to a paid model.
      expect(() =>
        resolveModelForChoice('openrouter', {
          OPENROUTER_API_KEY: 'or-key',
          OPENROUTER_MODEL: 'openrouter/auto',
        }),
      ).toThrow(/free|:free/i);
    });
  });

  it('builds a GLM (Zhipu) chat-completions model for "glm"', () => {
    const model = resolveModelForChoice('glm', { ZHIPU_API_KEY: 'test-key' });
    expect(model).toBeTruthy();
    expect(model?.provider).toBe('openai.chat');
  });

  it('builds a Vertex provider for "gemini-flash" when a SA is configured', () => {
    const model = resolveModelForChoice('gemini-flash', {
      GOOGLE_APPLICATION_CREDENTIALS: JSON.stringify(SA_JSON),
      GOOGLE_CLOUD_PROJECT: SA_JSON.project_id,
    });
    expect(model).toBeTruthy();
  });

  it('THROWS for "gemini-*" when no SA is configured — no silent AI Studio fallback', () => {
    // This is the policy guaranteeee: Gemini is reachable ONLY via service account.
    expect(() => resolveModelForChoice('gemini-flash', {})).toThrow(/service account/i);
  });
});

describe('getAgentModel (fallback path also pins a free model)', () => {
  it('never falls back to openrouter/auto — the OpenRouter default model is a concrete :free id', () => {
    // No SA, no role-specific vars, no OPENROUTER_MODEL → must pick the
    // default free model, NOT openrouter/auto.
    const model = getAgentModel('director', 'gemini-2.5-flash') as { modelId?: string };
    expect(model?.modelId).toBeTruthy();
    expect(model?.modelId, 'fallback must not be the paid auto alias').not.toBe('openrouter/auto');
    expect(model?.modelId).toMatch(/:free$/);
  });
});
