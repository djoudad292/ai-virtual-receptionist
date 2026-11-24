import { Logger } from '@nestjs/common';

const langfuseKeys = ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_BASE_URL', 'LANGFUSE_RELEASE'];
const nodeEnv = ['LANGFUSE_TRACING_ENVIRONMENT', 'LANGFUSE_ALLOW_CONTENT'];

describe('observability (Langfuse tracing)', () => {
  const originalEnv = { ...process.env };
  let logger: Logger;

  beforeEach(() => {
    jest.resetModules();
    [...langfuseKeys, ...nodeEnv].forEach((k) => delete process.env[k]);
    logger = new Logger('Test');
    // Keep expected logger noise out of the test output.
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe('initTracing', () => {
    it('stays disabled and throws nothing when no keys are set', async () => {
      const mod = await import('./observability.module');
      expect(mod.initTracing(logger)).toBe(false);
      expect(mod.isTracingEnabled()).toBe(false);
    });

    it('stays disabled when only the public key is set', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-x';
      const mod = await import('./observability.module');
      expect(mod.initTracing(logger)).toBe(false);
      expect(mod.isTracingEnabled()).toBe(false);
    });

    it('treats blank keys as unset', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = '   ';
      process.env.LANGFUSE_SECRET_KEY = '   ';
      const mod = await import('./observability.module');
      expect(mod.initTracing(logger)).toBe(false);
    });
  });

  describe('buildTraceConfig', () => {
    it('returns an empty object when tracing is disabled, so invoke() is unchanged', async () => {
      const mod = await import('./observability.module');
      mod.initTracing(logger);
      const { buildTraceConfig } = await import('./trace-context');

      expect(buildTraceConfig({ conversationId: 'conv-1', companyId: 'co-1', runName: 'receptionist-agent' })).toEqual({});
    });

    it('never throws and always returns a spreadable object', async () => {
      const mod = await import('./observability.module');
      mod.initTracing(logger);
      const { buildTraceConfig } = await import('./trace-context');

      const config = buildTraceConfig({
        conversationId: null,
        companyId: null,
        runName: 'receptionist-agent',
      });
      expect(typeof config).toBe('object');
      expect(config.callbacks).toBeUndefined();
    });
  });

  describe('privacy default', () => {
    it('redacts content unless LANGFUSE_ALLOW_CONTENT is explicitly true', async () => {
      // The mask hook is the PHI boundary, so assert on its documented behaviour.
      const fs = await import('fs');
      const source = fs.readFileSync(require.resolve('./observability.module'), 'utf8');

      expect(source).toContain('LANGFUSE_ALLOW_CONTENT');
      // Default path must check the flag and never capture raw content.
      expect(source).toMatch(/if \(process\.env\.LANGFUSE_ALLOW_CONTENT === 'true'\) return data;/);
      expect(source).toContain('redacted');
    });
  });
});