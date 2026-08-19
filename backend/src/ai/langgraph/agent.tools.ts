import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { StoreService } from '../../common/store.service';
import { MailService } from '../../common/mail.service';
import { AIService } from '../ai.service';

export function createReceptionistTools(
  store: StoreService,
  mail: MailService,
  aiService: AIService,
  companyId: string,
  conversationId: string | undefined,
  executed: { lead?: any; appointment?: any },
) {
  const captureLead = tool(
    async ({ name, email, phone }) => {
      const nameVal = name?.trim() || null;
      const emailVal = email?.trim() || null;
      const phoneVal = phone?.trim() || null;
      if (!nameVal && !emailVal && !phoneVal) {
        return JSON.stringify({ ok: false, error: 'No contact info provided' });
      }
      let lead = conversationId ? await store.findLeadByConversation(conversationId) : null;
      if (lead) {
        lead = await store.updateLead(lead.id, {
          name: nameVal || lead.name || undefined,
          email: emailVal || lead.email || undefined,
          phone: phoneVal || lead.phone || undefined,
        });
      } else {
        lead = await store.createLead({
          id: crypto.randomUUID(),
          companyId,
          conversationId: conversationId || null,
          name: nameVal,
          email: emailVal,
          phone: phoneVal,
          message: null,
          source: 'chat',
          status: 'new',
          department: null,
        });
        if (conversationId) {
          await store.updateConversation(conversationId, { leadId: lead.id });
        }
      }
      executed.lead = { name: lead?.name || null, email: lead?.email || null, phone: lead?.phone || null };
      return JSON.stringify({ ok: true, leadId: lead?.id, name: nameVal, email: emailVal, phone: phoneVal });
    },
    {
      name: 'capture_lead',
      description: 'Capture lead information (name, email, phone) when the visitor shares their contact details. Only pass fields you actually have from the visitor.',
      schema: z.object({
        name: z.string().optional().describe('Full name of the visitor'),
        email: z.string().optional().describe('Email address of the visitor'),
        phone: z.string().optional().describe('Phone number of the visitor'),
      }),
    },
  );

  const bookAppointment = tool(
    async ({ date, time, title }) => {
      if (!date || !time) {
        return JSON.stringify({ ok: false, error: 'date and time are required' });
      }
      const startTime = parseAppointmentDateTime(date, time);
      if (!startTime) {
        return JSON.stringify({ ok: false, error: `Invalid date/time: ${date} ${time}` });
      }
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      const lead = conversationId ? await store.findLeadByConversation(conversationId) : null;
      const appt = await store.createAppointment({
        id: crypto.randomUUID(),
        companyId,
        conversationId: conversationId || null,
        leadId: lead?.id || null,
        customerName: lead?.name || null,
        customerEmail: lead?.email || null,
        title: title || 'Scheduled meeting',
        notes: null,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: 'requested',
      });
      if (conversationId) {
        const convo = await store.findConversationById(conversationId);
        await store.updateConversation(conversationId, {
          metadata: { ...(convo?.metadata || {}), appointmentBooked: true },
        });
      }
      executed.appointment = { date, time, title: title || 'Scheduled meeting' };
      return JSON.stringify({ ok: true, appointmentId: appt.id, date, time, title: title || 'Scheduled meeting' });
    },
    {
      name: 'book_appointment',
      description: 'Book an appointment when the visitor wants to schedule a meeting and you have a concrete date and time. Date must be YYYY-MM-DD, time in 24h HH:MM format.',
      schema: z.object({
        date: z.string().describe('Date in YYYY-MM-DD format'),
        time: z.string().describe('Time in 24h HH:MM format'),
        title: z.string().optional().describe('Title/subject of the meeting'),
      }),
    },
  );

  const escalateToHuman = tool(
    async ({ reason }) => {
      if (conversationId) {
        await store.updateConversation(conversationId, {
          status: 'escalated',
          handledBy: 'pending',
        });
      }
      return JSON.stringify({ ok: true, message: 'Conversation escalated to human agent' });
    },
    {
      name: 'escalate_to_human',
      description: 'Escalate the conversation to a human agent. ONLY use this when the visitor explicitly and insistently asks to speak to a human agent.',
      schema: z.object({
        reason: z.string().optional().describe('Reason for escalation'),
      }),
    },
  );

  const sendConfirmationEmail = tool(
    async ({ to, subject, body }) => {
      if (!to || !subject) {
        return JSON.stringify({ ok: false, error: 'to and subject are required' });
      }
      const sent = await mail.send({ to, subject, text: body || '' });
      return JSON.stringify({ ok: sent, sent });
    },
    {
      name: 'send_confirmation_email',
      description: 'Send a confirmation email after booking an appointment, when you know the visitor\'s email address.',
      schema: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject line'),
        body: z.string().optional().describe('Email body text'),
      }),
    },
  );

  const searchKnowledgeBase = tool(
    async ({ query }) => {
      try {
        const results = await aiService.searchKnowledgeBase(companyId, query, 5);
        if (!results.length) {
          return JSON.stringify({ ok: true, found: false, message: 'No relevant documents found' });
        }
        return JSON.stringify({
          ok: true,
          found: true,
          results: results.map((r) => ({
            text: r.chunkText,
            similarity: r.similarity,
            document: r.documentTitle || 'Unknown',
          })),
        });
      } catch (err) {
        return JSON.stringify({ ok: false, error: (err as Error).message });
      }
    },
    {
      name: 'search_knowledge_base',
      description: 'Search the company knowledge base for information. Use this when you need specific facts, policies, pricing, or procedures.',
      schema: z.object({
        query: z.string().describe('Search query'),
      }),
    },
  );

  return [captureLead, bookAppointment, escalateToHuman, sendConfirmationEmail, searchKnowledgeBase];
}

function parseAppointmentDateTime(dateStr: string, timeStr: string): Date | null {
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
