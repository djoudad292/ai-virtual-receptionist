import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DemoService, buildIntakeContext } from './demo.service';
import { DemoController } from './demo.controller';
import { StoreService } from '../common/store.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { AIService } from '../ai/ai.service';

const VALID_SESSION = 'test-session-1';

describe('DemoController validation', () => {
  let controller: DemoController;
  let service: { [key: string]: jest.Mock };

  beforeEach(async () => {
    service = {
      ask: jest.fn().mockResolvedValue({ response: 'OK', source: 'ai', intent: 'question', confidence: 0.9 }),
      upload: jest.fn().mockResolvedValue({ id: 'd1', title: 'test', expiresAt: new Date() }),
      listDocuments: jest.fn().mockResolvedValue({ documents: [] }),
      listAppointments: jest.fn().mockResolvedValue({ appointments: [] }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [DemoController],
      providers: [{ provide: DemoService, useValue: service }],
    }).compile();

    controller = moduleRef.get(DemoController);
    jest.clearAllMocks();
  });

  it('rejects a sessionId shorter than 8 chars', async () => {
    await expect(controller.ask('short', 'hello')).rejects.toBeInstanceOf(BadRequestException);
    expect(service.ask).not.toHaveBeenCalled();
  });

  it('rejects a sessionId with invalid characters', async () => {
    await expect(controller.ask('test_session_1', 'hello')).rejects.toBeInstanceOf(BadRequestException);
    expect(service.ask).not.toHaveBeenCalled();
  });

  it('rejects an empty question', async () => {
    await expect(controller.ask(VALID_SESSION, '')).rejects.toBeInstanceOf(BadRequestException);
    expect(service.ask).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only question', async () => {
    await expect(controller.ask(VALID_SESSION, '   ')).rejects.toBeInstanceOf(BadRequestException);
    expect(service.ask).not.toHaveBeenCalled();
  });

  it('rejects a question longer than 1000 chars', async () => {
    await expect(controller.ask(VALID_SESSION, 'a'.repeat(1001))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.ask).not.toHaveBeenCalled();
  });

  it('delegates to the service with a trimmed question when inputs are valid', async () => {
    await controller.ask(VALID_SESSION, '  What are your hours?  ');
    expect(service.ask).toHaveBeenCalledWith(VALID_SESSION, 'What are your hours?');
  });
});

describe('DemoService', () => {
  let demoService: DemoService;
  let store: { [key: string]: jest.Mock };
  let kbService: { [key: string]: jest.Mock };
  let aiService: { [key: string]: jest.Mock };

  beforeEach(async () => {
    store = {
      findCompanyById: jest.fn().mockResolvedValue(null),
      createCompany: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ ...data, createdAt: new Date(), updatedAt: new Date() }),
        ),
      findDocumentsByCompany: jest.fn().mockResolvedValue([]),
      listDepartments: jest.fn().mockResolvedValue([]),
      createDepartment: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ ...data, id: 'dept-1', createdAt: new Date() }),
        ),
      purgeExpiredDocuments: jest.fn().mockResolvedValue(0),
      findDemoIntakeBySession: jest.fn().mockResolvedValue(null),
      findConversationById: jest.fn().mockResolvedValue(null),
      createConversation: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ ...data, createdAt: new Date(), updatedAt: new Date() }),
        ),
      createMessage: jest
        .fn()
        .mockImplementation((data) => Promise.resolve({ ...data, createdAt: new Date() })),
      findMessagesByConversation: jest.fn().mockResolvedValue([]),
      updateDocument: jest.fn().mockResolvedValue(null),
      findAppointmentsByCompany: jest
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, perPage: 20 }),
      findTemporaryDocuments: jest.fn().mockResolvedValue([]),
    };
    kbService = {
      createDocument: jest
        .fn()
        .mockResolvedValue({ id: 'doc-1', title: 'notes', content: 'test', companyId: 'demo-try' }),
    };
    aiService = {
      generateResponse: jest.fn().mockResolvedValue({
        response: 'Hello from Northside Dental!',
        source: 'ai',
        confidence: 0.9,
        intent: 'question',
        department: null,
        lead: null,
        appointment: null,
        sources: [{ chunkText: 'some knowledge base text', similarity: 0.9 }],
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DemoService,
        { provide: StoreService, useValue: store },
        { provide: KnowledgeBaseService, useValue: kbService },
        { provide: AIService, useValue: aiService },
      ],
    }).compile();

    demoService = moduleRef.get(DemoService);
    jest.clearAllMocks();
  });

  it('ask uses { mode: "receptionist" } and DEMO_COMPANY_ID', async () => {
    await demoService.ask(VALID_SESSION, 'What are your hours?');

    expect(aiService.generateResponse).toHaveBeenCalledWith(
      'demo-try',
      'What are your hours?',
      [],
      VALID_SESSION,
      { mode: 'receptionist' },
    );
  });

  it('persists user and assistant messages in order', async () => {
    await demoService.ask(VALID_SESSION, 'What are your hours?');

    expect(store.createMessage).toHaveBeenCalledTimes(2);
    expect(store.createMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        senderType: 'user',
        content: 'What are your hours?',
        conversationId: VALID_SESSION,
      }),
    );
    expect(store.createMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        senderType: 'ai',
        content: 'Hello from Northside Dental!',
        conversationId: VALID_SESSION,
      }),
    );
  });

  it('persists assistant message as "system" when source is escalate', async () => {
    aiService.generateResponse.mockResolvedValue({
      response: 'Escalating to a human.',
      source: 'escalate',
      confidence: 0,
      intent: 'escalate',
      department: null,
      lead: null,
      appointment: null,
      sources: [],
    });

    await demoService.ask(VALID_SESSION, 'I want to speak to a human');

    expect(store.createMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ senderType: 'system', content: 'Escalating to a human.' }),
    );
  });

  it('finds existing conversation instead of creating a new one', async () => {
    store.findConversationById.mockResolvedValue({ id: VALID_SESSION, companyId: 'demo-try' });

    await demoService.ask(VALID_SESSION, 'hello');

    expect(store.createConversation).not.toHaveBeenCalled();
  });

  it('creates a new conversation with metadata when none exists', async () => {
    store.findConversationById.mockResolvedValue(null);

    await demoService.ask(VALID_SESSION, 'hello');

    expect(store.createConversation).toHaveBeenCalledWith({
      id: VALID_SESSION,
      companyId: 'demo-try',
      title: 'Public demo session',
      status: 'open',
      metadata: { source: 'public-demo' },
    });
  });

  it('rejects a conversation belonging to another company', async () => {
    store.findConversationById.mockResolvedValue({ id: VALID_SESSION, companyId: 'other-tenant' });

    await expect(demoService.ask(VALID_SESSION, 'hello')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('truncates source chunkText to 400 chars in the response', async () => {
    const longText = 'x'.repeat(500);
    aiService.generateResponse.mockResolvedValue({
      response: 'OK',
      source: 'ai',
      confidence: 0.9,
      intent: 'question',
      department: null,
      lead: null,
      appointment: null,
      sources: [{ chunkText: longText, similarity: 0.9 }],
    });

    const result = await demoService.ask(VALID_SESSION, 'hello');
    expect(result.sources[0].chunkText).toHaveLength(400);
  });

  it('upload sets expiresAt ≈ now + 12h and calls createDocument with the demo company', async () => {
    const mockFile = {
      originalname: 'notes.txt',
      buffer: Buffer.from('test content'),
      size: 100,
      mimetype: 'text/plain',
    } as Express.Multer.File;

    kbService.createDocument.mockResolvedValue({
      id: 'doc-1',
      title: 'notes',
      companyId: 'demo-try',
      content: 'test content',
      chunks: [],
      filename: 'notes.txt',
      mime: 'text/plain',
      sizeBytes: 100,
      pageCount: 0,
      status: 'ready',
      published: true,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    store.updateDocument.mockResolvedValue({ id: 'doc-1', expiresAt: new Date() });

    const before = Date.now();
    const result = await demoService.upload(
      mockFile,
      { ext: 'txt', isPdf: false, title: 'notes' },
      { content: 'test content', pageCount: 0 },
    );
    const after = Date.now();

    expect(kbService.createDocument).toHaveBeenCalledWith('demo-try', 'notes', 'test content', {
      filename: 'notes.txt',
      mime: 'text/plain',
      sizeBytes: 100,
    });

    expect(store.updateDocument).toHaveBeenCalledWith('doc-1', { expiresAt: expect.any(Date) });

    const expiresAtMs = store.updateDocument.mock.calls[0][1].expiresAt.getTime();
    const twelveHours = 12 * 60 * 60 * 1000;
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + twelveHours);
    expect(expiresAtMs).toBeLessThanOrEqual(after + twelveHours);
    expect(result.id).toBe('doc-1');
    expect(result.title).toBe('notes');
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('seed creates company, 5 documents, and 3 departments when none exist', async () => {
    store.findCompanyById.mockResolvedValue(null);
    store.findDocumentsByCompany.mockResolvedValue([]);
    store.listDepartments.mockResolvedValue([]);
    kbService.createDocument.mockResolvedValue({ id: 'doc-1', title: 'test', content: 'test' });
    store.createDepartment.mockResolvedValue({ id: 'dept-1', name: 'Reception' });

    await demoService.seed();

    expect(store.createCompany).toHaveBeenCalledTimes(1);
    expect(store.createCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'demo-try',
        name: 'Northside Dental',
        slug: 'demo-try',
        plan: 'demo',
      }),
    );
    expect(kbService.createDocument).toHaveBeenCalledTimes(5);
    expect(store.createDepartment).toHaveBeenCalledTimes(3);
  });

  it('seed is idempotent (second run creates nothing)', async () => {
    store.findCompanyById.mockResolvedValue({ id: 'demo-try', name: 'Northside Dental' });
    store.findDocumentsByCompany.mockResolvedValue([{ id: 'doc-1', title: 'Existing' }]);
    store.listDepartments.mockResolvedValue([{ id: 'dept-1', name: 'Reception' }]);

    await demoService.seed();

    expect(store.createCompany).not.toHaveBeenCalled();
    expect(kbService.createDocument).not.toHaveBeenCalled();
    expect(store.createDepartment).not.toHaveBeenCalled();
  });

  it('purge is invoked on ask, upload, and documents', async () => {
    await demoService.ask(VALID_SESSION, 'test question');
    expect(store.purgeExpiredDocuments).toHaveBeenCalledWith('demo-try');
    expect(store.purgeExpiredDocuments).toHaveBeenCalledTimes(1);

    const mockFile = {
      originalname: 'f.txt',
      buffer: Buffer.from('x'),
      size: 10,
      mimetype: 'text/plain',
    } as Express.Multer.File;
    await demoService.upload(mockFile, { ext: 'txt', isPdf: false, title: 'f' }, { content: 'x', pageCount: 0 });
    expect(store.purgeExpiredDocuments).toHaveBeenCalledTimes(2);

    await demoService.listDocuments();
    expect(store.purgeExpiredDocuments).toHaveBeenCalledTimes(3);
  });

  it('listAppointments does NOT invoke purge', async () => {
    store.findConversationById.mockResolvedValue({ id: VALID_SESSION, companyId: 'demo-try' });
    store.findAppointmentsByCompany.mockResolvedValue({
      items: [{ id: 'appt-1', conversationId: VALID_SESSION, startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T10:30:00Z', status: 'requested' }],
      total: 1,
      page: 1,
      perPage: 20,
    });

    await demoService.listAppointments(VALID_SESSION);

    expect(store.purgeExpiredDocuments).not.toHaveBeenCalled();
    expect(store.findAppointmentsByCompany).toHaveBeenCalledWith('demo-try', 1, 20);
  });

  it('listAppointments validates sessionId belongs to demo company', async () => {
    store.findConversationById.mockResolvedValue({ id: VALID_SESSION, companyId: 'other-company' });

    await expect(demoService.listAppointments(VALID_SESSION)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listAppointments returns an empty list for a session with no conversation yet', async () => {
    store.findConversationById.mockResolvedValue(null);

    const result = await demoService.listAppointments(VALID_SESSION);

    expect(result).toEqual({ appointments: [] });
    expect(store.findAppointmentsByCompany).not.toHaveBeenCalled();
  });

  it('listAppointments filters by conversationId when sessionId is provided', async () => {
    store.findConversationById.mockResolvedValue({ id: VALID_SESSION, companyId: 'demo-try' });
    store.findAppointmentsByCompany.mockResolvedValue({
      items: [
        { id: 'appt-1', conversationId: VALID_SESSION },
        { id: 'appt-2', conversationId: 'other-session' },
      ],
      total: 2,
      page: 1,
      perPage: 20,
    });

    const result = await demoService.listAppointments(VALID_SESSION);
    expect(result.appointments).toHaveLength(1);
    expect(result.appointments[0].id).toBe('appt-1');
  });

  it('listAppointments returns all when sessionId is omitted', async () => {
    store.findAppointmentsByCompany.mockResolvedValue({
      items: [
        { id: 'appt-1', conversationId: 'session-a' },
        { id: 'appt-2', conversationId: 'session-b' },
      ],
      total: 2,
      page: 1,
      perPage: 20,
    });

    const result = await demoService.listAppointments();
    expect(result.appointments).toHaveLength(2);
  });

  it('listDocuments maps temporary documents to the expected shape', async () => {
    store.findTemporaryDocuments.mockResolvedValue([
      { id: 't1', title: 'Upload 1', expiresAt: new Date(), createdAt: new Date() },
    ]);

    const result = await demoService.listDocuments();
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toEqual(
      expect.objectContaining({ id: 't1', title: 'Upload 1' }),
    );
  });
});

describe('buildIntakeContext', () => {
  const baseRow = (overrides: Partial<Record<string, unknown>> = {}) =>
    ({
      sessionId: 'session-1',
      title: null,
      fullName: 'John Doe',
      phone: null,
      email: null,
      preferredAt: null,
      reason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

  it('returns null for a null row', () => {
    expect(buildIntakeContext(null)).toBeNull();
  });

  it('always includes the visitor name and omits null optional fields', () => {
    const ctx = buildIntakeContext(baseRow());
    expect(ctx).toBe('Visitor details: name John Doe. Use these naturally when relevant.');
    expect(ctx).toContain('name John Doe');
    expect(ctx).not.toMatch(/title|phone|email|preferred appointment|reason/);
  });

  it('includes each optional field only when set', () => {
    const ctx = buildIntakeContext(
      baseRow({
        title: 'Dr',
        phone: '+447700900123',
        email: 'dr@example.com',
        preferredAt: '2026-01-01T10:00:00.000Z',
        reason: 'I need a checkup',
      }),
    );
    expect(ctx).toContain('title Dr');
    expect(ctx).toContain('name John Doe');
    expect(ctx).toContain('phone +447700900123');
    expect(ctx).toContain('email dr@example.com');
    expect(ctx).toContain('preferred appointment 2026-01-01T10:00:00.000Z');
    expect(ctx).toContain('reason "I need a checkup"');
    expect(ctx).toMatch(/^Visitor details:/);
    expect(ctx?.endsWith('Use these naturally when relevant.')).toBe(true);
  });

  it('formats the reason with surrounding double quotes', () => {
    const ctx = buildIntakeContext(baseRow({ reason: 'tooth pain' }));
    expect(ctx).toContain('reason "tooth pain"');
  });

  it('produces a single paragraph (no newlines) and caps length at 600 for an over-long reason', () => {
    const ctx = buildIntakeContext(baseRow({ reason: 'x'.repeat(700) }));
    expect(ctx).not.toContain('\n');
    expect(ctx).not.toContain('\r');
    expect(ctx!.length).toBeLessThanOrEqual(600);
  });
});

describe('DemoController intake', () => {
  let controller: DemoController;
  let service: { [key: string]: jest.Mock };

  beforeEach(() => {
    service = {
      upsertIntake: jest.fn().mockResolvedValue({ id: 'intake-1' }),
      findIntakeBySession: jest.fn().mockResolvedValue(null),
      ask: jest.fn(),
      upload: jest.fn(),
    };
    controller = new DemoController(service as unknown as DemoService);
    jest.clearAllMocks();
  });

  const VALID_SESSION = 'valid-sess1';

  it('valid payload resolves and calls upsertIntake with normalized data (title trimmed, preferredAt to ISO, empty email -> null)', async () => {
    const result = await controller.intake({
      sessionId: VALID_SESSION,
      title: '  Mr  ',
      fullName: '  John Doe  ',
      email: '',
      preferredAt: '2026-01-01T10:00:00Z',
      reason: 'a checkup',
    });

    expect(result).toEqual({ saved: true });
    expect(service.upsertIntake).toHaveBeenCalledWith({
      sessionId: VALID_SESSION,
      title: 'Mr',
      fullName: 'John Doe',
      phone: null,
      email: null,
      preferredAt: new Date('2026-01-01T10:00:00Z').toISOString(),
      reason: 'a checkup',
    });
  });

  it('rejects a missing fullName', async () => {
    await expect(
      controller.intake({ sessionId: VALID_SESSION, fullName: undefined }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.upsertIntake).not.toHaveBeenCalled();
  });

  it('rejects an empty fullName', async () => {
    await expect(
      controller.intake({ sessionId: VALID_SESSION, fullName: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.upsertIntake).not.toHaveBeenCalled();
  });

  it('rejects a fullName longer than 100 characters', async () => {
    await expect(
      controller.intake({ sessionId: VALID_SESSION, fullName: 'a'.repeat(101) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.upsertIntake).not.toHaveBeenCalled();
  });

  it('rejects a title not in the allowed enum (Sir)', async () => {
    await expect(
      controller.intake({ sessionId: VALID_SESSION, fullName: 'John', title: 'Sir' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.upsertIntake).not.toHaveBeenCalled();
  });

  it('rejects a phone longer than 32 characters', async () => {
    await expect(
      controller.intake({ sessionId: VALID_SESSION, fullName: 'John', phone: '1'.repeat(33) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.upsertIntake).not.toHaveBeenCalled();
  });

  it('rejects a malformed email address', async () => {
    await expect(
      controller.intake({ sessionId: VALID_SESSION, fullName: 'John', email: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.upsertIntake).not.toHaveBeenCalled();
  });

  it('rejects an over-length email (>120 chars)', async () => {
    await expect(
      controller.intake({
        sessionId: VALID_SESSION,
        fullName: 'John',
        email: 'a'.repeat(130) + '@x.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.upsertIntake).not.toHaveBeenCalled();
  });

  it('rejects an invalid preferredAt date', async () => {
    await expect(
      controller.intake({ sessionId: VALID_SESSION, fullName: 'John', preferredAt: 'not-a-date' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.upsertIntake).not.toHaveBeenCalled();
  });

  it('rejects a reason longer than 500 characters', async () => {
    await expect(
      controller.intake({ sessionId: VALID_SESSION, fullName: 'John', reason: 'x'.repeat(501) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.upsertIntake).not.toHaveBeenCalled();
  });

  it('rejects an invalid sessionId on POST intake', async () => {
    await expect(
      controller.intake({ sessionId: 'x!@#', fullName: 'John' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.upsertIntake).not.toHaveBeenCalled();
  });

  describe('GET intake', () => {
    it('rejects an invalid sessionId', () => {
      expect(() => controller.intakeGet('x!@#')).toThrow(BadRequestException);
      expect(service.findIntakeBySession).not.toHaveBeenCalled();
    });

    it('delegates to findIntakeBySession and returns the intake row for a valid sessionId', async () => {
      const row = {
        sessionId: VALID_SESSION,
        title: null,
        fullName: 'John Doe',
        phone: null,
        email: null,
        preferredAt: null,
        reason: null,
        createdAt: new Date(),
      };
      service.findIntakeBySession.mockResolvedValue(row);

      const result = await controller.intakeGet(VALID_SESSION);
      expect(service.findIntakeBySession).toHaveBeenCalledWith(VALID_SESSION);
      expect(result).toBe(row);
    });
  });
});
