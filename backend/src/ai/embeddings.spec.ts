import { Test } from '@nestjs/testing';
import { AIService } from './ai.service';
import { EmbeddingsService, EmbeddingsUnavailableError, allowHashEmbeddings } from './embeddings.service';
import { StoreService } from '../common/store.service';
import { MailService } from '../common/mail.service';

const CHUNK = {
  id: 'chunk-1',
  chunkText: 'Business hours are 9am to 5pm EST, Monday to Friday.',
  documentId: 'doc-1',
  documentTitle: 'Company Info',
  similarity: 0.66,
};

describe('embeddings degradation contract', () => {
  const savedEnv = { ...process.env };
  let aiService: AIService;
  let embeddings: EmbeddingsService;
  let store: { [key: string]: jest.Mock };

  beforeEach(async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ALLOW_HASH_EMBEDDINGS;
    delete process.env.EMBEDDING_MODEL;

    store = {
      countChunks: jest.fn().mockResolvedValue(1),
      searchChunksPublished: jest.fn().mockResolvedValue([]),
      searchChunksPublishedKeyword: jest.fn().mockResolvedValue([CHUNK]),
      searchChunksByDocument: jest.fn().mockResolvedValue([]),
      searchChunksByDocumentKeyword: jest.fn().mockResolvedValue([CHUNK]),
      searchChunksFull: jest.fn().mockResolvedValue([]),
      recordRetrievalMetric: jest.fn().mockResolvedValue(undefined),
      recordLlmUsage: jest.fn().mockResolvedValue(undefined),
      findDocumentById: jest.fn().mockResolvedValue({ id: 'doc-1', companyId: 'c1', title: 'Company Info' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: StoreService, useValue: store },
        { provide: MailService, useValue: { send: jest.fn().mockResolvedValue(true) } },
        { provide: EmbeddingsService, useClass: EmbeddingsService },
      ],
    }).compile();

    aiService = moduleRef.get(AIService);
    embeddings = moduleRef.get(EmbeddingsService);
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = savedEnv;
  });

  it('throws EmbeddingsUnavailableError when no key is set and hash embeddings are not allowed', async () => {
    await expect(aiService.generateEmbedding('hello')).rejects.toBeInstanceOf(EmbeddingsUnavailableError);
    expect(allowHashEmbeddings()).toBe(false);
  });

  it('never touches the vector search path in degraded mode — it uses keyword scoring', async () => {
    const outcome = await (aiService as any).ragSearch('c1', 'what are your opening hours?');

    expect(outcome.mode).toBe('keyword-degraded');
    expect(store.searchChunksPublished).not.toHaveBeenCalled();
    expect(store.searchChunksFull).not.toHaveBeenCalled();
    expect(store.searchChunksPublishedKeyword).toHaveBeenCalledTimes(1);
    expect(outcome.results).toHaveLength(1);
    expect(outcome.context).toContain('Business hours');
  });

  it('reports the degradation mode and answers from keyword results', async () => {
    const answer = await aiService.askCompanyPublished('c1', 'what are your opening hours?');

    expect(answer.retrievalMode).toBe('keyword-degraded');
    expect(answer.answer).toBeDefined();
    expect(store.recordRetrievalMetric).toHaveBeenCalledWith('c1', 'keyword-degraded', 1);
  });

  it('returns { results, mode } from searchKnowledgeBase', async () => {
    const outcome = await aiService.searchKnowledgeBase('c1', 'opening hours');

    expect(outcome).toEqual({ results: [CHUNK], mode: 'keyword-degraded' });
    expect(Array.isArray(outcome)).toBe(false);
  });

  it('reports keyword-degraded for a single-document question', async () => {
    const answer = await aiService.askKnowledgeDocument('c1', 'doc-1', 'when are you open?');

    expect(answer.retrievalMode).toBe('keyword-degraded');
    expect(store.searchChunksByDocument).not.toHaveBeenCalled();
    expect(store.searchChunksByDocumentKeyword).toHaveBeenCalledTimes(1);
  });

  it('serves hash vectors only when ALLOW_HASH_EMBEDDINGS is explicitly true, and labels them hash-fallback', async () => {
    process.env.ALLOW_HASH_EMBEDDINGS = 'true';
    const fresh = new EmbeddingsService();
    (aiService as any).embeddings = fresh;

    const vector = await aiService.generateEmbedding('business hours');
    expect(vector).toHaveLength(1536);
    expect(fresh.getMode()).toBe('hash-fallback');

    // A hash vector must never reach pgvector search.
    const outcome = await (aiService as any).ragSearch('c1', 'business hours');
    expect(outcome.mode).toBe('hash-fallback');
    expect(store.searchChunksPublished).not.toHaveBeenCalled();
    expect(store.searchChunksPublishedKeyword).toHaveBeenCalledTimes(1);
  });

  it('exposes an honest health snapshot', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ALLOW_HASH_EMBEDDINGS;
    const status = new EmbeddingsService();

    expect(status.snapshot()).toEqual({
      mode: 'vector',
      model: 'text-embedding-3-small',
      openaiConfigured: false,
      allowHashEmbeddings: false,
      lastEmbeddingSuccessAt: null,
      lastDegradedAt: null,
    });
  });
});
