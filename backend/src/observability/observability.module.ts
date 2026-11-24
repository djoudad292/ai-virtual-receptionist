import { Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { LangfuseSpanProcessor, MaskFunction } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * Langfuse tracing, wired the way @langfuse/langchain v5 expects.
 *
 * v5 is OpenTelemetry-native: CallbackHandler resolves its tracer through the
 * *global* OTel provider (trace.getTracerProvider()), so registering a NodeSDK
 * with a LangfuseSpanProcessor is what makes spans export. There is no client
 * object and no flush() on the handler — flushing belongs to the processor.
 *
 * Rules:
 *  1. Opt-in. Without LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY nothing is
 *     registered and the app behaves exactly as before.
 *  2. Never fatal. A bad key or unreachable collector must not stop boot and
 *     must never surface to a visitor.
 *  3. Visitor text is redacted unless explicitly allowed. This app handles
 *     health enquiries, so conversation bodies are personal data. The `mask`
 *     hook below runs on every span before export.
 *  4. Spans are flushed on shutdown so a redeploy does not lose traces.
 */

let sdk: NodeSDK | null = null;
let processor: LangfuseSpanProcessor | null = null;

export function isTracingEnabled(): boolean {
  return processor !== null;
}

/**
 * Redact conversation content from exported spans unless the operator has
 * explicitly opted in with LANGFUSE_ALLOW_CONTENT=true.
 *
 * We keep structure and length (useful for debugging: "a 4,200-char prompt was
 * sent") but replace the body itself, so a span can never carry a patient's
 * words to a third-party collector.
 */
const maskVisitorContent: MaskFunction = ({ data }) => {
  if (process.env.LANGFUSE_ALLOW_CONTENT === 'true') return data;

  const scrub = (value: any): any => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      return value.length > 0 ? `[redacted ${value.length} chars]` : '';
    }
    if (Array.isArray(value)) return value.map(scrub);
    if (typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) out[k] = scrub(v);
      return out;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    return undefined;
  };

  try {
    if (data && typeof data === 'object') {
      if ('input' in data) (data as any).input = scrub((data as any).input);
      if ('output' in data) (data as any).output = scrub((data as any).output);
      if ('metadata' in data) (data as any).metadata = scrub((data as any).metadata);
      return data;
    }
    return scrub(data);
  } catch {
    // Masking must never break export.
    return undefined;
  }
};

/** Idempotent: safe to call from main.ts and from tests. */
export function initTracing(logger: Logger): boolean {
  if (sdk) return true;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) {
    logger.log('Langfuse tracing disabled (LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not set)');
    return false;
  }

  try {
    processor = new LangfuseSpanProcessor({
      publicKey,
      secretKey,
      baseUrl: process.env.LANGFUSE_BASE_URL?.trim() || 'https://cloud.langfuse.com',
      environment: process.env.LANGFUSE_TRACING_ENVIRONMENT?.trim() || process.env.NODE_ENV || 'development',
      release: process.env.LANGFUSE_RELEASE?.trim(),
      mask: maskVisitorContent,
      // Base64 payloads in traces are useless here and bloat the bill.
      mediaUploadEnabled: false,
    });

    sdk = new NodeSDK({ spanProcessors: [processor] });
    sdk.start();

    logger.log(
      `Langfuse tracing enabled (host=${process.env.LANGFUSE_BASE_URL || 'cloud.langfuse.com'}, ` +
        `env=${process.env.LANGFUSE_TRACING_ENVIRONMENT || process.env.NODE_ENV || 'development'}, ` +
        `contentCapture=${process.env.LANGFUSE_ALLOW_CONTENT === 'true' ? 'ON' : 'REDACTED'})`,
    );
    return true;
  } catch (err) {
    processor = null;
    sdk = null;
    logger.warn(`Langfuse tracing init failed, continuing without it: ${(err as Error).message}`);
    return false;
  }
}

/** Best-effort flush. Never throws — shutdown must not fail on telemetry. */
export async function shutdownTracing(logger: Logger): Promise<void> {
  if (!sdk && !processor) return;
  try {
    await processor?.forceFlush?.();
  } catch (err) {
    logger.warn(`Langfuse flush failed: ${(err as Error).message}`);
  }
  try {
    await sdk?.shutdown();
  } catch (err) {
    logger.warn(`Langfuse SDK shutdown failed: ${(err as Error).message}`);
  }
  processor = null;
  sdk = null;
}

@Module({})
export class ObservabilityModule implements OnApplicationShutdown {
  private readonly logger = new Logger(ObservabilityModule.name);

  onApplicationShutdown(): void {
    void shutdownTracing(this.logger);
  }
}