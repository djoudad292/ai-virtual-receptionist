import { Injectable, OnModuleInit, OnModuleDestroy, Logger, BadRequestException } from '@nestjs/common';
import { StoreService } from '../common/store.service';
import { StoredDemoIntake } from '../common/store.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { AIService } from '../ai/ai.service';
import { Source } from '../ai/ai.service';

export const DEMO_COMPANY_ID = 'demo-try';
export const UPLOAD_TTL_MS = 12 * 60 * 60 * 1000;
const PURGE_INTERVAL_MS = 10 * 60 * 1000;
const INTAKE_CONTEXT_MAX_LEN = 600;

export function buildIntakeContext(row: StoredDemoIntake | null): string | null {
  if (!row) return null;

  const parts: string[] = [];
  if (row.title) parts.push(`title ${row.title}`);
  parts.push(`name ${row.fullName}`);
  if (row.phone) parts.push(`phone ${row.phone}`);
  if (row.email) parts.push(`email ${row.email}`);
  if (row.preferredAt) parts.push(`preferred appointment ${row.preferredAt}`);
  if (row.reason) parts.push(`reason "${row.reason}"`);

  if (parts.length === 0) return null;

  let context = `Visitor details: ${parts.join(', ')}. Use these naturally when relevant.`;
  if (context.length > INTAKE_CONTEXT_MAX_LEN) {
    context = context.slice(0, INTAKE_CONTEXT_MAX_LEN);
  }
  return context;
}

const DEMO_SETTINGS = {
  name: 'Northside Dental',
  phone: '0117 496 0182',
  address: '18 Clifton Park Road, Bristol BS8 2AB',
  hours: 'Mon-Fri 08:00-18:00, Sat 09:00-13:00',
  greeting:
    'Hello — you are chatting with Northside Dental. Ask me about opening hours, treatments, prices, or book an appointment.',
  services: [
    'check-ups',
    'hygienist visits',
    'fillings',
    'extractions',
    'crowns',
    'whitening',
    'clear aligners (Invisalign)',
    'implants',
    'veneers',
    'root canals',
    'dentures',
    'bridges',
  ],
  widget: { title: 'Northside Dental', color: '#3b82f6', position: 'right' },
};

const SEED_DOCS: { title: string; content: string }[] = [
  {
    title: 'Opening Hours and Location',
    content: `Northside Dental is located at 18 Clifton Park Road, Bristol BS8 2AB.
Phone: 0117 496 0182.

Our opening hours are:
- Monday to Friday: 08:00–18:00
- Saturday: 09:00–13:00
- Closed on Sundays and bank holidays.

Walk-ins are welcome — expect about a 20 minute wait. Free parking is available at the back of the practice, and the Clifton Down bus stop is a two minute walk away.`,
  },
  {
    title: 'Prices',
    content: `Our prices:
- Check-up and clean: £60
- Filling: from £120
- Teeth whitening: £180
- First consultations: free.

All prices include the X-ray. You can pay in monthly instalments over 12 months with no interest.`,
  },
  {
    title: 'Treatments',
    content: `We provide the following treatments:
- Check-ups
- Hygienist visits
- Fillings
- Extractions
- Crowns
- Teeth whitening
- Clear aligners (Invisalign)
- Dental implants
- Veneers
- Root canals
- Dentures
- Bridges

Most treatments start with a free consultation and X-ray.`,
  },
  {
    title: 'Insurance and Payment',
    content: `We accept the following insurance providers:
- Bupa
- AXA
- Vitality

We are a Denplan practice. All major cards are accepted. You can spread the cost with monthly instalments over 12 months with no interest.`,
  },
  {
    title: 'About the Practice and Emergencies',
    content: `At Northside Dental, our virtual receptionist answers your questions and books appointments. If you need to speak to a person, the practice manager can join the conversation — usually within about 10 minutes during opening hours.

For emergencies: if you have facial swelling, bleeding that will not stop, or difficulty swallowing or breathing, call 0117 496 0182 immediately. Otherwise, booking is available during opening hours.`,
  },
];

const SEED_DEPARTMENTS = [
  {
    name: 'Reception',
    description: 'General enquiries, opening hours, directions',
    keywords: ['hour', 'open', 'close', 'when', 'where', 'address', 'location', 'parking', 'phone', 'contact', 'walk-in', 'wait'],
  },
  {
    name: 'Bookings',
    description: 'Appointment scheduling and availability',
    keywords: ['appoint', 'book', 'schedule', 'slot', 'availability', 'when', 'time', 'date', 'free', 'consultation'],
  },
  {
    name: 'Emergencies',
    description: 'Urgent care and after-hours enquiries',
    keywords: ['emergency', 'urgent', 'pain', 'swelling', 'bleeding', 'hurts', 'hurting', 'broken', 'chipped', 'abscess', 'injure', 'immediate'],
  },
];

@Injectable()
export class DemoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DemoService.name);
  private purgeTimer: NodeJS.Timeout | null = null;

  constructor(
    private store: StoreService,
    private kbService: KnowledgeBaseService,
    private aiService: AIService,
  ) {}

  onModuleInit() {
    void this.seed().catch((err: Error) =>
      this.logger.error(`Demo seed failed: ${err.message}`),
    );
    this.purgeTimer = setInterval(() => {
      void this.purgeExpired().catch((err: Error) =>
        this.logger.error(`Demo purge failed: ${err.message}`),
      );
    }, PURGE_INTERVAL_MS);
    this.purgeTimer.unref();
  }

  async onModuleDestroy() {
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = null;
    }
  }

  async seed() {
    const existing = await this.store.findCompanyById(DEMO_COMPANY_ID);
    if (!existing) {
      await this.store.createCompany({
        id: DEMO_COMPANY_ID,
        name: 'Northside Dental',
        slug: 'demo-try',
        plan: 'demo',
        settings: DEMO_SETTINGS,
      });
    }

    const docs = await this.store.findDocumentsByCompany(DEMO_COMPANY_ID);
    if (docs.length === 0) {
      for (const doc of SEED_DOCS) {
        await this.kbService.createDocument(DEMO_COMPANY_ID, doc.title, doc.content);
      }
    }

    const departments = await this.store.listDepartments(DEMO_COMPANY_ID);
    if (departments.length === 0) {
      for (const dept of SEED_DEPARTMENTS) {
        await this.store.createDepartment({
          companyId: DEMO_COMPANY_ID,
          name: dept.name,
          description: dept.description,
          keywords: dept.keywords,
        });
      }
    }
  }

  async purgeExpired() {
    await this.store.purgeExpiredDocuments(DEMO_COMPANY_ID);
  }

  async ask(sessionId: string, question: string) {
    await this.purgeExpired();

    let conversation = await this.store.findConversationById(sessionId);
    if (!conversation) {
      conversation = await this.store.createConversation({
        id: sessionId,
        companyId: DEMO_COMPANY_ID,
        title: 'Public demo session',
        status: 'open',
        metadata: { source: 'public-demo' },
      });
    }
    if (conversation.companyId !== DEMO_COMPANY_ID) {
      throw new BadRequestException('Invalid session');
    }

    await this.store.createMessage({
      id: crypto.randomUUID(),
      conversationId: sessionId,
      senderType: 'user',
      content: question,
    });

    const history = await this.store.findMessagesByConversation(sessionId);

    const intakeContext = buildIntakeContext(await this.store.findDemoIntakeBySession(sessionId));
    const prompt = intakeContext ? `${intakeContext}\n\n${question}` : question;

    const result = await this.aiService.generateResponse(
      DEMO_COMPANY_ID,
      prompt,
      history,
      sessionId,
      { mode: 'receptionist' },
    );

    await this.store.createMessage({
      id: crypto.randomUUID(),
      conversationId: sessionId,
      senderType: result.source === 'escalate' ? 'system' : 'ai',
      content: result.response,
      metadata: { sources: result.sources || [] },
    });

    return {
      response: result.response,
      source: result.source,
      confidence: result.confidence,
      intent: result.intent,
      department: result.department,
      lead: result.lead,
      appointment: result.appointment,
      sources: (result.sources || []).map((s: Source) => ({
        chunkText: (s.chunkText || '').slice(0, 400),
        similarity: s.similarity,
        documentTitle: s.documentTitle,
      })),
    };
  }

  async upload(file: Express.Multer.File, validation: { ext: string; isPdf: boolean; title: string }, extracted: { content: string; pageCount: number }) {
    await this.purgeExpired();

    const doc = await this.kbService.createDocument(
      DEMO_COMPANY_ID,
      validation.title,
      extracted.content,
      {
        filename: file.originalname,
        mime: file.mimetype || (validation.isPdf ? 'application/pdf' : 'text/plain'),
        sizeBytes: file.size,
      },
    );

    if (!doc) {
      throw new BadRequestException('Failed to create document');
    }

    const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
    await this.store.updateDocument(doc.id, { expiresAt });

    return { id: doc.id, title: validation.title, expiresAt };
  }

  async listDocuments() {
    await this.purgeExpired();
    const docs = await this.store.findTemporaryDocuments(DEMO_COMPANY_ID);
    return {
      documents: docs.map((d) => ({
        id: d.id,
        title: d.title,
        expiresAt: d.expiresAt,
        createdAt: d.createdAt,
      })),
    };
  }

  async listAppointments(sessionId?: string) {
    if (sessionId) {
      const conv = await this.store.findConversationById(sessionId);
      if (conv && conv.companyId !== DEMO_COMPANY_ID) {
        throw new BadRequestException('Invalid session');
      }
      if (!conv) {
        // No conversation yet (page just loaded) — nothing can be booked.
        return { appointments: [] };
      }
    }

    const { items } = await this.store.findAppointmentsByCompany(DEMO_COMPANY_ID, 1, 20);
    const appointments = sessionId
      ? items.filter((a: { conversationId?: string | null }) => a.conversationId === sessionId)
      : items;
    return { appointments };
  }

  async upsertIntake(data: {
    sessionId: string;
    title: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    preferredAt: string | null;
    reason: string | null;
  }): Promise<StoredDemoIntake> {
    return this.store.upsertDemoIntake({
      sessionId: data.sessionId,
      title: data.title || null,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      preferredAt: data.preferredAt,
      reason: data.reason,
    });
  }

  async findIntakeBySession(sessionId: string): Promise<StoredDemoIntake | null> {
    return this.store.findDemoIntakeBySession(sessionId);
  }
}
