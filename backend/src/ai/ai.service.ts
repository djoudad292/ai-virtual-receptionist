import { Injectable, Logger } from '@nestjs/common';
import { StoreService } from '../common/store.service';

const EMBEDDING_DIM = 1536;
const DEFAULT_DEPARTMENTS = [
  { name: 'Sales', keywords: ['price', 'pricing', 'buy', 'purchase', 'quote', 'cost', 'order', 'sales'] },
  { name: 'Support', keywords: ['help', 'issue', 'problem', 'error', 'broken', 'not working', 'fix', 'support'] },
  { name: 'Billing', keywords: ['bill', 'invoice', 'payment', 'refund', 'charge', 'card', 'receipt', 'billing'] },
];

export interface ReceptionistResult {
  response: string;
  source: 'ai' | 'escalate';
  confidence: number;
  intent: 'question' | 'appointment' | 'lead_capture' | 'routing' | 'escalate' | 'other';
  department?: string | null;
  lead?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  appointment?: { date?: string | null; time?: string | null; title?: string | null } | null;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(private store: StoreService) {}

  // ------------------------------------------------------------------
  // Embeddings (OpenAI, falling back to deterministic local hashing)
  // ------------------------------------------------------------------
  async generateEmbedding(text: string): Promise<number[]> {
    if (process.env.OPENAI_API_KEY) {
      try {
        const embedding = await this.withTimeout(this.embedOpenAI(text), 15000);
        if (embedding?.length) return embedding;
      } catch (err) {
        this.logger.warn(`OpenAI embedding failed, using local fallback: ${(err as Error).message}`);
      }
    }
    return this.embedLocally(text);
  }

  private async embedOpenAI(text: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        input: text.replace(/\n/g, ' ').slice(0, 8000),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI embedding HTTP ${res.status}: ${body.slice(0, 150)}`);
    }
    const json: any = await res.json();
    return json.data?.[0]?.embedding;
  }

  private embedLocally(text: string): number[] {
    const vector = new Array(EMBEDDING_DIM).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const grams: string[] = [];
    for (const word of normalized.split(/\s+/)) {
      if (!word) continue;
      grams.push(word);
      if (word.length > 2) {
        grams.push(word.slice(0, 5));
        grams.push(word.slice(-5));
      }
    }
    const joined = normalized.replace(/\s+/g, '');
    for (let n = 3; n <= 5; n++) {
      for (let i = 0; i + n <= joined.length; i++) {
        grams.push(joined.slice(i, i + n));
      }
    }
    for (const g of grams) {
      const h = hashString(g);
      const idx = Math.abs(h) % EMBEDDING_DIM;
      vector[idx] += (h & 1) === 0 ? 1 : -1;
    }
    let mag = 0;
    for (const v of vector) mag += v * v;
    mag = Math.sqrt(mag) || 1;
    return vector.map((v) => v / mag);
  }

  // ------------------------------------------------------------------
  // RAG search
  // ------------------------------------------------------------------
  async searchKnowledgeBase(companyId: string, query: string, limit = 10) {
    const totalChunks = await this.store.countChunks(companyId);
    if (totalChunks === 0) return [];
    try {
      const embedding = await this.withTimeout(this.generateEmbedding(query), 15000);
      const results = await this.store.searchChunksFull(companyId, embedding, limit);
      return results.filter((r) => r.similarity >= 0.25);
    } catch (err) {
      this.logger.warn(`KB search failed: ${(err as Error).message}`);
      return [];
    }
  }

  private async ragSearch(companyId: string, query: string, limit = 5) {
    const totalChunks = await this.store.countChunks(companyId);
    if (totalChunks === 0) return { context: '', results: [], bestSimilarity: 0 };
    try {
      const embedding = await this.withTimeout(this.generateEmbedding(query), 15000);
      // Local hashing embeddings are weaker than OpenAI's, so relax the threshold when OpenAI is absent.
      const threshold = process.env.OPENAI_API_KEY ? 0.35 : 0.12;
      const results = await this.store.searchChunks(companyId, embedding, limit, threshold);
      const filtered = results.filter((r) => r.similarity >= threshold);
      const bestSimilarity = filtered.length > 0 ? filtered[0].similarity : 0;
      const context = filtered
        .map((r) => r.chunkText)
        .join('\n\n')
        .slice(0, 6000);
      return { context, results: filtered, bestSimilarity };
    } catch (err) {
      this.logger.warn(`RAG search failed: ${(err as Error).message}`);
      return { context: '', results: [], bestSimilarity: 0 };
    }
  }

  // ------------------------------------------------------------------
  // LLM chat (OpenRouter)
  // ------------------------------------------------------------------
  private async chat(messages: { role: string; content: string }[]): Promise<string | null> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    try {
      const doFetch = async () => {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.APP_URL || '',
            'X-Title': 'AI Virtual Receptionist',
          },
          body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
            messages,
            max_tokens: 500,
            temperature: 0.3,
          }),
        });
        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`OpenRouter HTTP ${res.status}: ${errBody.slice(0, 200)}`);
        }
        return res.json();
      };
      const json: any = await this.withTimeout(doFetch(), 30000);
      const content = json.choices?.[0]?.message?.content;
      return typeof content === 'string' && content.trim() ? content : null;
    } catch (err) {
      this.logger.error(`OpenRouter generation failed: ${(err as Error).message}`);
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Receptionist orchestration
  // ------------------------------------------------------------------
  async generateResponse(
    companyId: string,
    userMessage: string,
    history?: { senderType: string; content: string }[],
    conversationId?: string,
  ): Promise<ReceptionistResult> {
    const company = await this.store.findCompanyById(companyId);
    const departments = await this.store.listDepartments(companyId);
    const departmentNames = departments.length > 0 ? departments : DEFAULT_DEPARTMENTS;

    const { context, bestSimilarity } = await this.ragSearch(companyId, userMessage);

    const systemPrompt = this.buildSystemPrompt(company, departmentNames, context);
    const conversationHistory = history
      ? history
          .slice(-8)
          .map((m) => `${m.senderType}: ${m.content}`)
          .join('\n')
      : '';

    const messages: { role: string; content: string }[] = [{ role: 'system', content: systemPrompt }];
    if (conversationHistory) {
      messages.push({ role: 'user', content: conversationHistory });
    }
    messages.push({ role: 'user', content: userMessage });

    const raw = await this.chat(messages);
    const parsed = this.extractJson(raw);

    let intent: ReceptionistResult['intent'] = 'other';
    let department: string | null = null;
    let lead: ReceptionistResult['lead'] = null;
    let appointment: ReceptionistResult['appointment'] = null;
    let response = '';

    if (parsed && typeof parsed.reply === 'string') {
      response = parsed.reply;
      intent = this.sanitizeIntent(parsed.intent);
      department = this.matchDepartment(parsed.department, departmentNames);
      lead = this.sanitizeLead(parsed.lead);
      appointment = this.sanitizeAppointment(parsed.appointment);
      // LLM-driven fallbacks when fields are missing
      if (!lead && this.extractEmail(userMessage)) {
        lead = { name: null, email: this.extractEmail(userMessage), phone: null };
      }
      if (intent === 'other' && this.looksLikeAppointment(userMessage)) {
        intent = 'appointment';
      }
    } else {
      // No LLM / unparseable -> deterministic fallback
      response = this.fallbackReply(context, bestSimilarity);
      if (this.looksLikeAppointment(userMessage)) intent = 'appointment';
      else if (this.extractEmail(userMessage) || /(\+?\d[\d\s-]{7,})/.test(userMessage)) intent = 'lead_capture';
      else if (context) intent = 'question';
      else intent = 'other';
      department = this.keywordDepartment(userMessage, departmentNames);
      const email = this.extractEmail(userMessage);
      const phoneMatch = userMessage.match(/(\+?\d[\d\s-]{7,})/);
      if (email || phoneMatch) {
        lead = { name: null, email, phone: phoneMatch ? phoneMatch[1].trim() : null };
      }
    }

    const result: ReceptionistResult = {
      response,
      source: intent === 'escalate' ? 'escalate' : 'ai',
      confidence: bestSimilarity,
      intent,
      department,
      lead,
      appointment,
    };

    if (conversationId) {
      await this.persistSideEffects(companyId, conversationId, result);
    }

    return result;
  }

  // ------------------------------------------------------------------
  // Persist side effects (leads, appointments, routing)
  // ------------------------------------------------------------------
  private async persistSideEffects(companyId: string, conversationId: string, result: ReceptionistResult) {
    const conversation = await this.store.findConversationById(conversationId);
    if (!conversation) return;

    // Department routing
    if (result.department && conversation.department !== result.department) {
      await this.store.updateConversation(conversationId, { department: result.department });
    }

    // Lead capture
    const leadInfo = result.lead;
    if (leadInfo && (leadInfo.email || leadInfo.phone || leadInfo.name)) {
      let lead = await this.store.findLeadByConversation(conversationId);
      if (lead) {
        await this.store.updateLead(lead.id, {
          name: leadInfo.name || lead.name || undefined,
          email: leadInfo.email || lead.email || undefined,
          phone: leadInfo.phone || lead.phone || undefined,
          department: result.department || lead.department || undefined,
        });
      } else {
        lead = await this.store.createLead({
          id: crypto.randomUUID(),
          companyId,
          conversationId,
          name: leadInfo.name || null,
          email: leadInfo.email || null,
          phone: leadInfo.phone || null,
          message: null,
          source: 'chat',
          status: 'new',
          department: result.department || null,
        });
        await this.store.updateConversation(conversationId, { leadId: lead.id });
      }
    }

    // Appointment booking
    const appt = result.appointment;
    if (appt && appt.date && appt.time) {
      const metadata = conversation.metadata || {};
      if (!metadata.appointmentBooked) {
        const startTime = this.parseAppointmentDateTime(appt.date, appt.time);
        if (startTime) {
          const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
          const lead = await this.store.findLeadByConversation(conversationId);
          await this.store.createAppointment({
            id: crypto.randomUUID(),
            companyId,
            conversationId,
            leadId: lead?.id || null,
            customerName: lead?.name || leadInfoName(result.lead) || null,
            customerEmail: lead?.email || null,
            title: appt.title || 'Scheduled meeting',
            notes: null,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: 'requested',
          });
          await this.store.updateConversation(conversationId, {
            metadata: { ...metadata, appointmentBooked: true },
          });
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Prompt + parsing helpers
  // ------------------------------------------------------------------
  private buildSystemPrompt(company: any, departments: any[], context: string): string {
    const deptList = departments.map((d) => d.name).join(', ') || 'Sales, Support, Billing';
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const contextPart = context
      ? `Answer ONLY using the context below.\n\nContext:\n${context}`
      : 'You do not have a knowledge base for this company yet. Answer general questions naturally, and if asked about company-specific info you do not know, say you are not sure and offer to connect them with a human.';

    return `You are an AI virtual receptionist for "${company?.name || 'this company'}".
Today's date is ${todayStr} (YYYY-MM-DD). Always compute relative dates like "tomorrow" or "this Friday" from today's date.
You greet visitors, answer their questions, capture leads, book appointments, and route conversations to the right department.

Company departments: ${deptList}.

${contextPart}

BEHAVIOR:
- Be warm, friendly and concise (1-3 sentences).
- If the visitor wants to book or schedule a meeting, ask for their name, email and preferred date/time if not already provided.
- If the visitor provides their email and/or phone, capture it as a lead.
- Choose the department that best matches the visitor's request.
- If you cannot help or the visitor insists on talking to a human, set intent to "escalate" and reply to connect them with a human agent.

Reply with ONLY a single valid JSON object (no markdown, no extra text) in EXACTLY this shape:
{"reply":"your message to the visitor","intent":"question|appointment|lead_capture|routing|escalate","department":"<department name or null>","lead":{"name":null,"email":null,"phone":null},"appointment":{"date":"YYYY-MM-DD","time":"HH:MM","title":null}}
- Set "lead" fields to null when unknown.
- Set "appointment" to null unless the visitor wants to schedule something.
- "date" must be an actual date from the conversation (YYYY-MM-DD), "time" in 24h HH:MM format.`;
  }

  private extractJson(text: string | null): any | null {
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  private sanitizeIntent(value: any): ReceptionistResult['intent'] {
    const allowed = ['question', 'appointment', 'lead_capture', 'routing', 'escalate', 'other'];
    return allowed.includes(value) ? value : 'other';
  }

  private sanitizeLead(value: any): ReceptionistResult['lead'] | null {
    if (!value || typeof value !== 'object') return null;
    const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : null;
    const email = typeof value.email === 'string' && value.email.trim() ? value.email.trim() : null;
    const phone = typeof value.phone === 'string' && value.phone.trim() ? value.phone.trim() : null;
    return name || email || phone ? { name, email, phone } : null;
  }

  private sanitizeAppointment(value: any): ReceptionistResult['appointment'] | null {
    if (!value || typeof value !== 'object') return null;
    const date = typeof value.date === 'string' && value.date.trim() ? value.date.trim() : null;
    const time = typeof value.time === 'string' && value.time.trim() ? value.time.trim() : null;
    const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim() : null;
    return date || time || title ? { date, time, title } : null;
  }

  private matchDepartment(value: any, departments: any[]): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const normalized = value.trim().toLowerCase();
    const known = departments.find((d) => d.name.toLowerCase() === normalized);
    if (known) return known.name;
    // Fuzzy: LLM often returns something like "Sales" already; fall back to keyword match
    const match = departments.find((d) =>
      d.name.toLowerCase().includes(normalized) || normalized.includes(d.name.toLowerCase()),
    );
    return match?.name ?? null;
  }

  private keywordDepartment(text: string, departments: any[]): string | null {
    const lower = text.toLowerCase();
    for (const d of departments) {
      for (const kw of d.keywords || []) {
        if (lower.includes(kw.toLowerCase())) return d.name;
      }
    }
    return null;
  }

  private looksLikeAppointment(text: string): boolean {
    return /(appoint|book(?!s\b|store|marked)\w*|schedule|meeting|reserve|slot|availability|free (?:tomorrow|today|this week)|call(?:ing)? (?:me )?back|booking)/i.test(text);
  }

  private extractEmail(text: string): string | null {
    const match = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    return match ? match[0].toLowerCase() : null;
  }

  private parseAppointmentDateTime(dateStr: string, timeStr: string): Date | null {
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!timeMatch || !dateMatch) return null;
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    const date = new Date(
      parseInt(dateMatch[1], 10),
      parseInt(dateMatch[2], 10) - 1,
      parseInt(dateMatch[3], 10),
      hour,
      minute,
    );
    return isNaN(date.getTime()) ? null : date;
  }

  private fallbackReply(context: string, bestSimilarity: number): string {
    if (context) {
      const firstLine = context.split('\n').find((l) => l.trim());
      return firstLine
        ? `Based on our information: ${firstLine.slice(0, 280)}`
        : "I found some information, but I'm not sure it answers your question. Would you like me to connect you with a human?";
    }
    return "Thanks for reaching out! I'm not sure about that yet — would you like to leave your name and email so a human agent can get back to you, or would you like to book an appointment?";
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms),
      ),
    ]);
  }
}

function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h;
}

function leadInfoName(lead: { name?: string | null } | null | undefined): string | null {
  return lead?.name || null;
}
