import type { VoiceTone } from './settings';

/**
 * The casual/formal copy sets from the handoff. Both tones share the shouted
 * Italian lines — those are the character of the app and never soften.
 */
export type ToneCopy = {
  ready: string;
  baking: string;
  /** The long preset is the oven coming up to heat, not a bake. */
  preheating: string;
  preheated: string;
  paused: string;
  done: string;
  micPrompt: string;
  hints: [string, string, string];
  startAnnounce: string;
  pauseAnnounce: string;
  resetAnnounce: string;
};

const CASUAL: ToneCopy = {
  ready: 'Ready to bake',
  baking: 'Baking…',
  preheating: 'Heating the oven…',
  preheated: 'Oven is ready!',
  paused: 'Paused',
  done: 'La pizza è pronta!!!',
  micPrompt: 'Tap to speak, or say "Hey timer, start"',
  hints: ['Start timer', 'Pause', 'Reset'],
  startAnnounce: 'Started timer',
  pauseAnnounce: 'Paused timer',
  resetAnnounce: 'Reset timer',
};

const FORMAL: ToneCopy = {
  ready: 'Standing by',
  baking: 'Bake in progress',
  preheating: 'Preheat in progress',
  preheated: 'Oven at temperature',
  paused: 'Bake paused',
  done: 'La pizza è pronta!!!',
  micPrompt: 'Tap to speak, or say "Timer, commence"',
  hints: ['Commence bake', 'Suspend bake', 'Reset bake'],
  startAnnounce: 'Commenced bake',
  pauseAnnounce: 'Suspended bake',
  resetAnnounce: 'Bake reset',
};

export function toneCopy(tone: VoiceTone): ToneCopy {
  return tone === 'formal' ? FORMAL : CASUAL;
}

/** The two shouted lines, spoken in Italian with a low pitch and a fast rate. */
export const ITALIAN_LINES = {
  turn: 'GIRA! GIRA GIRA!',
  done: 'LA PIZZA È PRONTA!!!',
  /** Shouted at the end of a preheat — there is no pizza in there yet. */
  preheatDone: 'IL FORNO È PRONTO!',
  /** On-screen toast for the halfway turn. */
  turnToast: 'Gira, gira! 🍕',
} as const;

/** Delivery for the shouted lines: low, fast, full volume. */
export const SHOUT = {
  turn: { pitch: 0.65, rate: 1.35 },
  done: { pitch: 0.7, rate: 1.2 },
} as const;
