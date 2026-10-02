import { Test } from '@nestjs/testing';
import { StoreService } from './store.service';
import { DatabaseService } from './database.service';
import { EmbeddingsUnavailableError, markHashVector } from '../ai/embeddings.service';

describe('StoreService vector search guard', () => {
  let store: StoreService;
  let db: { [key: string]: jest.Mock };

  beforeEach(async () => {
    db = { query: jest.fn().mockResolvedValue([]), queryOne: jest.fn().mockResolvedValue(null), execute: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [StoreService, { provide: DatabaseService, useValue: db }],
    }).compile();
    store = moduleRef.get(StoreService);
  });

  const vectorSearches: [string, (...args: any[]) => Promise<unknown>][] = [
    ['searchChunks', (embedding: number[]) => store.searchChunks('c1', embedding)],
    ['searchChunksByDocument', (embedding: number[]) => store.searchChunksByDocument('doc-1', embedding)],
    ['searchChunksPublished', (embedding: number[]) => store.searchChunksPublished('c1', embedding)],
    ['searchChunksFull', (embedding: number[]) => store.searchChunksFull('c1', embedding)],
  ];

  it.each(vectorSearches)('%s refuses a hash-fallback embedding instead of returning nonsense', async (_name, call) => {
    const hashVector = markHashVector(new Array(1536).fill(0).map((_, i) => (i % 3 === 0 ? 1 : 0)));

    await expect(call(hashVector)).rejects.toBeInstanceOf(EmbeddingsUnavailableError);
    expect(db.query).not.toHaveBeenCalled();
  });

  it.each(vectorSearches)('%s still runs a real vector search for a real embedding', async (_name, call) => {
    const realVector = new Array(1536).fill(0.01);

    await call(realVector);

    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
