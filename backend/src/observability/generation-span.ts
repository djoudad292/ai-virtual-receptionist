import { isTracingEnabled } from './observability.module';

type StartObservation = typeof import('@langfuse/tracing').startObservation;

// Resolved lazily and cached: constructing the OTel SDK registers
// auto-instrumentation, which can clobber module-scope bindings if the module
// is imported before initTracing() runs. Importing on first use keeps the
// reference valid regardless of boot order.
let startObsPromise: Promise<StartObservation | null> | null = null;

async function getStartObservation(): Promise<StartObservation | null> {
  if (!startObsPromise) {
    startObsPromise = import('@langfuse/tracing')
      .then((mod) => mod.startObservation)
      .catch(() => null);
  }
  return startObsPromise;
}

export interface TraceSpanParams {
  name: string;
  model: string;
  input?: unknown;
  feature?: string;
  companyId?: string | null;
  /** Replaces the recorded output. Used to keep large payloads out of traces. */
  summarizeOutput?: (result: unknown) => unknown;
}

type SpanHandle = { update: (attributes: Record<string, unknown>) => void; end: () => void };

async function runTraced<T>(
  asType: 'generation' | 'embedding',
  params: TraceSpanParams,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isTracingEnabled()) {
    return fn();
  }

  const startObs = await getStartObservation();
  if (!startObs) {
    return fn();
  }

  let span: SpanHandle | null = null;
  try {
    const metadata = {
      ...(params.feature ? { feature: params.feature } : {}),
      ...(params.companyId ? { companyId: params.companyId } : {}),
    };
    // startObservation is overload-per-type, so the literal asType has to reach
    // the call site for TypeScript to pick the right attribute shape.
    span =
      asType === 'generation'
        ? await startObs(
            params.name,
            { model: params.model, input: params.input, metadata },
            { asType: 'generation' },
          )
        : await startObs(params.name, { input: params.input, metadata }, { asType: 'embedding' });
  } catch {
    // Fail-open: a span that cannot be created must not stop the call.
  }

  try {
    const result = await fn();
    try {
      const output = params.summarizeOutput ? params.summarizeOutput(result) : result;
      span?.update({ output });
    } catch {
      // Ignore: recording must never break the call.
    }
    return result;
  } catch (err) {
    try {
      span?.update({ level: 'ERROR', statusMessage: (err as Error).message });
    } catch {
      // Ignore.
    }
    throw err;
  } finally {
    try {
      span?.end();
    } catch {
      // Ignore.
    }
  }
}

export async function traceGeneration<T>(
  params: TraceSpanParams,
  fn: () => Promise<T>,
): Promise<T> {
  return runTraced('generation', params, fn);
}

export async function traceEmbedding<T>(
  params: TraceSpanParams,
  fn: () => Promise<T>,
): Promise<T> {
  return runTraced('embedding', params, fn);
}