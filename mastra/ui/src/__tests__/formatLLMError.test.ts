import { describe, it, expect } from 'vitest';
import { formatLLMError } from '../lib/api';

describe('formatLLMError', () => {
  it('classifies depleted credits / quota', () => {
    expect(formatLLMError('RESOURCE_EXHAUSTED: quota depleted')).toMatch(/Depleted Credits/);
    expect(formatLLMError({ error: { message: 'insufficient_funds' } })).toMatch(/Depleted Credits/);
  });

  it('classifies 429 rate limiting', () => {
    expect(formatLLMError('HTTP 429 too_many_requests')).toMatch(/Rate Limited/);
  });

  it('classifies 401/403 auth errors', () => {
    expect(formatLLMError('Unauthorized: invalid_api_key')).toMatch(/Authentication Error/);
    expect(formatLLMError('permission_denied')).toMatch(/Authentication Error/);
  });

  it('classifies stream-corruption errors (unusable) as Stream Interrupted, not 5xx', () => {
    // undici throws this when a Response body is consumed twice — the bug
    // behind the original "TypeError: unusable" leaking to the UI.
    const out = formatLLMError(new TypeError('unusable'));
    expect(out).toMatch(/Stream Interrupted/);
    expect(out).not.toMatch(/Upstream Provider Outage/);
    expect(out).not.toMatch(/TypeError/);
  });

  it('classifies upstream 5xx as Provider Outage', () => {
    expect(formatLLMError('HTTP 503 service unavailable')).toMatch(/Upstream Provider Outage/);
    expect(formatLLMError('overloaded')).toMatch(/Upstream Provider Outage/);
    expect(formatLLMError('fetch failed')).toMatch(/Upstream Provider Outage/);
  });

  it('surfaces unknown errors verbatim without leaking "[object Object]"', () => {
    expect(formatLLMError('something weird')).toMatch(/something weird/);
    expect(formatLLMError({})).not.toMatch(/\[object Object\]/);
  });
});
