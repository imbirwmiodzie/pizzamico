import type { BakeEvent, BakeState } from './bakeState';

/**
 * Pure reducer for the countdown. Every rule the handoff specifies lives
 * here — no React, no Expo, no platform imports — so it can be tested in
 * milliseconds and reasoned about on its own.
 */

/** Seconds between ticks (handoff: "every 10 seconds"). */
export const TICK_INTERVAL_SECONDS = 10;

export type Step = { state: BakeState; events: BakeEvent[] };

/**
 * Advance the countdown by exactly one second.
 *
 * Emission order matches the prototype: turn, then tick, then done. The tick
 * is keyed off the *remaining* count, so a 90s bake ticks at 0:80, 0:70 …
 * 0:10 and stays silent at zero, where the "pronta" shout takes over.
 */
export function tickSecond(state: BakeState): Step {
  if (!state.running || state.remaining <= 0) return { state, events: [] };

  const next = state.remaining - 1;
  const halfway = state.presetSeconds > 0 && next <= state.presetSeconds / 2 && !state.hasTurned;

  const events: BakeEvent[] = [];
  if (halfway) events.push('turn');
  if (next > 0 && next % TICK_INTERVAL_SECONDS === 0) events.push('tick');
  if (next === 0) events.push('done');

  return {
    state: {
      ...state,
      remaining: next,
      running: next > 0,
      hasTurned: state.hasTurned || halfway,
    },
    events,
  };
}

/** Play/pause. Pressing play at zero restarts from the selected preset. */
export function toggleRun(state: BakeState): BakeState {
  if (!state.running && state.remaining <= 0) {
    return { ...state, running: true, remaining: state.presetSeconds, hasTurned: false };
  }
  return { ...state, running: !state.running };
}

/** Voice "start"/"resume": run from where we are, or from the top if we're at zero. */
export function start(state: BakeState): BakeState {
  if (state.remaining <= 0) {
    return { ...state, running: true, remaining: state.presetSeconds, hasTurned: false };
  }
  return { ...state, running: true };
}

export function pause(state: BakeState): BakeState {
  return { ...state, running: false };
}

/** Back to the top of the selected preset; the halfway turn can fire again. */
export function reset(state: BakeState): BakeState {
  return { ...state, running: false, remaining: state.presetSeconds, hasTurned: false };
}

/** Tapping a preset chip. Ignored while the bake is running, as in the prototype. */
export function selectPreset(state: BakeState, seconds: number): BakeState {
  if (state.running) return state;
  return { ...state, presetSeconds: seconds, remaining: seconds, hasTurned: false };
}

/**
 * A duration set by voice ("three minutes"). Unlike a preset tap this is
 * accepted mid-bake — it stops the run and re-arms at the new duration.
 */
export function setDuration(state: BakeState, seconds: number): BakeState {
  return { ...state, presetSeconds: seconds, remaining: seconds, running: false, hasTurned: false };
}

/**
 * Keep the state consistent when the oven preset changes underneath us: if
 * the current duration is not one this oven offers and nothing is running,
 * snap to that oven's middle preset.
 */
export function conformToOven(state: BakeState, presets: readonly number[]): BakeState {
  if (state.running || presets.includes(state.presetSeconds)) return state;
  const target = presets[Math.floor(presets.length / 2)];
  if (target === undefined) return state;
  return { ...state, presetSeconds: target, remaining: target, hasTurned: false };
}
