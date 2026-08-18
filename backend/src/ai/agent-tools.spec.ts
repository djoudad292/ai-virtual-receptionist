import {
  RECEPTIONIST_TOOLS,
  CAPTURE_LEAD_TOOL,
  BOOK_APPOINTMENT_TOOL,
  SEND_CONFIRMATION_EMAIL_TOOL,
  openAiTools,
  geminiTools,
  parseToolArgs,
  toGeminiContents,
} from './agent-tools';

describe('agent-tools definitions', () => {
  it('declares the three receptionist tools', () => {
    expect(RECEPTIONIST_TOOLS.map((t) => t.name)).toEqual([
      'capture_lead',
      'book_appointment',
      'send_confirmation_email',
    ]);
  });

  it('requires date and time for book_appointment', () => {
    expect(BOOK_APPOINTMENT_TOOL.parameters.required).toEqual(['date', 'time']);
  });

  it('formats tools in OpenAI shape', () => {
    const tools = openAiTools([CAPTURE_LEAD_TOOL]);
    expect(tools[0]).toEqual({ type: 'function', function: CAPTURE_LEAD_TOOL });
  });

  it('formats tools in Gemini shape', () => {
    expect(geminiTools(RECEPTIONIST_TOOLS)).toEqual([
      { functionDeclarations: RECEPTIONIST_TOOLS },
    ]);
  });
});

describe('parseToolArgs', () => {
  it('parses valid JSON', () => {
    expect(parseToolArgs('{"email":"a@b.com"}')).toEqual({ email: 'a@b.com' });
  });

  it('returns {} for malformed JSON', () => {
    expect(parseToolArgs('{oops')).toEqual({});
    expect(parseToolArgs(undefined)).toEqual({});
  });

  it('returns {} for non-object JSON', () => {
    expect(parseToolArgs('"hello"')).toEqual({});
  });
});

describe('toGeminiContents', () => {
  it('maps plain messages to user/model parts', () => {
    const contents = toGeminiContents([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'sys' }] },
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'hello' }] },
    ]);
  });

  it('maps an assistant tool-call turn to a functionCall part', () => {
    const contents = toGeminiContents([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'book_appointment', arguments: '{"date":"2026-01-02","time":"14:00"}' },
          },
        ],
      },
    ]);
    expect(contents).toEqual([
      {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: 'book_appointment',
              args: { date: '2026-01-02', time: '14:00' },
            },
          },
        ],
      },
    ]);
  });

  it('maps a tool result to a functionResponse part', () => {
    const contents = toGeminiContents([
      { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true,"appointmentId":"a1"}' },
    ]);
    expect(contents).toEqual([
      {
        role: 'user',
        parts: [{ functionResponse: { name: 'executor', response: { ok: true, appointmentId: 'a1' } } }],
      },
    ]);
  });

  it('falls back to an output envelope for non-JSON tool results', () => {
    const contents = toGeminiContents([
      { role: 'tool', tool_call_id: 'call_1', content: 'some plain text' },
    ]);
    expect(contents[0].parts[0].functionResponse!.response).toEqual({ output: 'some plain text' });
  });
});
