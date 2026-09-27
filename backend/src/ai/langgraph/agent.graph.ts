import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { createReceptionistTools } from './agent.tools';
import { extractJson } from '../json-envelope';
import { GraphTraceStep, MAX_TRACE_STEPS, MAX_TRACE_STRING } from './trace.types';
import { StoreService } from '../../common/store.service';
import { MailService } from '../../common/mail.service';
import { AIService } from '../ai.service';

export interface Source {
  chunkText: string;
  similarity: number;
  documentTitle?: string | null;
}

export interface LangGraphResult {
  response: string;
  source: 'ai' | 'escalate';
  intent: 'question' | 'appointment' | 'lead_capture' | 'routing' | 'escalate' | 'other';
  department: string | null;
  lead: { name?: string | null; email?: string | null; phone?: string | null } | null;
  appointment: { date?: string | null; time?: string | null; title?: string | null } | null;
  sources: Source[];
  steps: GraphTraceStep[];
}

function truncateTraceString(value: string, max: number = MAX_TRACE_STRING): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function toTraceJson(value: unknown, seen: WeakSet<object> = new WeakSet()): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return truncateTraceString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    return truncateTraceString(String(value));
  }
  if (value instanceof Error) return truncateTraceString(`${value.name}: ${value.message}`);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (seen.has(value as object)) return '[Circular]';
  seen.add(value as object);
  if (Array.isArray(value)) return value.map((item) => toTraceJson(item, seen));
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = toTraceJson(item, seen);
    }
    return out;
  }
  try {
    return truncateTraceString(JSON.stringify(value) ?? String(value));
  } catch {
    return truncateTraceString(String(value));
  }
}

function previewText(content: unknown, max: number = 400): string {
  if (typeof content === 'string') return truncateTraceString(content, max);
  if (Array.isArray(content)) {
    const first = content.find((part: any) => typeof part?.text === 'string');
    return first ? truncateTraceString(String(first.text), max) : '';
  }
  return '';
}

function capTraceSteps(steps: GraphTraceStep[]): GraphTraceStep[] {
  if (steps.length <= MAX_TRACE_STEPS) return steps;
  const head = steps.slice(0, 10);
  const tail = steps.slice(-(MAX_TRACE_STEPS - 11));
  const dropped = steps.length - head.length - tail.length;
  head.push({ node: 'parse', label: `${dropped} earlier steps trimmed` });
  return [...head, ...tail];
}

const StateAnnotation = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

const DEFAULT_DEPARTMENTS = [
  { name: 'Sales', keywords: ['price', 'pricing', 'buy', 'purchase', 'quote', 'cost', 'order', 'sales'] },
  { name: 'Support', keywords: ['help', 'issue', 'problem', 'error', 'broken', 'not working', 'fix', 'support'] },
  { name: 'Billing', keywords: ['bill', 'invoice', 'payment', 'refund', 'charge', 'card', 'receipt', 'billing'] },
];

export async function runReceptionistGraph(params: {
  userMessage: string;
  companyId: string;
  conversationId?: string;
  history?: { senderType: string; content: string }[];
  store: StoreService;
  mail: MailService;
  aiService: AIService;
}): Promise<LangGraphResult> {
  const { userMessage, companyId, conversationId, history, store, mail, aiService } = params;

  const company = await store.findCompanyById(companyId);
  const departments = await store.listDepartments(companyId);
  const departmentNames = departments.length > 0 ? departments : DEFAULT_DEPARTMENTS;

  const { context, results: ragResults } = await aiService.ragSearchPublic(companyId, userMessage);

  const steps: GraphTraceStep[] = [];

  const similarities = ragResults
    .map((r) => Number(r.similarity))
    .filter((n) => Number.isFinite(n));
  const documentTitles: string[] = [];
  for (const r of ragResults) {
    const title = typeof r.documentTitle === 'string' && r.documentTitle.trim() ? r.documentTitle : null;
    if (title && !documentTitles.includes(title)) documentTitles.push(title);
    if (documentTitles.length >= 5) break;
  }
  steps.push({
    node: 'rag',
    label: ragResults.length > 0 ? `Retrieved ${ragResults.length} document chunks` : 'No document chunks matched',
    detail: {
      chunksFound: ragResults.length,
      topSimilarity: similarities.length ? Math.round(Math.max(...similarities) * 100) / 100 : 0,
      documentTitles,
    },
  });

  const executed: { lead?: any; appointment?: any } = {};

  const tools = createReceptionistTools(store, mail, aiService, companyId, conversationId, executed);
  const toolsByName = new Map(tools.map((t: any) => [t.name, t]));

  const systemPrompt = buildSystemPrompt(company, departmentNames, context, companyId);

  const { primary, fallback } = createLLM();
  const llmWithTools = fallback
    ? primary.bindTools(tools).withFallbacks({ fallbacks: [fallback.bindTools(tools)] })
    : primary.bindTools(tools);

  const agentNode = async (state: typeof StateAnnotation.State) => {
    const response = await llmWithTools.invoke(state.messages);
    const toolCalls = (response as any)?.tool_calls || [];
    steps.push({
      node: 'agent',
      label: toolCalls.length > 0 ? 'Model requested tools' : 'Model produced a reply',
      detail: toTraceJson({
        toolCalls: toolCalls.map((tc: any) => ({ name: tc?.name, args: tc?.args })),
        textPreview: previewText((response as any)?.content),
      }),
    });
    return { messages: [response] };
  };

  const toolsNode = async (state: typeof StateAnnotation.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const toolCalls = lastMessage?.tool_calls || [];
    const results: any[] = [];
    for (const tc of toolCalls) {
      const toolFn = toolsByName.get(tc.name);
      if (toolFn) {
        const output = await (toolFn as any).invoke(tc.args);
        steps.push({
          node: 'tools',
          label: `Called tool ${tc.name}`,
          detail: toTraceJson({ name: tc.name, args: tc.args, result: output }),
        });
        results.push({
          type: 'tool',
          content: typeof output === 'string' ? output : JSON.stringify(output),
          tool_call_id: tc.id,
        });
      } else {
        steps.push({
          node: 'tools',
          label: `Unknown tool ${tc.name}`,
          detail: toTraceJson({ name: tc.name, args: tc.args, error: `Unknown tool: ${tc.name}` }),
        });
        results.push({
          type: 'tool',
          content: JSON.stringify({ ok: false, error: `Unknown tool: ${tc.name}` }),
          tool_call_id: tc.id,
        });
      }
    }
    return { messages: results };
  };

  const shouldContinue = (state: typeof StateAnnotation.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
      return 'tools';
    }
    return END;
  };

  const graph = new StateGraph(StateAnnotation)
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('tools', 'agent');

  const compiledGraph = graph.compile();

  const messages: any[] = [new SystemMessage(systemPrompt)];

  if (history && history.length > 1) {
    const recent = history.slice(-10);
    for (const m of recent) {
      if (m.senderType === 'user') {
        messages.push(new HumanMessage(m.content));
      } else {
        messages.push(new AIMessage(m.content));
      }
    }
  }

  messages.push(new HumanMessage(userMessage));

  const threadId = conversationId || `company-${companyId}`;
  const result = await compiledGraph.invoke(
    { messages },
    { configurable: { thread_id: threadId } },
  );

  const lastAiMessage = [...result.messages]
    .reverse()
    .find((m: any) => m instanceof AIMessage && typeof m.content === 'string' && m.content.trim());

  let raw = lastAiMessage?.content || null;
  const parsed = extractJson(raw);

  let intent: LangGraphResult['intent'] = 'other';
  let department: string | null = null;
  let lead: LangGraphResult['lead'] = null;
  let appointment: LangGraphResult['appointment'] = null;
  let response = '';

  const parseSucceeded = Boolean(parsed) && typeof parsed?.reply === 'string';

  if (parsed && typeof parsed.reply === 'string') {
    response = parsed.reply;
    intent = sanitizeIntent(parsed.intent);
    department = matchDepartment(parsed.department, departmentNames);
    lead = sanitizeLead(parsed.lead);
    appointment = sanitizeAppointment(parsed.appointment);
    if (!lead && extractEmail(userMessage)) {
      lead = { name: null, email: extractEmail(userMessage), phone: null };
    }
    if (intent === 'other' && looksLikeAppointment(userMessage)) {
      intent = 'appointment';
    }
    if (intent === 'escalate' && !visitorWantsHuman(userMessage, history)) {
      intent = 'other';
    }
  } else {
    response = raw || fallbackReply(context);
    if (looksLikeAppointment(userMessage)) intent = 'appointment';
    else if (extractEmail(userMessage) || /(\+?\d[\d\s-]{7,})/.test(userMessage)) intent = 'lead_capture';
    else if (context) intent = 'question';
    else intent = 'other';
    department = keywordDepartment(userMessage, departmentNames);
    const email = extractEmail(userMessage);
    const phoneMatch = userMessage.match(/(\+?\d[\d\s-]{7,})/);
    if (email || phoneMatch) {
      lead = { name: null, email, phone: phoneMatch ? phoneMatch[1].trim() : null };
    }
  }

  if (executed.lead) {
    lead = sanitizeLead(executed.lead);
    if (intent === 'other') intent = 'lead_capture';
  }
  if (executed.appointment) {
    appointment = sanitizeAppointment(executed.appointment);
    if (intent === 'other') intent = 'appointment';
  }

  const source: LangGraphResult['source'] = intent === 'escalate' ? 'escalate' : 'ai';

  steps.push(
    parseSucceeded
      ? { node: 'parse', label: 'Parsed assistant output', detail: { intent, department, source } }
      : { node: 'parse', label: 'Output parsing failed, used defaults' },
  );

  return {
    response,
    source,
    intent,
    department,
    lead,
    appointment,
    sources: ragResults,
    steps: capTraceSteps(steps),
  };
}

export function createLLM(): { primary: ChatOpenAI; fallback: ChatOpenAI | null } {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  let primary: ChatOpenAI;
  if (openrouterKey) {
    primary = new ChatOpenAI({
      modelName: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
      apiKey: openrouterKey,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.APP_URL || '',
          'X-Title': 'AI Virtual Receptionist',
        },
      },
      temperature: 0.5,
      maxTokens: 1024,
    });
  } else if (geminiKey) {
    primary = new ChatOpenAI({
      modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      apiKey: geminiKey,
      configuration: {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      },
      temperature: 0.5,
      maxTokens: 1024,
    });
  } else {
    throw new Error('No LLM API key configured (OPENROUTER_API_KEY or GEMINI_API_KEY)');
  }

  const fallback: ChatOpenAI | null =
    openrouterKey && geminiKey
      ? new ChatOpenAI({
          modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          apiKey: geminiKey,
          configuration: {
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
          },
          temperature: 0.5,
          maxTokens: 1024,
        })
      : null;

  return { primary, fallback };
}

function buildSystemPrompt(company: any, departments: any[], context: string, companyId: string): string {
  const deptList = departments.map((d) => d.name).join(', ') || 'Sales, Support, Billing';
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const contextPart = context
    ? `You answer from the knowledge base context below whenever it covers the question. If the context does not contain the answer, still respond helpfully and conversationally using your general knowledge. Never claim a company fact you do not know.\n\nContext:\n${context}`
    : 'There is no knowledge base content for this company yet. Answer every question helpfully and conversationally using general knowledge, as a polished receptionist would. Never claim specific company prices, hours, or policies you do not know — instead be friendly, ask a clarifying question, and keep the conversation going. Do NOT escalate unless the visitor explicitly asks for a human agent.';

  return `You are an AI virtual receptionist for "${company?.name || 'this company'}".
Today's date is ${todayStr} (YYYY-MM-DD). Always compute relative dates like "tomorrow" or "this Friday" from today's date.
You greet visitors, answer their questions, capture leads, book appointments, and route conversations to the right department.

Company departments: ${deptList}.

${contextPart}

BEHAVIOR:
- Be warm, friendly, personable and concise (1-3 sentences). Keep the conversation flowing like a real receptionist would — engage with the visitor, ask follow-up questions, and offer help even when you are unsure.
- NEVER invent specific company facts, prices, hours, or policies. Only use the knowledge base context above for those. For everything else, use general knowledge.
- NEVER say "I don't have that information" without trying to help first. Always try to be helpful.
- If no availability information exists in the context, collect the visitor's preferred date/time and let a human confirm.
- If the visitor provides their email and/or phone, capture it as a lead using the capture_lead tool.
- Choose the department that best matches the visitor's request, but only when the context or the request clearly indicates one.
- Escalate ONLY when the visitor explicitly and insistently asks to speak to a human agent. Otherwise always answer in conversation and never push the visitor toward a human.

TOOLS (use them for side effects instead of just talking):
- Call "capture_lead" when the visitor shares their name, email, or phone. Pass only the fields you actually know; leave the rest out.
- Call "book_appointment" when the visitor wants to schedule a meeting and you have a concrete date and time. Use the exact date (YYYY-MM-DD) and 24h time (HH:MM) they gave.
- Call "send_confirmation_email" right after booking when you know the visitor's email, with a short friendly confirmation message.
- Call "escalate_to_human" ONLY when the visitor explicitly asks for a human agent.
- Call "search_knowledge_base" when you need to look up specific information from the company's knowledge base.

After using tools, ALWAYS respond with a JSON object in this exact shape:
{"reply":"your message to the visitor","intent":"question|appointment|lead_capture|routing|escalate","department":"<department name or null>","lead":{"name":null,"email":null,"phone":null},"appointment":{"date":"YYYY-MM-DD","time":"HH:MM","title":null}}
- Set "lead" fields to null when unknown.
- Set "appointment" to null unless the visitor wants to schedule something.
- "date" must be an actual date from the conversation (YYYY-MM-DD), "time" in 24h HH:MM format.`;
}

function sanitizeIntent(value: any): LangGraphResult['intent'] {
  const allowed = ['question', 'appointment', 'lead_capture', 'routing', 'escalate', 'other'];
  return allowed.includes(value) ? value : 'other';
}

function sanitizeLead(value: any): LangGraphResult['lead'] | null {
  if (!value || typeof value !== 'object') return null;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : null;
  const email = typeof value.email === 'string' && value.email.trim() ? value.email.trim() : null;
  const phone = typeof value.phone === 'string' && value.phone.trim() ? value.phone.trim() : null;
  return name || email || phone ? { name, email, phone } : null;
}

function sanitizeAppointment(value: any): LangGraphResult['appointment'] | null {
  if (!value || typeof value !== 'object') return null;
  const date = typeof value.date === 'string' && value.date.trim() ? value.date.trim() : null;
  const time = typeof value.time === 'string' && value.time.trim() ? value.time.trim() : null;
  const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim() : null;
  return date || time || title ? { date, time, title } : null;
}

function matchDepartment(value: any, departments: any[]): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().toLowerCase();
  const known = departments.find((d) => d.name.toLowerCase() === normalized);
  if (known) return known.name;
  const match = departments.find((d) =>
    d.name.toLowerCase().includes(normalized) || normalized.includes(d.name.toLowerCase()),
  );
  return match?.name ?? null;
}

function keywordDepartment(text: string, departments: any[]): string | null {
  const lower = text.toLowerCase();
  for (const d of departments) {
    for (const kw of d.keywords || []) {
      if (lower.includes(kw.toLowerCase())) return d.name;
    }
  }
  return null;
}

function looksLikeAppointment(text: string): boolean {
  return /(appoint|book(?!s\b|store|marked)\w*|schedule|meeting|reserve|slot|availability|free (?:tomorrow|today|this week)|call(?:ing)? (?:me )?back|booking)/i.test(text);
}

function visitorWantsHuman(text: string, history?: { senderType: string; content: string }[]): boolean {
  const explicit = /(talk|speak|connect|reach|transfer|get)\s+(me\s+)?(to|with|a)\s+(a\s+)?(real\s+)?(human|agent|person|representative|support team|someone)|human agent|real person|talk to someone|i need a human|talk to an agent/i;
  if (explicit.test(text)) return true;
  if (history) {
    const recent = history.filter((m) => m.senderType === 'user').slice(-3);
    return recent.some((m) => explicit.test(m.content));
  }
  return false;
}

function extractEmail(text: string): string | null {
  const match = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function fallbackReply(context: string): string {
  if (context) {
    const firstLine = context.split('\n').find((l) => l.trim());
    return firstLine
      ? `Based on our information: ${firstLine.slice(0, 280)}`
      : "I've noted your question. Could you give me a little more detail so I can help you best?";
  }
  return "I'd be happy to help with that! Could you share a few more details about what you're looking for?";
}
