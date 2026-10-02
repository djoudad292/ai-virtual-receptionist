import { Injectable, Logger } from '@nestjs/common';
import { StoreService, StoreChunkHit } from '../common/store.service';
import { MailService } from '../common/mail.service';
import {
  RECEPTIONIST_TOOLS,
  ToolDefinition,
  ToolCall,
  openAiTools,
  geminiTools,
  parseToolArgs,
  OpenAIMessage,
  toGeminiContents,
} from './agent-tools';
import { extractJson } from './json-envelope';
import {
  EmbeddingsService,
  EmbeddingsUnavailableError,
  RetrievalMode,
  allowHashEmbeddings,
  embeddingModel,
  isEmbeddingsUnavailableError,
  isHashVector,
  markHashVector,
} from './embeddings.service';
import type { GraphTraceStep } from './langgraph/trace.types';

const EMBEDDING_DIM = 1536;
const DEFAULT_DEPARTMENTS = [
  { name: 'Sales', keywords: ['price', 'pricing', 'buy', 'purchase', 'quote', 'cost', 'order', 'sales'] },
  { name: 'Support', keywords: ['help', 'issue', 'problem', 'error', 'broken', 'not working', 'fix', 'support'] },
  { name: 'Billing', keywords: ['bill', 'invoice', 'payment', 'refund', 'charge', 'card', 'receipt', 'billing'] },
];

export interface Source {
  chunkText: string;
  similarity: number;
  documentTitle?: string | null;
}

export interface DemoAction {
  type: 'lead' | 'appointment' | 'email';
  ok: boolean;
  id?: string | null;
  detail?: string | null;
}

export interface ReceptionistExecuted {
  lead?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  appointment?: { date?: string | null; time?: string | null; title?: string | null } | null;
  email?: { to: string; sent: boolean } | null;
}

export interface ReceptionistResult {
  response: string;
  source: 'ai' | 'escalate';
  confidence: number;
  intent: 'question' | 'appointment' | 'lead_capture' | 'routing' | 'escalate' | 'other';
  department?: string | null;
  lead?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  appointment?: { date?: string | null; time?: string | null; title?: string | null } | null;
  sources: Source[];
  retrievalMode?: RetrievalMode;
  steps?: GraphTraceStep[];
  actions?: DemoAction[];
}

export interface AskResult {
  answer: string;
  sources: Source[];
  retrievalMode: RetrievalMode;
}

/** A retrieval call site always reports which mode actually served it. */
export interface RetrievalOutcome<T> {
  results: T[];
  mode: RetrievalMode;
}

/** Similarity threshold for the real vector path. */
const VECTOR_THRESHOLD = 0.2;

/** Dropped from keyword queries — they match everything and carry no signal. */
const KEYWORD_STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'what', 'when', 'where', 'which', 'who', 'whom',
  'your', 'yours', 'ours', 'their', 'there', 'here', 'about', 'would', 'could', 'should',
  'will', 'can', 'does', 'did', 'was', 'were', 'been', 'being', 'into', 'over', 'under',
  'then', 'than', 'them', 'they', 'some', 'such', 'only', 'also', 'just', 'like', 'make',
  'want', 'need', 'please', 'tell', 'give', 'know', 'does', 'much', 'many', 'more', 'very',
]);

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private store: StoreService,
    private mail: MailService,
    private embeddings: EmbeddingsService,
  ) {}

  /**
   * Embeddings: OpenAI only, unless the operator explicitly opts into the
   * deterministic hash fallback. Without a working OpenAI call this throws
   * `EmbeddingsUnavailableError` so the retrieval layer can degrade to keyword
   * scoring — it never silently returns a nonsense vector.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (process.env.OPENAI_API_KEY) {
      try {
        const embedding = await this.withTimeout(this.embedOpenAI(text), 15000);
        if (embedding?.length) {
          this.embeddings.recordVectorSuccess();
          return embedding;
        }
        throw new Error('OpenAI returned an empty embedding');
      } catch (err) {
        const detail = (err as Error).message;
        if (!allowHashEmbeddings()) {
          this.embeddings.recordDegraded('provider-error', detail);
          throw new EmbeddingsUnavailableError(
            `OpenAI embeddings unavailable (${detail}) and ALLOW_HASH_EMBEDDINGS is not enabled`,
            'provider-error',
          );
        }
        this.embeddings.recordDegraded('provider-error', detail, true);
        return markHashVector(this.embedLocally(text));
      }
    }

    this.embeddings.recordDegraded('missing-key', 'OPENAI_API_KEY is not set', allowHashEmbeddings());
    if (!allowHashEmbeddings()) {
      throw new EmbeddingsUnavailableError(
        'OPENAI_API_KEY is not set and ALLOW_HASH_EMBEDDINGS is not enabled',
        'missing-key',
      );
    }
    return markHashVector(this.embedLocally(text));
  }

  private async embedOpenAI(text: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: embeddingModel(),
        input: text.replace(/\n/g, ' ').slice(0, 8000),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI embedding HTTP ${res.status}: ${body.slice(0, 150)}`);
    }
    const json: any = await res.json();
    return json.data?.[0]?.embedding;
  }

  private embedLocally(text: string): number[] {
    const vector = new Array(EMBEDDING_DIM).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const grams: string[] = [];
    for (const word of normalized.split(/\s+/)) {
      if (!word) continue;
      grams.push(word);
      if (word.length > 2) {
        grams.push(word.slice(0, 5));
        grams.push(word.slice(-5));
      }
    }
    const joined = normalized.replace(/\s+/g, '');
    for (let n = 3; n <= 5; n++) {
      for (let i = 0; i + n <= joined.length; i++) {
        grams.push(joined.slice(i, i + n));
      }
    }
    for (const g of grams) {
      const h = hashString(g);
      const idx = Math.abs(h) % EMBEDDING_DIM;
      vector[idx] += (h & 1) === 0 ? 1 : -1;
    }
    let mag = 0;
    for (const v of vector) mag += v * v;
    mag = Math.sqrt(mag) || 1;
    return vector.map((v) => v / mag);
  }

  /**
   * Turn a query into a vector, or into an explicit degradation mode.
   * A hash-fallback vector is never returned here: it is not searchable.
   */
  private async embedQuery(query: string): Promise<{ embedding: number[] | null; mode: RetrievalMode }> {
    try {
      const embedding = await this.withTimeout(this.generateEmbedding(query), 15000);
      if (isHashVector(embedding)) {
        this.embeddings.recordRetrievalDegraded('hash-fallback', 'hash-fallback vectors are not searchable');
        return { embedding: null, mode: 'hash-fallback' };
      }
      return { embedding, mode: 'vector' };
    } catch (err) {
      this.embeddings.recordRetrievalDegraded(
        'keyword-degraded',
        isEmbeddingsUnavailableError(err) ? err.message : (err as Error).message,
      );
      return { embedding: null, mode: 'keyword-degraded' };
    }
  }

  /** Similarity floor for the real vector path (cosine). Override with RAG_SIMILARITY_THRESHOLD. */
  private similarityThreshold(): number {
    const raw = Number(process.env.RAG_SIMILARITY_THRESHOLD);
    return Number.isFinite(raw) && raw > 0 ? raw : VECTOR_THRESHOLD;
  }

  private recordRetrieval(companyId: string | null, mode: RetrievalMode, count: number): void {
    void this.store
      .recordRetrievalMetric(companyId, mode, count)
      .catch((err) => this.logger.warn(`Retrieval metric write failed: ${(err as Error).message}`));
  }

  /** Published chunks of a company: vector search, or honest keyword scoring when degraded. */
  private async retrievePublished(
    companyId: string,
    query: string,
    limit: number,
  ): Promise<RetrievalOutcome<StoreChunkHit>> {
    const { embedding, mode } = await this.embedQuery(query);
    let results: StoreChunkHit[];
    if (embedding) {
      try {
        results = await this.store.searchChunksPublished(companyId, embedding, limit, this.similarityThreshold());
      } catch (err) {
        if (isHashVector(embedding) || isEmbeddingsUnavailableError(err)) throw err;
        this.logger.warn(`Vector search failed, using keyword retrieval: ${(err as Error).message}`);
        this.embeddings.recordRetrievalDegraded('keyword-degraded', (err as Error).message);
        return this.keywordPublished(companyId, query, limit, 'keyword-degraded');
      }
    } else {
      return this.keywordPublished(companyId, query, limit, mode);
    }
    this.recordRetrieval(companyId, mode, results.length);
    return { results, mode };
  }

  private async keywordPublished(
    companyId: string,
    query: string,
    limit: number,
    mode: RetrievalMode,
  ): Promise<RetrievalOutcome<StoreChunkHit>> {
    const results = await this.store.searchChunksPublishedKeyword(companyId, this.extractTerms(query), limit);
    this.recordRetrieval(companyId, mode, results.length);
    return { results, mode };
  }

  /** All published chunks (used by the knowledge-base search tool). */
  private async retrieveAllPublished(
    companyId: string,
    query: string,
    limit: number,
  ): Promise<RetrievalOutcome<StoreChunkHit>> {
    const { embedding, mode } = await this.embedQuery(query);
    if (!embedding) {
      return this.keywordPublished(companyId, query, limit, mode);
    }
    const threshold = this.similarityThreshold();
    let results: StoreChunkHit[];
    try {
      results = (await this.store.searchChunksFull(companyId, embedding, limit)).filter(
        (r) => r.similarity >= threshold,
      );
    } catch (err) {
      if (isHashVector(embedding) || isEmbeddingsUnavailableError(err)) throw err;
      this.logger.warn(`Vector search failed, using keyword retrieval: ${(err as Error).message}`);
      this.embeddings.recordRetrievalDegraded('keyword-degraded', (err as Error).message);
      return this.keywordPublished(companyId, query, limit, 'keyword-degraded');
    }
    this.recordRetrieval(companyId, mode, results.length);
    return { results, mode };
  }

  /** Chunks of a single document: vector search, or keyword scoring when degraded. */
  private async retrieveDocument(
    companyId: string,
    documentId: string,
    query: string,
    limit: number,
  ): Promise<RetrievalOutcome<StoreChunkHit>> {
    const { embedding, mode } = await this.embedQuery(query);
    let results: StoreChunkHit[];
    if (embedding) {
      try {
        results = await this.store.searchChunksByDocument(documentId, embedding, limit, this.similarityThreshold());
      } catch (err) {
        if (isHashVector(embedding) || isEmbeddingsUnavailableError(err)) throw err;
        this.logger.warn(`Vector search failed, using keyword retrieval: ${(err as Error).message}`);
        this.embeddings.recordRetrievalDegraded('keyword-degraded', (err as Error).message);
        return this.keywordDocument(companyId, documentId, query, limit, 'keyword-degraded');
      }
    } else {
      return this.keywordDocument(companyId, documentId, query, limit, mode);
    }
    this.recordRetrieval(companyId, mode, results.length);
    return { results, mode };
  }

  private async keywordDocument(
    companyId: string,
    documentId: string,
    query: string,
    limit: number,
    mode: RetrievalMode,
  ): Promise<RetrievalOutcome<StoreChunkHit>> {
    const results = await this.store.searchChunksByDocumentKeyword(documentId, this.extractTerms(query), limit);
    this.recordRetrieval(companyId, mode, results.length);
    return { results, mode };
  }

  // Public RAG search for LangGraph agent
  async ragSearchPublic(companyId: string, query: string, limit = 5) {
    return this.ragSearch(companyId, query, limit);
  }

  // RAG search
  async searchKnowledgeBase(companyId: string, query: string, limit = 10): Promise<RetrievalOutcome<StoreChunkHit>> {
    const totalChunks = await this.store.countChunks(companyId);
    if (totalChunks === 0) return { results: [], mode: 'vector' };
    try {
      return await this.retrieveAllPublished(companyId, query, limit);
    } catch (err) {
      // Unexpected failure (e.g. the database is down): no retrieval ran at all.
      this.logger.warn(`KB search failed: ${(err as Error).message}`);
      return { results: [], mode: 'vector' };
    }
  }

  // RAG Q&A over a single knowledge base document
  async askKnowledgeDocument(companyId: string, documentId: string, question: string): Promise<AskResult> {
    const doc = await this.store.findDocumentById(documentId);
    if (!doc || doc.companyId !== companyId) {
      throw new Error('Document not found');
    }
    const { results, mode } = await this.retrieveDocument(companyId, documentId, question, 5);
    const context = results
      .map((r) => r.chunkText)
      .join('\n\n')
      .slice(0, 7000);

    if (!results.length || !context) {
      return {
        answer:
          "I couldn't find relevant information in this document to answer that question. Try rephrasing, or ask about something covered in the document.",
        sources: [],
        retrievalMode: mode,
      };
    }

    const answer = await this.generateAnswer(question, context, doc.title, companyId);
    return {
      answer:
        answer ||
        "I couldn't find relevant information in this document to answer that question. Try rephrasing, or ask about something covered in the document.",
      sources: results.map((r) => ({ chunkText: r.chunkText, similarity: r.similarity })),
      retrievalMode: mode,
    };
  }

  // RAG Q&A across all published documents of a company
  async askCompanyPublished(companyId: string, question: string): Promise<AskResult> {
    const { results, mode } = await this.retrievePublished(companyId, question, 6);

    if (!results.length) {
      return {
        answer:
          "I couldn't find relevant information to answer that question. Try rephrasing, or ask about something covered in the published documents.",
        sources: [],
        retrievalMode: mode,
      };
    }

    const context = results
      .map((r) => `[${r.documentTitle}]\n${r.chunkText}`)
      .join('\n\n')
      .slice(0, 8000);

    const answer = await this.generateAnswer(question, context, 'your documents', companyId);
    return {
      answer:
        answer ||
        "I couldn't find relevant information to answer that question. Try rephrasing, or ask about something covered in the published documents.",
      sources: results.map((r) => ({
        chunkText: r.chunkText,
        similarity: r.similarity,
        documentTitle: r.documentTitle,
      })),
      retrievalMode: mode,
    };
  }

  // Generate a summary for a knowledge base document
  async summarizeKnowledgeDocument(companyId: string, documentId: string): Promise<string> {
    const doc = await this.store.findDocumentById(documentId);
    if (!doc || doc.companyId !== companyId) {
      throw new Error('Document not found');
    }
    const text = doc.content.slice(0, 12000);
    const summary = await this.generateSummary(text, doc.title, companyId);
    return (
      summary ||
      "I couldn't generate a summary for this document. It may be empty or contain only scanned images."
    );
  }

  private async ragSearch(companyId: string, query: string, limit = 5) {
    const totalChunks = await this.store.countChunks(companyId);
    if (totalChunks === 0) return { context: '', results: [], bestSimilarity: 0, mode: 'vector' as RetrievalMode };
    let outcome: RetrievalOutcome<StoreChunkHit>;
    try {
      outcome = await this.retrievePublished(companyId, query, limit);
    } catch (err) {
      this.logger.warn(`RAG search failed: ${(err as Error).message}`);
      return { context: '', results: [], bestSimilarity: 0, mode: 'vector' as RetrievalMode };
    }
    const { results, mode } = outcome;
    const bestSimilarity = results.length > 0 ? Number(results[0].similarity) : 0;
    const context = results
      .map((r) => (r.documentTitle ? `[${r.documentTitle}]\n${r.chunkText}` : r.chunkText))
      .join('\n\n')
      .slice(0, 6000);
    const sources: Source[] = results.map((r) => ({
      chunkText: r.chunkText,
      similarity: r.similarity,
      documentTitle: r.documentTitle || null,
    }));
    return { context, results: sources, bestSimilarity, mode };
  }

  private shouldFallbackToGemini(msg: string): boolean {
    return /HTTP 402|insufficient credits|payment|billing|HTTP 429|free-models-per-day|rate.?limit/i.test(msg);
  }

  /**
   * Record one LLM call outcome (tokens + latency). Metrics must never break a
   * conversation, so failures are logged and swallowed.
   */
  private recordLlmUsage(entry: {
    companyId?: string | null;
    provider: string;
    model: string;
    feature: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
    latencyMs: number;
    success: boolean;
    error?: string | null;
  }): void {
    void this.store
      .recordLlmUsage({
        companyId: entry.companyId || null,
        provider: entry.provider,
        model: entry.model,
        feature: entry.feature,
        promptTokens: entry.usage?.promptTokens ?? 0,
        completionTokens: entry.usage?.completionTokens ?? 0,
        totalTokens: entry.usage?.totalTokens ?? 0,
        latencyMs: entry.latencyMs,
        success: entry.success,
        error: entry.error || null,
      })
      .catch((err) => this.logger.warn(`LLM usage write failed: ${(err as Error).message}`));
  }

  private openRouterModel(): string {
    return process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  }

  private geminiModel(): string {
    return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  /** Normalize OpenAI-shaped and Gemini-shaped usage payloads. */
  private normalizeUsage(usage: any): { promptTokens: number; completionTokens: number; totalTokens: number } {
    const promptTokens = Number(usage?.prompt_tokens ?? usage?.promptTokenCount ?? 0) || 0;
    const completionTokens = Number(usage?.completion_tokens ?? usage?.candidatesTokenCount ?? 0) || 0;
    const totalTokens = Number(usage?.total_tokens ?? usage?.totalTokenCount ?? 0) || promptTokens + completionTokens;
    return { promptTokens, completionTokens, totalTokens };
  }

  // LLM chat (OpenRouter primary, Gemini fallback when credits run out)
  private async chat(
    messages: { role: string; content: string }[],
    maxTokens = 1024,
    feature = 'chat',
    companyId?: string | null,
  ): Promise<string | null> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return this.chatGemini(messages, maxTokens, feature, companyId);

    const doFetch = async (): Promise<any> => {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.APP_URL || '',
          'X-Title': 'AI Virtual Receptionist',
        },
        body: JSON.stringify({
          model: this.openRouterModel(),
          messages,
          max_tokens: maxTokens,
          temperature: 0.5,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenRouter HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      }
      return res.json();
    };

    // Retry transient provider errors (rate limits, 503 "request queue is full", 5xx) with backoff.
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startedAt = Date.now();
      try {
        const json: any = await this.withTimeout(doFetch(), 30000);
        this.recordLlmUsage({
          companyId,
          provider: 'openrouter',
          model: this.openRouterModel(),
          feature,
          usage: this.normalizeUsage(json?.usage),
          latencyMs: Date.now() - startedAt,
          success: true,
        });
        const content = json.choices?.[0]?.message?.content;
        return typeof content === 'string' && content.trim() ? content : null;
      } catch (err) {
        const msg = (err as Error).message;
        if (this.shouldFallbackToGemini(msg)) {
          this.logger.warn(`OpenRouter quota/billing limit, falling back to Gemini: ${msg}`);
          this.recordLlmUsage({
            companyId,
            provider: 'openrouter',
            model: this.openRouterModel(),
            feature,
            latencyMs: Date.now() - startedAt,
            success: false,
            error: msg,
          });
          return this.chatGemini(messages, maxTokens, feature, companyId);
        }
        const isRetryable =
          /HTTP 503|HTTP 5\d\d|request queue is full|temporarily overloaded/i.test(msg);
        if (isRetryable && attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          this.logger.warn(
            `OpenRouter retry ${attempt}/${maxRetries - 1} after ${delay}ms: ${msg}`,
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        this.logger.error(`OpenRouter generation failed: ${msg}`);
        this.recordLlmUsage({
          companyId,
          provider: 'openrouter',
          model: this.openRouterModel(),
          feature,
          latencyMs: Date.now() - startedAt,
          success: false,
          error: msg,
        });
        return null;
      }
    }
    return null;
  }

  // Gemini API fallback so the AI keeps working even when OpenRouter runs out of credits.
  private async chatGemini(
    messages: { role: string; content: string }[],
    maxTokens = 1024,
    feature = 'chat',
    companyId?: string | null,
  ): Promise<string | null> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;

    const contents = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const startedAt = Date.now();
    try {
      const res = await this.withTimeout(
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel()}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: {
                maxOutputTokens: maxTokens,
                temperature: 0.5,
              },
            }),
          },
        ),
        30000,
      );
      if (!res.ok) {
        const detail = `Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
        this.logger.error(detail);
        this.recordLlmUsage({
          companyId,
          provider: 'gemini',
          model: this.geminiModel(),
          feature,
          latencyMs: Date.now() - startedAt,
          success: false,
          error: detail,
        });
        return null;
      }
      const json: any = await res.json();
      this.recordLlmUsage({
        companyId,
        provider: 'gemini',
        model: this.geminiModel(),
        feature,
        usage: this.normalizeUsage(json?.usageMetadata),
        latencyMs: Date.now() - startedAt,
        success: true,
      });
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      return typeof text === 'string' && text.trim() ? text : null;
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Gemini generation failed: ${msg}`);
      this.recordLlmUsage({
        companyId,
        provider: 'gemini',
        model: this.geminiModel(),
        feature,
        latencyMs: Date.now() - startedAt,
        success: false,
        error: msg,
      });
      return null;
    }
  }

  // Real tool-calling loop for the receptionist: the LLM invokes functions
  // (capture_lead, book_appointment, send_confirmation_email) instead of just
  // emitting a JSON envelope. Supports OpenRouter (OpenAI format) and Gemini.
  private async chatWithTools(
    messages: OpenAIMessage[],
    tools: ToolDefinition[],
    maxTokens = 1024,
    feature = 'receptionist_tools',
    companyId?: string | null,
  ): Promise<{ content: string | null; toolCalls: ToolCall[] }> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      try {
        return await this.chatOpenRouterWithTools(messages, tools, maxTokens, feature, companyId);
      } catch (err) {
        this.logger.warn(`OpenRouter tool call failed, using Gemini: ${(err as Error).message}`);
      }
    }
    return this.chatGeminiWithTools(messages, tools, maxTokens, feature, companyId);
  }

  private async chatOpenRouterWithTools(
    messages: OpenAIMessage[],
    tools: ToolDefinition[],
    maxTokens = 1024,
    feature = 'receptionist_tools',
    companyId?: string | null,
  ): Promise<{ content: string | null; toolCalls: ToolCall[] }> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

    const doFetch = async (): Promise<any> => {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.APP_URL || '',
          'X-Title': 'AI Virtual Receptionist',
        },
        body: JSON.stringify({
          model: this.openRouterModel(),
          messages,
          tools: openAiTools(tools),
          max_tokens: maxTokens,
          temperature: 0.5,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenRouter HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      }
      return res.json();
    };

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startedAt = Date.now();
      try {
        const json: any = await this.withTimeout(doFetch(), 30000);
        this.recordLlmUsage({
          companyId,
          provider: 'openrouter',
          model: this.openRouterModel(),
          feature,
          usage: this.normalizeUsage(json?.usage),
          latencyMs: Date.now() - startedAt,
          success: true,
        });
        const message = json.choices?.[0]?.message;
        const content = typeof message?.content === 'string' && message.content.trim() ? message.content : null;
        const toolCalls: ToolCall[] = (message?.tool_calls || [])
          .filter((tc: any) => tc?.function?.name)
          .map((tc: any) => ({
            id: tc.id || `call_${Math.random().toString(36).slice(2)}`,
            name: tc.function.name,
            args: parseToolArgs(tc.function.arguments),
          }));
        return { content, toolCalls };
      } catch (err) {
        const msg = (err as Error).message;
        if (this.shouldFallbackToGemini(msg)) {
          this.logger.warn(`OpenRouter quota/billing limit, falling back to Gemini: ${msg}`);
          this.recordLlmUsage({
            companyId,
            provider: 'openrouter',
            model: this.openRouterModel(),
            feature,
            latencyMs: Date.now() - startedAt,
            success: false,
            error: msg,
          });
          return this.chatGeminiWithTools(messages, tools, maxTokens, feature, companyId);
        }
        const isRetryable = /HTTP 503|HTTP 5\d\d|request queue is full|temporarily overloaded/i.test(msg);
        if (isRetryable && attempt < maxRetries) {
          const delay = 1000 * Math.min(2 ** (attempt - 1), 4) + Math.random() * 500;
          this.logger.warn(`OpenRouter retry ${attempt}/${maxRetries - 1} after ${delay}ms: ${msg}`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        this.recordLlmUsage({
          companyId,
          provider: 'openrouter',
          model: this.openRouterModel(),
          feature,
          latencyMs: Date.now() - startedAt,
          success: false,
          error: msg,
        });
        throw err;
      }
    }
    throw new Error('OpenRouter tool call failed after retries');
  }

  private async chatGeminiWithTools(
    messages: OpenAIMessage[],
    tools: ToolDefinition[],
    maxTokens = 1024,
    feature = 'receptionist_tools',
    companyId?: string | null,
  ): Promise<{ content: string | null; toolCalls: ToolCall[] }> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return { content: null, toolCalls: [] };

    const startedAt = Date.now();
    try {
      const res = await this.withTimeout(
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel()}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: toGeminiContents(messages),
              tools: geminiTools(tools),
              generationConfig: {
                maxOutputTokens: maxTokens,
                temperature: 0.5,
              },
            }),
          },
        ),
        30000,
      );
      if (!res.ok) {
        const detail = `Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
        this.logger.error(detail);
        this.recordLlmUsage({
          companyId,
          provider: 'gemini',
          model: this.geminiModel(),
          feature,
          latencyMs: Date.now() - startedAt,
          success: false,
          error: detail,
        });
        return { content: null, toolCalls: [] };
      }
      const json: any = await res.json();
      this.recordLlmUsage({
        companyId,
        provider: 'gemini',
        model: this.geminiModel(),
        feature,
        usage: this.normalizeUsage(json?.usageMetadata),
        latencyMs: Date.now() - startedAt,
        success: true,
      });
      const parts: any[] = json?.candidates?.[0]?.content?.parts || [];
      const content = parts
        .filter((p) => typeof p?.text === 'string' && p.text.trim())
        .map((p) => p.text)
        .join('\n') || null;
      const toolCalls: ToolCall[] = parts
        .filter((p) => p?.functionCall?.name)
        .map((p) => ({
          id: `fc_${Math.random().toString(36).slice(2)}`,
          name: p.functionCall.name,
          args: p.functionCall.args || {},
        }));
      return { content, toolCalls };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Gemini tool generation failed: ${msg}`);
      this.recordLlmUsage({
        companyId,
        provider: 'gemini',
        model: this.geminiModel(),
        feature,
        latencyMs: Date.now() - startedAt,
        success: false,
        error: msg,
      });
      return { content: null, toolCalls: [] };
    }
  }

  // Execute an LLM-invoked tool against the real store / mail services.
  private async executeReceptionistTool(
    call: ToolCall,
    companyId: string,
    conversationId?: string,
    executed: ReceptionistExecuted = {},
  ): Promise<string> {
    const args = call.args || {};
    try {
      switch (call.name) {
        case 'capture_lead': {
          const name = typeof args.name === 'string' ? args.name.trim() || null : null;
          const email = typeof args.email === 'string' ? args.email.trim() || null : null;
          const phone = typeof args.phone === 'string' ? args.phone.trim() || null : null;
          if (!name && !email && !phone) {
            return JSON.stringify({ ok: false, error: 'No contact info provided' });
          }
          let lead = conversationId ? await this.store.findLeadByConversation(conversationId) : null;
          if (lead) {
            lead = await this.store.updateLead(lead.id, {
              name: name || lead.name || undefined,
              email: email || lead.email || undefined,
              phone: phone || lead.phone || undefined,
            });
          } else {
            lead = await this.store.createLead({
              id: crypto.randomUUID(),
              companyId,
              conversationId: conversationId || null,
              name,
              email,
              phone,
              message: null,
              source: 'chat',
              status: 'new',
              department: null,
            });
            if (conversationId) {
              await this.store.updateConversation(conversationId, { leadId: lead.id });
            }
          }
          executed.lead = { name: lead?.name || null, email: lead?.email || null, phone: lead?.phone || null };
          return JSON.stringify({ ok: true, leadId: lead?.id, name, email, phone });
        }
        case 'book_appointment': {
          const date = typeof args.date === 'string' ? args.date : null;
          const time = typeof args.time === 'string' ? args.time : null;
          const title = typeof args.title === 'string' && args.title ? args.title : 'Scheduled meeting';
          if (!date || !time) {
            return JSON.stringify({ ok: false, error: 'date and time are required' });
          }
          const startTime = this.parseAppointmentDateTime(date, time);
          if (!startTime) {
            return JSON.stringify({ ok: false, error: `Invalid date/time: ${date} ${time}` });
          }
          const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
          const lead = conversationId ? await this.store.findLeadByConversation(conversationId) : null;
          const appt = await this.store.createAppointment({
            id: crypto.randomUUID(),
            companyId,
            conversationId: conversationId || null,
            leadId: lead?.id || null,
            customerName: lead?.name || null,
            customerEmail: lead?.email || null,
            title,
            notes: null,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: 'requested',
          });
          if (conversationId) {
            const convo = await this.store.findConversationById(conversationId);
            await this.store.updateConversation(conversationId, {
              metadata: { ...(convo?.metadata || {}), appointmentBooked: true },
            });
          }
          executed.appointment = { date, time, title };
          return JSON.stringify({ ok: true, appointmentId: appt.id, date, time, title });
        }
        case 'send_confirmation_email': {
          const to = typeof args.to === 'string' ? args.to : null;
          const subject = typeof args.subject === 'string' ? args.subject : null;
          const body = typeof args.body === 'string' ? args.body : null;
          if (!to || !subject) {
            return JSON.stringify({ ok: false, error: 'to and subject are required' });
          }
          const sent = await this.mail.send({ to, subject, text: body || '' });
          executed.email = { to, sent };
          return JSON.stringify({ ok: sent, sent });
        }
        default:
          return JSON.stringify({ ok: false, error: `Unknown tool: ${call.name}` });
      }
    } catch (err) {
      this.logger.error(`Tool ${call.name} failed: ${(err as Error).message}`);
      return JSON.stringify({ ok: false, error: (err as Error).message });
    }
  }

  // Receptionist orchestration — now powered by LangGraph
  async generateResponse(
    companyId: string,
    userMessage: string,
    history?: { senderType: string; content: string }[],
    conversationId?: string,
    opts?: { mode?: 'receptionist' | 'support' },
  ): Promise<ReceptionistResult> {
    const mode = opts?.mode ?? 'support';

    if (mode === 'receptionist') {
      this.logger.log('Receptionist mode: using legacy RAG path');
      return this.generateResponseLegacy(companyId, userMessage, history, conversationId);
    }

    try {
      const { runReceptionistGraph } = await import('./langgraph/agent.graph');
      const lgResult = await runReceptionistGraph({
        userMessage,
        companyId,
        conversationId,
        history,
        store: this.store,
        mail: this.mail,
        aiService: this,
      });

      const result: ReceptionistResult = {
        response: lgResult.response,
        source: lgResult.source,
        confidence: lgResult.source === 'ai' ? 0.9 : 0,
        intent: lgResult.intent,
        department: lgResult.department,
        lead: lgResult.lead,
        appointment: lgResult.appointment,
        sources: lgResult.sources,
        retrievalMode: lgResult.retrievalMode || 'vector',
        steps: lgResult.steps,
      };

      if (conversationId) {
        const persisted = await this.persistSideEffects(companyId, conversationId, result);
        const actions = this.buildActions(persisted, {}, result);
        if (actions.length > 0) {
          result.actions = actions;
        }
      }

      return result;
    } catch (err) {
      this.logger.error(`LangGraph agent failed, falling back to legacy: ${(err as Error).message}`);
      return this.generateResponseLegacy(companyId, userMessage, history, conversationId);
    }
  }

  // Legacy receptionist orchestration (kept as fallback)
  private async generateResponseLegacy(
    companyId: string,
    userMessage: string,
    history?: { senderType: string; content: string }[],
    conversationId?: string,
  ): Promise<ReceptionistResult> {
    const company = await this.store.findCompanyById(companyId);
    const departments = await this.store.listDepartments(companyId);
    const departmentNames = departments.length > 0 ? departments : DEFAULT_DEPARTMENTS;

    const { context, results: ragResults, bestSimilarity, mode: retrievalMode } = await this.ragSearch(
      companyId,
      userMessage,
    );

    const systemPrompt = this.buildSystemPrompt(company, departmentNames, context);

    const agentMessages: OpenAIMessage[] = [{ role: 'system', content: systemPrompt }];

    if (history && history.length > 1) {
      const recent = history.slice(-10);
      for (const m of recent) {
        const role = m.senderType === 'user' ? 'user' : 'assistant';
        agentMessages.push({ role, content: m.content });
      }
    }

    agentMessages.push({ role: 'user', content: userMessage });

    // Tool-calling loop: let the LLM invoke real functions (capture_lead,
    // book_appointment, send_confirmation_email). Falls back to plain JSON
    // envelope generation if no tools are requested.
    const executed: ReceptionistExecuted = {};
    let raw: string | null = null;
    for (let round = 0; round < 3; round++) {
      const turn = await this.chatWithTools(agentMessages, RECEPTIONIST_TOOLS, 1024, 'receptionist_tools', companyId);
      if (!turn.toolCalls.length) {
        raw = turn.content;
        break;
      }
      agentMessages.push({
        role: 'assistant',
        content: turn.content,
        tool_calls: turn.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
        })),
      });
      for (const tc of turn.toolCalls) {
        const resultText = await this.executeReceptionistTool(tc, companyId, conversationId, executed);
        agentMessages.push({ role: 'tool', tool_call_id: tc.id, content: resultText });
      }
    }

    const parsed = this.extractJson(raw);

    let intent: ReceptionistResult['intent'] = 'other';
    let department: string | null = null;
    let lead: ReceptionistResult['lead'] = null;
    let appointment: ReceptionistResult['appointment'] = null;
    let response = '';

    if (parsed && typeof parsed.reply === 'string') {
      response = parsed.reply;
      intent = this.sanitizeIntent(parsed.intent);
      department = this.matchDepartment(parsed.department, departmentNames);
      lead = this.sanitizeLead(parsed.lead);
      appointment = this.sanitizeAppointment(parsed.appointment);
      // LLM-driven fallbacks when fields are missing
      if (!lead && this.extractEmail(userMessage)) {
        lead = { name: null, email: this.extractEmail(userMessage), phone: null };
      }
      if (intent === 'other' && this.looksLikeAppointment(userMessage)) {
        intent = 'appointment';
      }
      // Safety net: never hand off to a human unless the visitor explicitly asks for one.
      if (intent === 'escalate' && !this.visitorWantsHuman(userMessage, history)) {
        intent = 'other';
      }
    } else {
      // No LLM / unparseable -> deterministic fallback
      response = this.fallbackReply(context);
      if (this.looksLikeAppointment(userMessage)) intent = 'appointment';
      else if (this.extractEmail(userMessage) || /(\+?\d[\d\s-]{7,})/.test(userMessage)) intent = 'lead_capture';
      else if (context) intent = 'question';
      else intent = 'other';
      department = this.keywordDepartment(userMessage, departmentNames);
      const email = this.extractEmail(userMessage);
      const phoneMatch = userMessage.match(/(\+?\d[\d\s-]{7,})/);
      if (email || phoneMatch) {
        lead = { name: null, email, phone: phoneMatch ? phoneMatch[1].trim() : null };
      }
    }

    // Tool-executed side effects take precedence over the JSON envelope.
    if (executed.lead) {
      lead = this.sanitizeLead(executed.lead);
      if (intent === 'other') intent = 'lead_capture';
    }
    if (executed.appointment) {
      appointment = this.sanitizeAppointment(executed.appointment);
      if (intent === 'other') intent = 'appointment';
    }

    const result: ReceptionistResult = {
      response,
      source: intent === 'escalate' ? 'escalate' : 'ai',
      confidence: bestSimilarity,
      intent,
      department,
      lead,
      appointment,
      sources: ragResults,
      retrievalMode,
    };

    if (conversationId) {
      const persisted = await this.persistSideEffects(companyId, conversationId, result);
      const actions = this.buildActions(persisted, executed, result);
      if (actions.length > 0) {
        result.actions = actions;
      }
    }

    return result;
  }

  // Draft a reply for a human agent, grounded in the published knowledge base.
  async suggestAgentReply(companyId: string, conversationId: string): Promise<{ reply: string | null; sources: Source[] }> {
    const messages = await this.store.findMessagesByConversation(conversationId);
    const visitorMessages = messages
      .filter((m) => m.senderType === 'user')
      .slice(-3)
      .map((m) => m.content)
      .filter((c) => c.trim());
    if (!visitorMessages.length) {
      return { reply: null, sources: [] };
    }

    const query = visitorMessages[visitorMessages.length - 1];
    const { context, results } = await this.ragSearch(companyId, query, 6);
    if (!results.length || !context) {
      return { reply: null, sources: [] };
    }

    const transcript = messages
      .slice(-6)
      .map((m) => `${m.senderType === 'user' ? 'Visitor' : m.senderType}: ${m.content}`)
      .join('\n');

    const draft = await this.generateAgentReply(query, context, transcript, companyId);
    return { reply: draft, sources: results };
  }

  private async generateAgentReply(question: string, context: string, transcript: string, companyId: string): Promise<string | null> {
    const system = `You are an expert customer support agent assistant.
Draft a reply the human agent can send to the visitor. Answer ONLY from the context below - never invent facts.
Keep it warm, professional and concise (2-4 sentences), in the same language as the visitor's message.
If the context does not contain the answer, draft a short reply that asks for clarification or politely offers to check with the team - do not guess.`;
    return this.chat(
      [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Context:\n${context}\n\nConversation so far:\n${transcript}\n\nDraft a reply to the visitor's latest message.`,
        },
      ],
      1024,
      'agent_reply_suggestion',
      companyId,
    );
  }

  // Persist side effects (leads, appointments, routing)
  private async persistSideEffects(
    companyId: string,
    conversationId: string,
    result: ReceptionistResult,
  ): Promise<{ leadId: string | null; appointmentId: string | null }> {
    let leadId: string | null = null;
    let appointmentId: string | null = null;

    const conversation = await this.store.findConversationById(conversationId);
    if (!conversation) return { leadId, appointmentId };

    // Department routing
    if (result.department && conversation.department !== result.department) {
      await this.store.updateConversation(conversationId, { department: result.department });
    }

    // Lead capture
    const leadInfo = result.lead;
    if (leadInfo && (leadInfo.email || leadInfo.phone || leadInfo.name)) {
      let lead = await this.store.findLeadByConversation(conversationId);
      if (lead) {
        lead = await this.store.updateLead(lead.id, {
          name: leadInfo.name || lead.name || undefined,
          email: leadInfo.email || lead.email || undefined,
          phone: leadInfo.phone || lead.phone || undefined,
          department: result.department || lead.department || undefined,
        });
        leadId = lead?.id ?? null;
      } else {
        lead = await this.store.createLead({
          id: crypto.randomUUID(),
          companyId,
          conversationId,
          name: leadInfo.name || null,
          email: leadInfo.email || null,
          phone: leadInfo.phone || null,
          message: null,
          source: 'chat',
          status: 'new',
          department: result.department || null,
        });
        leadId = lead?.id ?? null;
        if (lead?.id) {
          await this.store.updateConversation(conversationId, { leadId: lead.id });
        }
      }
    }

    // Appointment booking
    const appt = result.appointment;
    if (appt && appt.date && appt.time) {
      const metadata = conversation.metadata || {};
      if (!metadata.appointmentBooked) {
        const startTime = this.parseAppointmentDateTime(appt.date, appt.time);
        if (startTime) {
          const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
          const lead = await this.store.findLeadByConversation(conversationId);
          const createdAppt = await this.store.createAppointment({
            id: crypto.randomUUID(),
            companyId,
            conversationId,
            leadId: lead?.id || null,
            customerName: lead?.name || result.lead?.name || null,
            customerEmail: lead?.email || null,
            title: appt.title || 'Scheduled meeting',
            notes: null,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: 'requested',
          });
          appointmentId = createdAppt?.id ?? null;
          await this.store.updateConversation(conversationId, {
            metadata: { ...metadata, appointmentBooked: true },
          });
        }
      }
    }

    return { leadId, appointmentId };
  }

  // Build the public `actions` array from persisted DB ids and executed tool side-effects.
  private buildActions(
    persisted: { leadId: string | null; appointmentId: string | null },
    executed: ReceptionistExecuted,
    result: ReceptionistResult,
  ): DemoAction[] {
    const actions: DemoAction[] = [];

    const leadInfo = executed.lead ?? result.lead;
    if (persisted.leadId && leadInfo) {
      const parts = [leadInfo.name, leadInfo.email || leadInfo.phone].filter(Boolean);
      actions.push({
        type: 'lead',
        ok: true,
        id: persisted.leadId,
        detail: parts.join(' · '),
      });
    }

    const apptInfo = executed.appointment ?? result.appointment;
    if (persisted.appointmentId && apptInfo) {
      const parts = [apptInfo.date, apptInfo.time, apptInfo.title].filter(Boolean);
      actions.push({
        type: 'appointment',
        ok: true,
        id: persisted.appointmentId,
        detail: parts.join(' · '),
      });
    }

    if (executed.email) {
      actions.push({
        type: 'email',
        ok: executed.email.sent,
        detail: executed.email.to,
      });
    }

    return actions;
  }

  // Prompt + parsing helpers
  private buildSystemPrompt(company: any, departments: any[], context: string): string {
    const deptList = departments.map((d) => d.name).join(', ') || 'Sales, Support, Billing';
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const contextPart = context
      ? `You answer from the knowledge base context below whenever it covers the question. If the context does not contain the answer, still respond helpfully and conversationally using your general knowledge — for a demo you are expected to answer and keep the conversation going. Never claim a company fact you do not know.\n\nContext:\n${context}`
      : 'There is no knowledge base content for this company yet. This is a demo: answer every question helpfully and conversationally using general knowledge, as a polished receptionist would. Never claim specific company prices, hours, or policies you do not know — instead be friendly, ask a clarifying question, and keep the conversation going. Do NOT escalate unless the visitor explicitly asks for a human agent.';

    return `You are an AI virtual receptionist for "${company?.name || 'this company'}".
Today's date is ${todayStr} (YYYY-MM-DD). Always compute relative dates like "tomorrow" or "this Friday" from today's date.
You greet visitors, answer their questions, capture leads, book appointments, and route conversations to the right department.

Company departments: ${deptList}.

${contextPart}

BEHAVIOR:
- Be warm, friendly, personable and concise (1-3 sentences). Keep the conversation flowing like a real receptionist would — engage with the visitor, ask follow-up questions, and offer help even when you are unsure.
- NEVER invent specific company facts, prices, hours, or policies. Only use the knowledge base context above for those. For everything else, answer naturally from general knowledge.
- If the visitor wants to book or schedule a meeting, ask for their name, email and preferred date/time if not already provided.
- If the context states business hours, availability, or booking policies, respect them when booking appointments - never promise a slot outside the stated availability.
- If no availability information exists in the context, collect the visitor's preferred date/time and let a human confirm.
- If the visitor provides their email and/or phone, capture it as a lead.
- Choose the department that best matches the visitor's request, but only when the context or the request clearly indicates one.
- Escalate ONLY when the visitor explicitly and insistently asks to speak to a human agent. Otherwise always answer in conversation and never push the visitor toward a human.

TOOLS (use them for side effects instead of just talking):
- Call "capture_lead" when the visitor shares their name, email, or phone. Pass only the fields you actually know; leave the rest out.
- Call "book_appointment" when the visitor wants to schedule a meeting and you have a concrete date and time. Use the exact date (YYYY-MM-DD) and 24h time (HH:MM) they gave.
- Call "send_confirmation_email" right after booking when you know the visitor's email, with a short friendly confirmation message.
- Only call a tool when you have the real data the visitor provided — never invent a date, time, or email address.

Reply with ONLY a single valid JSON object (no markdown, no extra text) in EXACTLY this shape:
{"reply":"your message to the visitor","intent":"question|appointment|lead_capture|routing|escalate","department":"<department name or null>","lead":{"name":null,"email":null,"phone":null},"appointment":{"date":"YYYY-MM-DD","time":"HH:MM","title":null}}
- Set "lead" fields to null when unknown.
- Set "appointment" to null unless the visitor wants to schedule something.
- "date" must be an actual date from the conversation (YYYY-MM-DD), "time" in 24h HH:MM format.`;
  }

  private extractJson(text: string | null): any | null {
    return extractJson(text);
  }

  private sanitizeIntent(value: any): ReceptionistResult['intent'] {
    const allowed = ['question', 'appointment', 'lead_capture', 'routing', 'escalate', 'other'];
    return allowed.includes(value) ? value : 'other';
  }

  private sanitizeLead(value: any): ReceptionistResult['lead'] | null {
    if (!value || typeof value !== 'object') return null;
    const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : null;
    const email = typeof value.email === 'string' && value.email.trim() ? value.email.trim() : null;
    const phone = typeof value.phone === 'string' && value.phone.trim() ? value.phone.trim() : null;
    return name || email || phone ? { name, email, phone } : null;
  }

  private sanitizeAppointment(value: any): ReceptionistResult['appointment'] | null {
    if (!value || typeof value !== 'object') return null;
    const date = typeof value.date === 'string' && value.date.trim() ? value.date.trim() : null;
    const time = typeof value.time === 'string' && value.time.trim() ? value.time.trim() : null;
    const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim() : null;
    return date || time || title ? { date, time, title } : null;
  }

  private matchDepartment(value: any, departments: any[]): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const normalized = value.trim().toLowerCase();
    const known = departments.find((d) => d.name.toLowerCase() === normalized);
    if (known) return known.name;
    // Fuzzy: LLM often returns something like "Sales" already; fall back to keyword match
    const match = departments.find((d) =>
      d.name.toLowerCase().includes(normalized) || normalized.includes(d.name.toLowerCase()),
    );
    return match?.name ?? null;
  }

  private keywordDepartment(text: string, departments: any[]): string | null {
    const lower = text.toLowerCase();
    for (const d of departments) {
      for (const kw of d.keywords || []) {
        if (lower.includes(kw.toLowerCase())) return d.name;
      }
    }
    return null;
  }

  private looksLikeAppointment(text: string): boolean {
    return /(appoint|book(?!s\b|store|marked)\w*|schedule|meeting|reserve|slot|availability|free (?:tomorrow|today|this week)|call(?:ing)? (?:me )?back|booking)/i.test(text);
  }

  private visitorWantsHuman(text: string, history?: { senderType: string; content: string }[]): boolean {
    const explicit = /(talk|speak|connect|reach|transfer|get)\s+(me\s+)?(to|with|a)\s+(a\s+)?(real\s+)?(human|agent|person|representative|support team|someone)|human agent|real person|talk to someone|i need a human|talk to an agent/i;
    if (explicit.test(text)) return true;
    if (history) {
      const recent = history.filter((m) => m.senderType === 'user').slice(-3);
      return recent.some((m) => explicit.test(m.content));
    }
    return false;
  }

  private extractEmail(text: string): string | null {
    const match = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    return match ? match[0].toLowerCase() : null;
  }

  private parseAppointmentDateTime(dateStr: string, timeStr: string): Date | null {
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!timeMatch || !dateMatch) return null;
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    const date = new Date(
      parseInt(dateMatch[1], 10),
      parseInt(dateMatch[2], 10) - 1,
      parseInt(dateMatch[3], 10),
      hour,
      minute,
    );
    return isNaN(date.getTime()) ? null : date;
  }

  private fallbackReply(context: string): string {
    if (context) {
      const firstLine = context.split('\n').find((l) => l.trim());
      return firstLine
        ? `Based on our information: ${firstLine.slice(0, 280)}`
        : "I've noted your question. Could you give me a little more detail so I can help you best?";
    }
    return "I'd be happy to help with that! Could you share a few more details about what you're looking for?";
  }

  private async generateAnswer(
    question: string,
    context: string,
    docTitle: string,
    companyId: string,
  ): Promise<string | null> {
    const system = `You are an expert assistant that answers questions strictly from the provided document content.
Answer accurately and concisely (2-6 sentences), in the same language as the question.
If the context does not contain the answer, say so and suggest rephrasing. Never invent facts.
Document: ${docTitle}`;
    return this.chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` },
      ],
      1024,
      'kb_document_answer',
      companyId,
    );
  }

  private async generateSummary(text: string, docTitle: string, companyId: string): Promise<string | null> {
    const system = `You are an expert document analyst. Write a clear, structured summary of the given document.
Cover the main topics, key points, and any important details. Use short bullet points plus a 2-3 sentence overview.`;
    return this.chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: `Document title: ${docTitle}\n\nDocument content:\n${text}` },
      ],
      1024,
      'kb_document_summary',
      companyId,
    );
  }

  /**
   * Terms for the keyword (ILIKE) fallback. Stopwords are dropped so the score
   * reflects real term overlap instead of matching "what"/"your" everywhere.
   */
  private extractTerms(question: string): string[] {
    const words = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !KEYWORD_STOPWORDS.has(w));
    return [...new Set(words)].slice(0, 6);
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    // Clear the timer on settle so a pending timeout cannot hold a serverless
    // invocation (or a test run) open.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h;
}
