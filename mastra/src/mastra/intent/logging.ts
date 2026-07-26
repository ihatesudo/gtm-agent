/**
 * Routing observability: records each intent classification + Director
 * routing decision. Best-effort — logging never breaks the request.
 *
 * The `write` callback is injected so this is unit-testable with a spy and
 * pluggable for production (console only, or console + an intent_log table).
 * Whatever happens, the decision is mirrored to console so it shows up in the
 * dev server log for debugging.
 */
import type { Intent } from './classifier.js';

export interface RoutingDecisionInput {
  threadId: string;
  userText: string;
  decision: Intent;
  /** Optional: which tool/agent the Director actually invoked (filled later). */
  routedTo?: string;
}

export interface RoutingDecisionRecord extends RoutingDecisionInput {
  intent: string;
  delegateTo?: string;
  createdAt: string;
}

export interface RoutingLoggerOptions {
  /** Persistence callback (e.g. insert into an intent_log table). Best-effort. */
  write?: (record: RoutingDecisionRecord) => Promise<void> | void;
}

/**
 * Record a routing decision: build the record, mirror it to console (always),
 * and persist via the optional `write` callback (swallows errors). Returns the
 * record so the caller can also thread it into requestContext.
 */
export async function logRoutingDecision(
  input: RoutingDecisionInput,
  opts: RoutingLoggerOptions = {},
): Promise<RoutingDecisionRecord> {
  const record: RoutingDecisionRecord = {
    ...input,
    intent: input.decision.intent,
    delegateTo: input.decision.delegateTo,
    createdAt: new Date().toISOString(),
  };

  // Always mirror to console — this is the primary observability channel in
  // dev (the Mastra dev server tail surfaces these for debugging).
  // eslint-disable-next-line no-console
  console.log(
    `[intent] thread=${record.threadId} intent=${record.intent}` +
      (record.delegateTo ? ` delegate→${record.delegateTo}` : '') +
      (record.routedTo ? ` routed→${record.routedTo}` : '') +
      ` reason="${record.decision.reason}"`,
  );

  // Best-effort persistence — never throw.
  if (opts.write) {
    try {
      await opts.write(record);
    } catch {
      // Swallow: logging must not break the request path.
    }
  }
  return record;
}
