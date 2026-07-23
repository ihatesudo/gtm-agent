import type { ProviderConfig } from './types';
import providersData from './data/providers.json';

const providers: ProviderConfig[] = providersData as ProviderConfig[];

export function listProviders(): ProviderConfig[] {
  return providers;
}

export function findProvider(query: string): ProviderConfig | undefined {
  const q = query.toLowerCase().trim();
  let exact = providers.find(p => p.name === q);
  if (exact) return exact;
  let hits = providers.filter(p => p.name.startsWith(q));
  return hits.length === 1 ? hits[0] : undefined;
}
