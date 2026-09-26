/**
 * Pure voice selection for the demo Talk mode. No React, no 'use client' —
 * importable from both the browser component and the Node eval harness.
 *
 * `pickMaleVoice` is deterministic and synchronous: it takes the array returned
 * by `window.speechSynthesis.getVoices()` and returns the first male English
 * voice, or null when none exists. The caller then leaves the utterance voice
 * unset (browser default) instead of forcing a female voice.
 */

export const MALE_VOICE_HINTS = ['daniel', 'alex', 'david', 'fred', 'george', 'guy',
  'ryan', 'thomas', 'mark', 'james', 'oliver', 'aaron', 'male']

const HINT_RE = new RegExp('\\b(' + MALE_VOICE_HINTS.join('|') + ')\\b', 'i')

/**
 * Pick a male English voice from the synthesis voice list.
 *
 * Rules:
 *  - Consider only voices whose `lang` starts with `en` (case-insensitive).
 *    If none qualify, return null.
 *  - Among English voices, return the first whose `name` matches a hint
 *    substring wrapped in word boundaries. Word boundaries are mandatory:
 *    a bare `male` substring would also match "...Female" (female contains
 *    male), and `fred` would match "Frederica". `\b...\b` rejects those while
 *    still matching "Google UK English Male", "Microsoft David", "Daniel",
 *    "Alex", "en-GB-#male".
 *  - If no hint matches, return null.
 */
export function pickMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  if (english.length === 0) return null
  return english.find((v) => HINT_RE.test(v.name)) ?? null
}