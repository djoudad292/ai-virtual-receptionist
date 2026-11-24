import { Logger } from '@nestjs/common';

jest.mock('@langfuse/tracing', () => {
  let mockStartObservation: (name: string, attrs?: any, opts?: any) => Promise<any> = async () => ({
    update: jest.fn(),
    end: jest.fn(),
    id: 'test-span-id',
  });

  return {
    get startObservation() {
      return mockStartObservation;
    },
    setStartObservation(fn: typeof mockStartObservation) {
      mockStartObservation = fn;
    },
    __resetMocks() {
      mockStartObservation = async () => ({
        update: jest.fn(),
        end: jest.fn(),
        id: 'test-span-id',
      });
    },
  };
});

describe('observability (generation spans)', () => {
  const originalEnv = { ...process.env };
  let logger: Logger;
  let tracingMock: any;

  beforeEach(async () => {
    jest.resetModules();
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    logger = new Logger('Test');
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

    tracingMock = await import('@langfuse/tracing');
    tracingMock.__resetMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe('traceGeneration', () => {
    it("returns fn()'s value untouched when tracing is disabled", async () => {
      const { initTracing } = await import('./observability.module');
      initTracing(logger);

      const { traceGeneration } = await import('./generation-span');

      const result = await traceGeneration(
        { name: 'test', model: 'gpt-4', feature: 'chat' },
        async () => 'hello',
      );

      expect(result).toBe('hello');
    });

    it("propagates fn's rejection unchanged when tracing is disabled", async () => {
      const { initTracing } = await import('./observability.module');
      initTracing(logger);

      const { traceGeneration } = await import('./generation-span');

      await expect(
        traceGeneration(
          { name: 'test', model: 'gpt-4', feature: 'chat' },
          async () => {
            throw new Error('boom');
          },
        ),
      ).rejects.toThrow('boom');
    });

    it('resolves normally when startObservation is made to throw (mock it to throw)', async () => {
      const { initTracing } = await import('./observability.module');
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test';
      process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test';
      initTracing(logger);

      tracingMock.setStartObservation(() => {
        throw new Error('startObservation failed');
      });

      const { traceGeneration } = await import('./generation-span');

      const result = await traceGeneration(
        { name: 'test', model: 'gpt-4', feature: 'chat' },
        async () => 'hello',
      );

      expect(result).toBe('hello');
    });

    it("propagates fn's error while still ending the span when enabled", async () => {
      const { initTracing } = await import('./observability.module');
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test';
      process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test';
      initTracing(logger);

      let capturedSpan: any = null;
      const originalFn = tracingMock.startObservation;
      tracingMock.setStartObservation(async (name: string, attrs?: any, opts?: any) => {
        const span = await originalFn(name, attrs, opts);
        capturedSpan = span;
        return span;
      });

      const { traceGeneration } = await import('./generation-span');

      await expect(
        traceGeneration(
          { name: 'test', model: 'gpt-4', feature: 'chat' },
          async () => {
            throw new Error('boom');
          },
        ),
      ).rejects.toThrow('boom');

      expect(capturedSpan).not.toBeNull();
      expect(capturedSpan.end).toHaveBeenCalled();
    });
  });

  describe('traceEmbedding', () => {
    it("returns fn()'s value untouched when tracing is disabled", async () => {
      const { initTracing } = await import('./observability.module');
      initTracing(logger);

      const { traceEmbedding } = await import('./generation-span');

      const result = await traceEmbedding(
        { name: 'test', model: 'text-embedding-3-small', feature: 'embeddings' },
        async () => [0.1, 0.2, 0.3],
      );

      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it("propagates fn's rejection unchanged when tracing is disabled", async () => {
      const { initTracing } = await import('./observability.module');
      initTracing(logger);

      const { traceEmbedding } = await import('./generation-span');

      await expect(
        traceEmbedding(
          { name: 'test', model: 'text-embedding-3-small', feature: 'embeddings' },
          async () => {
            throw new Error('embedding failed');
          },
        ),
      ).rejects.toThrow('embedding failed');
    });

    it('resolves normally when startObservation throws for embeddings', async () => {
      const { initTracing } = await import('./observability.module');
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test';
      process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test';
      initTracing(logger);

      tracingMock.setStartObservation(() => {
        throw new Error('startObservation failed');
      });

      const { traceEmbedding } = await import('./generation-span');

      const result = await traceEmbedding(
        { name: 'test', model: 'text-embedding-3-small', feature: 'embeddings' },
        async () => [0.1, 0.2, 0.3],
      );

      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it("propagates fn's error while still ending the span when enabled for embeddings", async () => {
      const { initTracing } = await import('./observability.module');
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test';
      process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test';
      initTracing(logger);

      let capturedSpan: any = null;
      const originalFn = tracingMock.startObservation;
      tracingMock.setStartObservation(async (name: string, attrs?: any, opts?: any) => {
        const span = await originalFn(name, attrs, opts);
        capturedSpan = span;
        return span;
      });

      const { traceEmbedding } = await import('./generation-span');

      await expect(
        traceEmbedding(
          { name: 'test', model: 'text-embedding-3-small', feature: 'embeddings' },
          async () => {
            throw new Error('embedding boom');
          },
        ),
      ).rejects.toThrow('embedding boom');

      expect(capturedSpan).not.toBeNull();
      expect(capturedSpan.end).toHaveBeenCalled();
    });
  });
});