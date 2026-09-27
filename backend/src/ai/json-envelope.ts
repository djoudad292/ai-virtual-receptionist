const ENVELOPE_SHAPE = /\{\s*"reply"\s*:/;
const REPLY_CLOSED = /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/;
const REPLY_OPEN = /"reply"\s*:\s*"((?:[^"\\]|\\.)*)/;
const INTENT = /"intent"\s*:\s*"([a-z_]+)"/;

function unquote(value: string): string {
  try {
    return JSON.parse('"' + value + '"');
  } catch {
    return value;
  }
}

function recoverEnvelope(candidate: string): { reply: string; intent?: string } | null {
  if (!ENVELOPE_SHAPE.test(candidate)) return null;
  const closed = candidate.match(REPLY_CLOSED);
  const open = closed ?? candidate.match(REPLY_OPEN);
  if (!open) return null;
  const recovered: { reply: string; intent?: string } = { reply: unquote(open[1]) };
  const intent = candidate.match(INTENT);
  if (intent) recovered.intent = intent[1];
  return recovered;
}

export function extractJson(text: string | null): any | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return recoverEnvelope(candidate);
    }
  }
  return recoverEnvelope(candidate);
}
