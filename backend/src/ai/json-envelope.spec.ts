import { extractJson } from './json-envelope';

describe('extractJson', () => {
  it('parses a valid plain JSON object as-is', () => {
    const text = '{"reply":"Hi","intent":"question","department":null}';
    expect(extractJson(text)).toEqual({ reply: 'Hi', intent: 'question', department: null });
  });

  it('parses a valid JSON object inside a fenced block', () => {
    const text = '```json\n{"reply":"Hi there","intent":"escalate"}\n```';
    expect(extractJson(text)).toEqual({ reply: 'Hi there', intent: 'escalate' });
  });

  it('recovers reply from an envelope truncated mid-intent', () => {
    const text = '{"reply":"Hi there","intent":"que';
    expect(extractJson(text)).toEqual({ reply: 'Hi there' });
  });

  it('recovers reply from an envelope truncated mid-reply value', () => {
    expect(extractJson('{"reply":"Hello wor')).toEqual({ reply: 'Hello wor' });
  });

  it('recovers reply containing escaped quotes', () => {
    const text = '{"reply":"He said \\"hi\\"","intent":"q';
    expect(extractJson(text)!.reply).toBe('He said "hi"');
  });

  it('returns null for plain prose', () => {
    expect(extractJson('Sure, I can help with that. What do you need?')).toBeNull();
  });

  it('returns null for null and empty input', () => {
    expect(extractJson(null)).toBeNull();
    expect(extractJson('')).toBeNull();
  });

  it('returns null when "reply" appears without a leading brace', () => {
    expect(extractJson('the field "reply" is required')).toBeNull();
  });
});
