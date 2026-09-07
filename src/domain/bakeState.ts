/**
 * The whole timer state. A direct port of the Kotlin `BakeState` — same
 * fields, same derived values, same rules.
 */
export type BakeState = {
  presetSeconds: number;
  remaining: number;
  running: boolean;
  /** Has the halfway "gira" already fired for this run? Cleared on reset / preset change. */
  hasTurned: boolean;
};

export const INITIAL_BAKE: BakeState = {
  presetSeconds: 90,
  remaining: 90,
  running: false,
  hasTurned: false,
};

/** 0 at the start of the bake, 1 when the timer reaches zero. */
export function progressOf(state: BakeState): number {
  if (state.presetSeconds <= 0) return 0;
  const raw = 1 - state.remaining / state.presetSeconds;
  return Math.min(1, Math.max(0, raw));
}

export function isDone(state: BakeState): boolean {
  return state.remaining === 0;
}

/** True once the bake has been started and then paused part-way through. */
export function isPaused(state: BakeState): boolean {
  return !state.running && !isDone(state) && state.remaining < state.presetSeconds;
}

/** `m:ss` — minutes are not zero-padded, seconds are. */
export function timeLabel(state: BakeState): string {
  const minutes = Math.floor(state.remaining / 60);
  const seconds = state.remaining % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Things the countdown announces as it runs. Order of emission matters. */
export type BakeEvent = 'tick' | 'turn' | 'done';
