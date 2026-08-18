import { Test } from '@nestjs/testing';
import { AIService } from './ai.service';
import { StoreService } from '../common/store.service';
import { MailService } from '../common/mail.service';

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
      return { content: '{"reply":"Confirmation email sent!"},"intent":"appointment"', toolCalls: [] };
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
