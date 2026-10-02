import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * Embeddings health, degradation markers and the retrieval mode contract.
 *
 * Why this exists: a djb2 "embedding" is a hash bucket, not a semantic vector.
 * Cosine similarity over hash vectors carries no semantic signal, so retrieval
 * returns confident wrong answers instead of admitting it is degraded. We now
 * fail loudly (EmbeddingsUnavailableError) and let the retrieval layer fall back
 * to honest keyword scoring, or — only when explicitly allowed — serve hash
 * vectors, clearly labelled as such.
 */

/** Greppable log markers. One per degradation class, emitted once per process. */
export const EMBEDDINGS_DEGRADED_MARKER = 'EMBEDDINGS_DEGRADED';
export const RETRIEVAL_DEGRADED_MARKER = 'RETRIEVAL_DEGRADED';

/** How the embedding call for a query was served. */
export type EmbeddingMode = 'vector' | 'hash-fallback';

/** How a retrieval call was served. */
export type RetrievalMode = 'vector' | 'keyword-degraded' | 'hash-fallback';

export type EmbeddingsSnapshot = {
  mode: EmbeddingMode;
  model: string;
  openaiConfigured: boolean;
  allowHashEmbeddings: boolean;
  lastEmbeddingSuccessAt: string | null;
  lastDegradedAt: string | null;
};

export type DegradationReason = 'missing-key' | 'provider-error' | 'hash-vector' | 'search-error';

export class EmbeddingsUnavailableError extends Error {
  readonly reason: DegradationReason;

  constructor(message: string, reason: DegradationReason = 'provider-error') {
    super(message);
    this.name = 'EmbeddingsUnavailableError';
    this.reason = reason;
    // Keep `instanceof` working when the class is down-levelled to ES5.
    Object.setPrototypeOf(this, EmbeddingsUnavailableError.prototype);
  }
}

export function isEmbeddingsUnavailableError(err: unknown): err is EmbeddingsUnavailableError {
  return err instanceof EmbeddingsUnavailableError;
}

export function openAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Opt-in flag. When false (the default) we never serve hash vectors: the
 * embedding call throws so the caller can degrade to keyword retrieval.
 */
export function allowHashEmbeddings(): boolean {
  return process.env.ALLOW_HASH_EMBEDDINGS === 'true';
}

export function embeddingModel(): string {
  return process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
}

/**
 * Vectors produced by the hashing fallback are tagged so no code path can
 * accidentally feed them into a pgvector similarity search, even if a caller
 * forgets to branch on the mode.
 */
const hashVectors = new WeakSet<object>();

export function markHashVector(vector: number[]): number[] {
  hashVectors.add(vector);
  return vector;
}

export function isHashVector(vector: unknown): boolean {
  return Array.isArray(vector) && hashVectors.has(vector);
}

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsService.name);
  private mode: EmbeddingMode;
  private lastEmbeddingSuccessAt: string | null = null;
  private lastDegradedAt: string | null = null;
  private degradedLogged = false;
  private retrievalDegradedLogged = false;

  constructor() {
    // Declared mode: the mode this deployment is configured to serve.
    this.mode = openAiConfigured() ? 'vector' : allowHashEmbeddings() ? 'hash-fallback' : 'vector';
  }

  onModuleInit(): void {
    this.logger.log(
      `embeddings: configured=${openAiConfigured()} mode=${this.mode} allowHash=${allowHashEmbeddings()}`,
    );
  }

  getMode(): EmbeddingMode {
    return this.mode;
  }

  recordVectorSuccess(): void {
    this.mode = 'vector';
    this.lastEmbeddingSuccessAt = new Date().toISOString();
  }

  /** Record a degradation. Warns once per process with a greppable marker. */
  recordDegraded(reason: DegradationReason, detail: string, hashServed = false): void {
    this.lastDegradedAt = new Date().toISOString();
    if (hashServed) this.mode = 'hash-fallback';
    if (this.degradedLogged) return;
    this.degradedLogged = true;
    this.logger.warn(
      `${EMBEDDINGS_DEGRADED_MARKER} model=${embeddingModel()} reason=${reason} allowHash=${allowHashEmbeddings()} detail=${detail}`,
    );
  }

  /** Retrieval-layer degradation marker. Also once per process — counts come from /metrics/ai. */
  recordRetrievalDegraded(mode: RetrievalMode, detail: string): void {
    this.lastDegradedAt = this.lastDegradedAt || new Date().toISOString();
    if (this.retrievalDegradedLogged) return;
    this.retrievalDegradedLogged = true;
    this.logger.warn(
      `${RETRIEVAL_DEGRADED_MARKER} mode=${mode} model=${embeddingModel()} detail=${detail}`,
    );
  }

  snapshot(): EmbeddingsSnapshot {
    return {
      mode: this.mode,
      model: embeddingModel(),
      openaiConfigured: openAiConfigured(),
      allowHashEmbeddings: allowHashEmbeddings(),
      lastEmbeddingSuccessAt: this.lastEmbeddingSuccessAt,
      lastDegradedAt: this.lastDegradedAt,
    };
  }
}
