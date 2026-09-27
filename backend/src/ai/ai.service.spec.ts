import { Test } from '@nestjs/testing';
import { AIService } from './ai.service';
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
});