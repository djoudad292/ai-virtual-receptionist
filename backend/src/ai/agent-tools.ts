export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResult {
  role: 'tool';
  toolCallId: string;
  toolName: string;
  content: string;
}

export interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: OpenAiToolCall[];
}

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, any> };
  functionResponse?: { name: string; response: Record<string, any> };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export function toGeminiContents(messages: OpenAIMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      const response = safeParse(m.content);
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: 'executor',
              response: typeof response === 'object' && response !== null ? response : { output: m.content },
            },
          },
        ],
      });
      continue;
    }
    if (m.role === 'assistant' && m.tool_calls?.length) {
      contents.push({
        role: 'model',
        parts: m.tool_calls.map((tc) => ({
          functionCall: {
            name: tc.function.name,
            args: parseToolArgs(tc.function.arguments),
          },
        })),
      });
      continue;
    }
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
    if (m.content) {
      contents.push({ role, parts: [{ text: m.content }] });
    }
  }
  return contents;
}

function safeParse(text: string | null): any {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { output: text };
  }
}

export interface ToolTurn {
  role: 'assistant';
  content: string | null;
  toolCalls: ToolCall[];
}

export const CAPTURE_LEAD_TOOL: ToolDefinition = {
  name: 'capture_lead',
  description:
    'Save the visitor contact information as a lead. Call when the visitor shares their name, email, or phone number.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Visitor full name' },
      email: { type: 'string', description: 'Visitor email address' },
      phone: { type: 'string', description: 'Visitor phone number' },
    },
  },
};

export const BOOK_APPOINTMENT_TOOL: ToolDefinition = {
  name: 'book_appointment',
  description:
    'Book an appointment for the visitor at a given date (YYYY-MM-DD) and time (24h HH:MM). Call when the visitor wants to schedule a meeting.',
  parameters: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'Appointment date in YYYY-MM-DD' },
      time: { type: 'string', description: 'Appointment time in 24h HH:MM format' },
      title: { type: 'string', description: 'Optional short title for the appointment' },
    },
    required: ['date', 'time'],
  },
};

export const SEND_CONFIRMATION_EMAIL_TOOL: ToolDefinition = {
  name: 'send_confirmation_email',
  description:
    'Send a confirmation email to the visitor. Call right after booking an appointment when you have their email.',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Plain text email body' },
    },
    required: ['to', 'subject', 'body'],
  },
};

export const RECEPTIONIST_TOOLS: ToolDefinition[] = [
  CAPTURE_LEAD_TOOL,
  BOOK_APPOINTMENT_TOOL,
  SEND_CONFIRMATION_EMAIL_TOOL,
];

export function openAiTools(tools: ToolDefinition[]): { type: 'function'; function: ToolDefinition }[] {
  return tools.map((t) => ({ type: 'function', function: t }));
}

export function geminiTools(tools: ToolDefinition[]): { functionDeclarations: ToolDefinition[] }[] {
  return [{ functionDeclarations: tools }];
}

export function parseToolArgs(raw: string | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
