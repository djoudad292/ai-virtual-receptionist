/**
 * Single source of truth for the Gemini endpoint.
 *
 * 2026-10-18: four call sites hardcoded `v1beta`, which no longer serves
 * generateContent for keys provisioned after the v1 cutover. Every request
 * returned 404 with an empty body, which surfaced as "Gemini generation
 * failed" rather than an auth error. `v1` is the working surface; the version
 * stays configurable so a future cutover is an env change, not a code change.
 */
export const GEMINI_API_BASE =
  process.env.GEMINI_API_BASE ||
  `https://generativelanguage.googleapis.com/${process.env.GEMINI_API_VERSION || 'v1'}`;

/** Native generateContent endpoint. */
export const GEMINI_NATIVE_URL = (model: string, key: string): string =>
  `${GEMINI_API_BASE}/models/${model}:generateContent?key=${key}`;

/** OpenAI-compatible endpoint, used by the LangGraph agent via ChatOpenAI. */
export const GEMINI_OPENAI_URL = `${GEMINI_API_BASE}/openai/`;

/**
 * Default model. gemini-2.5-flash is no longer available to newly
 * provisioned keys ("use gemini-3.8-flash" per the API error), so the default
 * tracks a model the current key can actually invoke.
 */
export const GEMINI_DEFAULT_MODEL =
  process.env.GEMINI_MODEL || 'gemini-3.5-flash';

/**
 * Thinking is off by default.
 *
 * gemini-3.5-flash is a thinking model and spends output budget on internal
 * reasoning before it answers. Measured on a three-part receptionist question
 * at maxOutputTokens 1024: 718 tokens went to thinking, 302 remained, and the
 * response came back finishReason MAX_TOKENS — truncated mid-answer. With
 * thinkingBudget 0 the same call returns finishReason STOP in 72 tokens.
 *
 * A booking assistant that answers "here are our hours, the parking, and what
 * to bring" must not stop halfway through the list. Raise GEMINI_MAX_TOKENS
 * before re-enabling thinking, and measure truncation again.
 */
export const GEMINI_THINKING_OFF = { thinkingConfig: { thinkingBudget: 0 } };

export const GEMINI_MAX_TOKENS = Number(process.env.GEMINI_MAX_TOKENS) || 1024;