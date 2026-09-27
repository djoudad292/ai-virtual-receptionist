import { AIMessage } from '@langchain/core/messages';

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn(),
}));

import { ChatOpenAI } from '@langchain/openai';
import { runReceptionistGraph, createLLM } from './agent.graph';

describe('createLLM', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('returns primary and a non-null fallback when both keys are set', () => {
    process.env.OPENROUTER_API_KEY = 'or-key';
    process.env.GEMINI_API_KEY = 'gem-key';

    const { primary, fallback } = createLLM();

    expect(primary).toBeInstanceOf(ChatOpenAI);
    expect(fallback).not.toBeNull();
    expect(primary).not.toBe(fallback);
    expect(ChatOpenAI).toHaveBeenCalledTimes(2);
  });

  it('returns null fallback when only OPENROUTER_API_KEY is set', () => {
    delete process.env.GEMINI_API_KEY;
    process.env.OPENROUTER_API_KEY = 'or-key';

    const { primary, fallback } = createLLM();

    expect(primary).toBeInstanceOf(ChatOpenAI);
    expect(fallback).toBeNull();
    expect(ChatOpenAI).toHaveBeenCalledTimes(1);
  });

  it('returns primary and null fallback when only GEMINI_API_KEY is set', () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.GEMINI_API_KEY = 'gem-key';

    const { primary, fallback } = createLLM();

    expect(primary).toBeInstanceOf(ChatOpenAI);
    expect(fallback).toBeNull();
    expect(ChatOpenAI).toHaveBeenCalledTimes(1);
  });

  it('throws when neither key is configured', () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GEMINI_API_KEY;

    expect(() => createLLM()).toThrow(/No LLM API key configured/);
    expect(ChatOpenAI).not.toHaveBeenCalled();
  });
});

describe('runReceptionistGraph trace', () => {
  let store: { [key: string]: jest.Mock };
  let mail: { [key: string]: jest.Mock };
  let aiService: { [key: string]: jest.Mock };
  let invoke: jest.Mock;

  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test-key';
    delete process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function mockLlm(responses: any[]) {
    invoke = jest.fn();
    for (const response of responses) {
      invoke.mockImplementationOnce(() => Promise.resolve(response));
    }
    invoke.mockImplementation(() => Promise.resolve(new AIMessage({ content: '{"reply":"done","intent":"question"}' })));
    (ChatOpenAI as unknown as jest.Mock).mockImplementation(() => {
      const bound: any = { invoke };
      bound.withFallbacks = () => bound;
      return { bindTools: () => bound };
    });
  }

  beforeEach(() => {
    store = {
      findCompanyById: jest.fn().mockResolvedValue({ id: 'c1', name: 'Demo Co' }),
      listDepartments: jest.fn().mockResolvedValue([{ name: 'Support', keywords: ['help'] }]),
      findLeadByConversation: jest.fn().mockResolvedValue(null),
      createLead: jest.fn().mockImplementation((d) => Promise.resolve({ ...d, id: 'lead-1' })),
      updateLead: jest.fn().mockImplementation((id, d) => Promise.resolve({ id, ...d })),
      updateConversation: jest.fn().mockResolvedValue({ id: 'conv1' }),
    };
    mail = { send: jest.fn().mockResolvedValue(true) };
    aiService = { ragSearchPublic: jest.fn() };
    jest.clearAllMocks();
  });

  function run() {
    return runReceptionistGraph({
      userMessage: 'hello there',
      companyId: 'c1',
      conversationId: 'conv1',
      store: store as any,
      mail: mail as any,
      aiService: aiService as any,
    });
  }

  it('records a rag step with chunk count, top similarity and document titles', async () => {
    (aiService.ragSearchPublic as jest.Mock).mockResolvedValue({
      context: 'ctx',
      results: [
        { chunkText: 'a', similarity: 0.912, documentTitle: 'Pricing' },
        { chunkText: 'b', similarity: 0.4, documentTitle: 'Pricing' },
        { chunkText: 'c', similarity: 0.7, documentTitle: 'Hours' },
      ],
    });
    mockLlm([]);

    const result = await run();

    expect(result.steps[0]).toEqual({
      node: 'rag',
      label: 'Retrieved 3 document chunks',
      detail: { chunksFound: 3, topSimilarity: 0.91, documentTitles: ['Pricing', 'Hours'] },
    });
    expect(result.steps[result.steps.length - 1]).toEqual({
      node: 'parse',
      label: 'Parsed assistant output',
      detail: { intent: 'question', department: null, source: 'ai' },
    });
  });

  it('records agent, tool and parse steps with truncated args and results', async () => {
    (aiService.ragSearchPublic as jest.Mock).mockResolvedValue({ context: '', results: [] });

    const longText = 'x'.repeat(900);
    mockLlm([
      new AIMessage({
        content: '',
        tool_calls: [{ id: 'c1', name: 'capture_lead', args: { name: 'Alice', note: longText }, type: 'tool_call' }],
      }),
      new AIMessage({ content: '{"reply":"Thanks Alice","intent":"lead_capture"}' }),
    ]);

    const result = await run();

    const nodes = result.steps.map((s) => s.node);
    expect(nodes).toEqual(['rag', 'agent', 'tools', 'agent', 'parse']);
    expect(result.steps[1].label).toBe('Model requested tools');
    expect((result.steps[1].detail as any).textPreview).toBe('');
    expect((result.steps[1].detail as any).toolCalls).toEqual([
      { name: 'capture_lead', args: { name: 'Alice', note: `${'x'.repeat(500)}…` } },
    ]);
    expect(result.steps[2].label).toBe('Called tool capture_lead');

    const toolDetail = result.steps[2].detail as any;
    expect(String(toolDetail.args.note)).toHaveLength(501);
    expect(String(toolDetail.args.note).endsWith('…')).toBe(true);
    expect(toolDetail.name).toBe('capture_lead');

    // The trace must survive JSON serialization (stored in the message metadata JSONB).
    expect(JSON.parse(JSON.stringify(result.steps))).toEqual(result.steps);
  });

  it('records a step for unknown tool calls instead of throwing', async () => {
    (aiService.ragSearchPublic as jest.Mock).mockResolvedValue({ context: '', results: [] });
    mockLlm([
      new AIMessage({
        content: '',
        tool_calls: [{ id: 'c1', name: 'no_such_tool', args: {}, type: 'tool_call' }],
      }),
      new AIMessage({ content: '{"reply":"ok","intent":"other"}' }),
    ]);

    const result = await run();

    expect(result.steps.some((s) => s.node === 'tools' && s.label === 'Unknown tool no_such_tool')).toBe(true);
  });

  it('records a parse failure step when the model returns unparseable output', async () => {
    (aiService.ragSearchPublic as jest.Mock).mockResolvedValue({ context: '', results: [] });
    mockLlm([new AIMessage({ content: 'no json here' })]);

    const result = await run();

    const last = result.steps[result.steps.length - 1];
    expect(last).toEqual({ node: 'parse', label: 'Output parsing failed, used defaults' });
    expect(result.response).toBe('no json here');
  });
});
