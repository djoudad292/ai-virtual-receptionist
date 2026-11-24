import { CallbackHandler } from '@langfuse/langchain';
import { isTracingEnabled } from './observability.module';

/**
 * Per-run Langfuse context for a LangGraph invocation.
 *
 * The handler is created per run rather than shared, because in
 * @langfuse/langchain v5 the trace context (userId / sessionId / tags /
 * traceMetadata) is fixed at construction time. Each receptionist turn needs
 * its own conversation id, so one shared handler would group unrelated
 * conversations into a single trace.
 *
 * Returns {} when tracing is off, so callers can spread it unconditionally.
 */
export function buildTraceConfig(params: {
  conversationId?: string | null;
  companyId?: string | null;
  runName: string;
  extraTags?: string[];
}): {
  callbacks?: CallbackHandler[];
  tags?: string[];
  metadata?: Record<string, string>;
  runName?: string;
} {
  if (!isTracingEnabled()) return {};
  try {
    const handler = new CallbackHandler({
      userId: params.companyId || undefined,
      sessionId: params.conversationId || undefined,
      tags: ['receptionist', ...(params.extraTags || [])],
      traceMetadata: {
        companyId: params.companyId || null,
        conversationId: params.conversationId || null,
      },
    });
    return {
      callbacks: [handler],
      tags: ['receptionist', ...(params.extraTags || [])],
      metadata: {
        ...(params.companyId ? { companyId: params.companyId } : {}),
        ...(params.conversationId ? { conversationId: params.conversationId } : {}),
      },
      runName: params.runName,
    };
  } catch {
    // Tracing must never break a conversation.
    return {};
  }
}