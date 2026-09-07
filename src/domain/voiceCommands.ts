/** A recognised spoken instruction. */
export type VoiceCommand =
  | { kind: 'setDuration'; seconds: number; spokenValue: number; inMinutes: boolean }
  | { kind: 'start' }
  | { kind: 'pause' }
  | { kind: 'reset' }
  | { kind: 'turn' };

const UNIT_RE = /\b(minutes?|mins?|seconds?|secs?)\b/;
const START_RE = /\b(start|begin|resume|go|commence)\b/;
const PAUSE_RE = /\b(pause|stop|hold|suspend)\b/;
const RESET_RE = /\b(reset|restart)\b/;
const TURN_RE = /\bgira\b/;

/** Longest sensible bake: two hours. Guards against a misheard "one hundred minutes". */
const MAX_SECONDS = 2 * 60 * 60;

const UNITS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/**
 * Matches a transcript against the handoff's command list. Case-insensitive,
 * checked in the same order as the prototype so that "start a 3 minute bake"
 * sets the duration rather than starting the run.
 *
 * Speech recognisers return numbers as digits most of the time but not
 * always, so spelled-out numbers ("ninety", "forty five") are accepted too.
 */
export function parseVoiceCommand(raw: string): VoiceCommand | null {
  const text = raw.toLowerCase().trim();
  if (text.length === 0) return null;

  const duration = durationIn(text);
  if (duration) return duration;

  if (START_RE.test(text)) return { kind: 'start' };
  if (PAUSE_RE.test(text)) return { kind: 'pause' };
  if (RESET_RE.test(text)) return { kind: 'reset' };
  if (TURN_RE.test(text)) return { kind: 'turn' };
  return null;
}

function durationIn(text: string): VoiceCommand | null {
  const match = UNIT_RE.exec(text);
  if (!match || match.index === undefined) return null;

  const value = trailingNumber(text.slice(0, match.index));
  if (value === null || value <= 0) return null;

  const unit = match[1] ?? '';
  const inMinutes = unit.startsWith('min');
  const seconds = inMinutes ? value * 60 : value;
  if (seconds > MAX_SECONDS) return null;

  return { kind: 'setDuration', seconds, spokenValue: value, inMinutes };
}

/** Reads a number off the end of a phrase: "set it for forty five" → 45. */
function trailingNumber(head: string): number | null {
  const words = head.trim().split(/[\s-]+/).filter((w) => w.length > 0);
  if (words.length === 0) return null;

  const strip = (w: string) => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  const last = strip(words[words.length - 1] ?? '');

  if (/^\d+$/.test(last)) return Number.parseInt(last, 10);

  if (words.length >= 2) {
    const tens = TENS[strip(words[words.length - 2] ?? '')];
    const unit = UNITS[last];
    if (tens !== undefined && unit !== undefined && unit < 10) return tens + unit;
  }

  return TENS[last] ?? UNITS[last] ?? null;
}
