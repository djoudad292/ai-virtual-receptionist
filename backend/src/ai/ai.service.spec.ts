import { Test } from '@nestjs/testing';
import { AIService } from './ai.service';
import { EmbeddingsService } from './embeddings.service';
import { StoreService } from '../common/store.service';
import { MailService } from '../common/mail.service';

jest.mock('./langgraph/agent.graph', () => ({
  runReceptionistGraph: jest.fn(),
}));

import { runReceptionistGraph } from './langgraph/agent.graph';

describe('AIService tool-calling loop', () => {
  let aiService: AIService;
  let store: { [key: string]: jest.Mock };
  let mail: { [key: string]: jest.Mock };

  beforeEach(async () => {
    store = {
      findCompanyById: jest.fn().mockResolvedValue({ id: 'c1', name: 'Demo Co' }),
      listDepartments: jest.fn().mockResolvedValue([]),
      findConversationById: jest.fn().mockResolvedValue({ id: 'conv1', metadata: {} }),
      findLeadByConversation: jest.fn().mockResolvedValue(null),
      createLead: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'lead-1' })),
      updateLead: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
      createAppointment: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'appt-1' })),
      updateConversation: jest.fn().mockResolvedValue({ id: 'conv1' }),
    };
    mail = { send: jest.fn().mockResolvedValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: StoreService, useValue: store },
        { provide: MailService, useValue: mail },
        { provide: EmbeddingsService, useValue: new EmbeddingsService() },
      ],
    }).compile();

    aiService = moduleRef.get(AIService);
    jest.clearAllMocks();
  });

  it('executes capture_lead when the model invokes the tool', async () => {
    // Stub ragSearch + the tool loop: first turn returns a tool call, second returns the final reply.
    (aiService as any).ragSearch = jest.fn().mockResolvedValue({ context: '', results: [], bestSimilarity: 0 });
    let calls = 0;
    (aiService as any).chatWithTools = jest.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) {
        return {
          content: null,
          toolCalls: [
            { id: 'call_1', name: 'capture_lead', args: { name: 'Alice', email: 'alice@b.com', phone: '123' } },
          ],
        };
      }
      return {
        content: '{"reply":"Thanks Alice, I have your details!","intent":"lead_capture"}',
        toolCalls: [],
      };
    });

    const result = await aiService.generateResponse('c1', 'my email is alice@b.com', undefined, 'conv1');

    expect(store.createLead).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'c1', conversationId: 'conv1', email: 'alice@b.com', name: 'Alice' }),
    );
    expect(store.updateConversation).toHaveBeenCalledWith('conv1', { leadId: 'lead-1' });
    expect(result.lead).toEqual({ name: 'Alice', email: 'alice@b.com', phone: '123' });
    expect(result.intent).toBe('lead_capture');
    expect(result.response).toContain('Thanks Alice');
  });

  it('executes book_appointment and sets intent to appointment', async () => {
    (aiService as any).ragSearch = jest.fn().mockResolvedValue({ context: '', results: [], bestSimilarity: 0 });
    let calls = 0;
    (aiService as any).chatWithTools = jest.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) {
        return {
          content: null,
          toolCalls: [
            { id: 'call_1', name: 'book_appointment', args: { date: '2026-01-02', time: '14:00' } },
          ],
        };
      }
      return {
        content: '{"reply":"Booked for Jan 2 at 2pm!","intent":"appointment"}',
        toolCalls: [],
      };
    });

    const result = await aiService.generateResponse('c1', 'book tomorrow at 2pm', undefined, 'conv1');

    expect(store.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'c1', conversationId: 'conv1', title: 'Scheduled meeting' }),
    );
    expect(store.updateConversation).toHaveBeenCalledWith(
      'conv1',
      expect.objectContaining({ metadata: expect.objectContaining({ appointmentBooked: true }) }),
    );
    expect(result.appointment).toEqual({ date: '2026-01-02', time: '14:00', title: 'Scheduled meeting' });
    expect(result.intent).toBe('appointment');
  });

  it('sends a confirmation email when the model invokes send_confirmation_email', async () => {
    (aiService as any).ragSearch = jest.fn().mockResolvedValue({ context: '', results: [], bestSimilarity: 0 });
    let calls = 0;
    (aiService as any).chatWithTools = jest.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) {
        return {
          content: null,
          toolCalls: [
            {
              id: 'call_1',
              name: 'send_confirmation_email',
              args: { to: 'alice@b.com', subject: 'Booking confirmed', body: 'See you at 2pm' },
            },
          ],
        };
      }
      return { content: '{"reply":"Confirmation email sent!","intent":"appointment"}', toolCalls: [] };
    });

    const result = await aiService.generateResponse('c1', 'book tomorrow', undefined, 'conv1');

    expect(mail.send).toHaveBeenCalledWith({
      to: 'alice@b.com',
      subject: 'Booking confirmed',
      text: 'See you at 2pm',
    });
    expect(result.response).toContain('Confirmation email sent');
  });

  it('returns an error result for unknown tools without crashing', async () => {
    (aiService as any).ragSearch = jest.fn().mockResolvedValue({ context: '', results: [], bestSimilarity: 0 });
    (aiService as any).chatWithTools = jest.fn().mockResolvedValueOnce({
      content: null,
      toolCalls: [{ id: 'call_1', name: 'no_such_tool', args: {} }],
    });
    (aiService as any).chatWithTools = jest.fn().mockImplementation(() => ({
      content: null,
      toolCalls: [],
    }));

    const result = await aiService.generateResponse('c1', 'hello', undefined, 'conv1');
    expect(result.response).toBeDefined();
    expect(typeof result.response).toBe('string');
  });
});

describe('AIService generateResponse mode parameter', () => {
  let aiService: AIService;
  let store: { [key: string]: jest.Mock };
  let mail: { [key: string]: jest.Mock };

  beforeEach(async () => {
    store = {
      findCompanyById: jest.fn().mockResolvedValue({ id: 'c1', name: 'Demo Co' }),
      listDepartments: jest.fn().mockResolvedValue([]),
      findConversationById: jest.fn().mockResolvedValue({ id: 'conv1', metadata: {} }),
      findLeadByConversation: jest.fn().mockResolvedValue(null),
      createLead: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'lead-1' })),
      updateLead: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
      createAppointment: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'appt-1' })),
      updateConversation: jest.fn().mockResolvedValue({ id: 'conv1' }),
    };
    mail = { send: jest.fn().mockResolvedValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: StoreService, useValue: store },
        { provide: MailService, useValue: mail },
        { provide: EmbeddingsService, useValue: new EmbeddingsService() },
      ],
    }).compile();

    aiService = moduleRef.get(AIService);
    jest.clearAllMocks();
  });

  it('receptionist mode calls generateResponseLegacy directly and never imports LangGraph', async () => {
    (aiService as any).ragSearch = jest.fn().mockResolvedValue({ context: '', results: [], bestSimilarity: 0 });
    (aiService as any).chatWithTools = jest.fn().mockResolvedValue({
      content: '{"reply":"Hello from legacy","intent":"question"}',
      toolCalls: [],
    });

    // Make runReceptionistGraph throw if called - this should never be reached in receptionist mode
    (runReceptionistGraph as jest.Mock).mockRejectedValue(new Error('LangGraph should not be called'));

    const result = await aiService.generateResponse('c1', 'hello', undefined, 'conv1', { mode: 'receptionist' });

    expect(runReceptionistGraph).not.toHaveBeenCalled();
    expect(result.response).toBe('Hello from legacy');
    expect(result.intent).toBe('question');
    expect(result.sources).toEqual([]);
    expect(result.steps).toBeUndefined();
  });

  it('support mode (explicit) attempts LangGraph and falls back to legacy on error', async () => {
    (aiService as any).ragSearch = jest.fn().mockResolvedValue({ context: 'kb context', results: [{ chunkText: 'kb', similarity: 0.5 }], bestSimilarity: 0.5 });
    (aiService as any).chatWithTools = jest.fn().mockResolvedValue({
      content: '{"reply":"Fallback reply","intent":"question"}',
      toolCalls: [],
    });

    // LangGraph throws, should fall back to legacy
    (runReceptionistGraph as jest.Mock).mockRejectedValue(new Error('LangGraph unavailable'));

    const result = await aiService.generateResponse('c1', 'hello', undefined, 'conv1', { mode: 'support' });

    expect(runReceptionistGraph).toHaveBeenCalledTimes(1);
    expect(result.response).toBe('Fallback reply');
    expect(result.intent).toBe('question');
  });

  it('default mode (omitted) attempts LangGraph and falls back to legacy on error', async () => {
    (aiService as any).ragSearch = jest.fn().mockResolvedValue({ context: 'kb context', results: [{ chunkText: 'kb', similarity: 0.5 }], bestSimilarity: 0.5 });
    (aiService as any).chatWithTools = jest.fn().mockResolvedValue({
      content: '{"reply":"Default fallback","intent":"question"}',
      toolCalls: [],
    });

    // LangGraph throws, should fall back to legacy
    (runReceptionistGraph as jest.Mock).mockRejectedValue(new Error('LangGraph unavailable'));

    const result = await aiService.generateResponse('c1', 'hello', undefined, 'conv1');

    expect(runReceptionistGraph).toHaveBeenCalledTimes(1);
    expect(result.response).toBe('Default fallback');
    expect(result.intent).toBe('question');
  });

  it('support mode returns LangGraph result when it succeeds', async () => {
    (runReceptionistGraph as jest.Mock).mockResolvedValue({
      response: 'LangGraph response',
      source: 'ai',
      intent: 'question',
      department: 'Support',
      lead: null,
      appointment: null,
      sources: [{ chunkText: 'lg', similarity: 0.9 }],
    });

    const result = await aiService.generateResponse('c1', 'hello', undefined, 'conv1', { mode: 'support' });

    expect(runReceptionistGraph).toHaveBeenCalledTimes(1);
    expect(result.response).toBe('LangGraph response');
    expect(result.source).toBe('ai');
    expect(result.confidence).toBe(0.9);
  });

  it('support mode maps the graph trace steps into the result', async () => {
    const steps = [
      { node: 'rag', label: 'Retrieved 2 document chunks', detail: { chunksFound: 2, topSimilarity: 0.81 } },
      { node: 'tools', label: 'Called tool capture_lead', detail: { name: 'capture_lead', args: { email: 'a@b.com' } } },
      { node: 'parse', label: 'Parsed assistant output', detail: { intent: 'lead_capture' } },
    ];
    (runReceptionistGraph as jest.Mock).mockResolvedValue({
      response: 'Thanks Alice',
      source: 'ai',
      intent: 'lead_capture',
      department: null,
      lead: { name: 'Alice', email: 'a@b.com', phone: null },
      appointment: null,
      sources: [],
      steps,
    });

    const result = await aiService.generateResponse('c1', 'alice@a.com', undefined, 'conv1', { mode: 'support' });

    expect(result.steps).toEqual(steps);
  });

  it('support mode leaves steps undefined when the graph returns none', async () => {
    (runReceptionistGraph as jest.Mock).mockResolvedValue({
      response: 'No trace',
      source: 'ai',
      intent: 'question',
      department: null,
      lead: null,
      appointment: null,
      sources: [],
    });

    const result = await aiService.generateResponse('c1', 'hello', undefined, 'conv1', { mode: 'support' });

    expect(result.steps).toBeUndefined();
  });
});

describe('AIService.shouldFallbackToGemini', () => {
  let aiService: AIService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: StoreService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: EmbeddingsService, useValue: new EmbeddingsService() },
      ],
    }).compile();
    aiService = moduleRef.get(AIService);
    jest.clearAllMocks();
  });

  const fn = (msg: string) => (aiService as any).shouldFallbackToGemini(msg);

  it('returns true for 402 insufficient credits', () => {
    expect(fn('OpenRouter HTTP 402: insufficient credits')).toBe(true);
  });

  it('returns true for 429 free-models-per-day', () => {
    expect(fn('Rate limit exceeded: free-models-per-day')).toBe(true);
  });

  it('returns true for HTTP 429 rate limit exceeded', () => {
    expect(fn('OpenRouter HTTP 429: rate limit exceeded')).toBe(true);
  });

  it('returns false for transient 503', () => {
    expect(fn('OpenRouter HTTP 503: request queue is full')).toBe(false);
  });

  it('returns false for generic text', () => {
    expect(fn('something else happened')).toBe(false);
  });
});

describe('AIService.buildActions', () => {
  let aiService: AIService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: StoreService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: EmbeddingsService, useValue: new EmbeddingsService() },
      ],
    }).compile();
    aiService = moduleRef.get(AIService);
  });

  it('returns lead, appointment, email in order when all side-effects are present', () => {
    const persisted = { leadId: 'lead-1', appointmentId: 'appt-1' };
    const executed = {
      lead: { name: 'Alice', email: 'alice@b.com', phone: '123' },
      appointment: { date: '2026-01-02', time: '14:00', title: 'Meeting' },
      email: { to: 'alice@b.com', sent: true },
    };
    const result = {
      lead: { name: 'Alice', email: 'alice@b.com', phone: '123' },
      appointment: { date: '2026-01-02', time: '14:00', title: 'Meeting' },
    } as any;

    const actions = (aiService as any).buildActions(persisted, executed, result);

    expect(actions).toHaveLength(3);
    expect(actions[0]).toEqual({
      type: 'lead',
      ok: true,
      id: 'lead-1',
      detail: 'Alice · alice@b.com',
    });
    expect(actions[1]).toEqual({
      type: 'appointment',
      ok: true,
      id: 'appt-1',
      detail: '2026-01-02 · 14:00 · Meeting',
    });
    expect(actions[2]).toEqual({
      type: 'email',
      ok: true,
      detail: 'alice@b.com',
    });
  });

  it('returns an empty array (and result.actions stays omitted) when nothing happened', () => {
    const persisted = { leadId: null, appointmentId: null };
    const executed = {};
    const result = { lead: null, appointment: null } as any;

    const actions = (aiService as any).buildActions(persisted, executed, result);

    expect(actions).toEqual([]);
  });

  it('marks email ok:false when SMTP is disabled (sent is false)', () => {
    const persisted = { leadId: null, appointmentId: null };
    const executed = { email: { to: 'alice@b.com', sent: false } };
    const result = {} as any;

    const actions = (aiService as any).buildActions(persisted, executed, result);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: 'email',
      ok: false,
      detail: 'alice@b.com',
    });
    expect(actions[0].ok).toBe(false);
  });
});