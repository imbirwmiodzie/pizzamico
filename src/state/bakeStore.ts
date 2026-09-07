import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

import PizzaBakeService from '../../modules/pizza-bake-service';
import type { BakeState } from '../domain/bakeState';
import { INITIAL_BAKE } from '../domain/bakeState';
import { ITALIAN_LINES, SHOUT } from '../domain/toneCopy';
import {
  TICK_INTERVAL_SECONDS,
  conformToOven,
  pause as pauseState,
  reset as resetState,
  selectPreset as selectPresetState,
  setDuration as setDurationState,
  start as startState,
  toggleRun as toggleRunState,
} from '../domain/timerEngine';

/**
 * The one live bake for the whole app.
 *
 * Two clocks would be one too many, so there is exactly one source of truth
 * while the timer runs: `endAt`, an absolute timestamp. The native service
 * fires the audio cues from it, and the UI derives the number on screen from
 * it. Backgrounding, doze, a slow frame — none of it can make the shout and
 * the display disagree.
 *
 * When nothing is running, the state is whatever the pure reducers in
 * `domain/timerEngine` say it is; those are the tested rules.
 */

export type BakeSnapshot = BakeState & {
  /** Absolute epoch ms when the bake ends; null when not running. */
  endAt: number | null;
  /** Bumped every time the pizza should flip. */
  turnTrigger: number;
};

type Listener = () => void;

let snapshot: BakeSnapshot = { ...INITIAL_BAKE, endAt: null, turnTrigger: 0 };
const listeners = new Set<Listener>();
let displayTimer: ReturnType<typeof setInterval> | null = null;

/** iOS has no foreground service; JS has to make the noise itself there. */
const nativeDrivesCues = Platform.OS === 'android' && PizzaBakeService.isSupported;

function emit() {
  listeners.forEach((listener) => listener());
}

function set(next: Partial<BakeSnapshot>) {
  snapshot = { ...snapshot, ...next };
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): BakeSnapshot {
  return snapshot;
}

/** Seconds left, rounded up, so 0 means the bake is over. */
function remainingFrom(endAt: number): number {
  return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
}

/**
 * The moment the halfway turn is due, expressed as seconds remaining.
 * Mirrors the engine's rule (`next <= total / 2`) as a single number the
 * native side can compare against.
 */
function turnAtRemaining(totalSeconds: number): number {
  return Math.floor(totalSeconds / 2);
}

/* ── running ─────────────────────────────────────────────────────────────── */

function beginCountdown(from: BakeState) {
  const endAt = Date.now() + from.remaining * 1000;
  set({ ...from, running: true, endAt });

  if (nativeDrivesCues) {
    PizzaBakeService.startBake({
      endAt,
      totalSeconds: from.presetSeconds,
      turnAtRemaining: from.hasTurned ? -1 : turnAtRemaining(from.presetSeconds),
      tickEverySeconds: TICK_INTERVAL_SECONDS,
      turnLine: ITALIAN_LINES.turn,
      doneLine: ITALIAN_LINES.done,
    });
  }

  startDisplayTimer();
}

function stopCountdown(next: BakeState) {
  stopDisplayTimer();
  if (nativeDrivesCues) PizzaBakeService.stopBake();
  set({ ...next, endAt: null });
}

function startDisplayTimer() {
  stopDisplayTimer();
  // Four times a second: fast enough that the readout never looks stuck on a
  // second boundary, cheap enough to be invisible.
  displayTimer = setInterval(tickDisplay, 250);
}

function stopDisplayTimer() {
  if (displayTimer) clearInterval(displayTimer);
  displayTimer = null;
}

function tickDisplay() {
  const { endAt, running } = snapshot;
  if (!running || endAt === null) return;

  const remaining = remainingFrom(endAt);
  if (remaining === snapshot.remaining) return;

  if (remaining <= 0) {
    stopDisplayTimer();
    set({ remaining: 0, running: false, endAt: null });
    if (!nativeDrivesCues) speakFallback(ITALIAN_LINES.done, SHOUT.done);
    return;
  }

  // On the platforms where JS owns the cues, fire them here.
  if (!nativeDrivesCues) {
    const crossedTurn = !snapshot.hasTurned && remaining <= turnAtRemaining(snapshot.presetSeconds);
    if (crossedTurn) {
      set({ hasTurned: true, turnTrigger: snapshot.turnTrigger + 1 });
      speakFallback(ITALIAN_LINES.turn, SHOUT.turn);
    }
  }

  set({ remaining });
}

function speakFallback(line: string, delivery: { pitch: number; rate: number }) {
  Speech.speak(line, {
    language: 'it-IT',
    pitch: delivery.pitch,
    rate: delivery.rate,
  });
}

/* ── native cues ─────────────────────────────────────────────────────────── */

if (nativeDrivesCues) {
  PizzaBakeService.addListener('onBakeEvent', ({ event }) => {
    if (event === 'turn') {
      set({ hasTurned: true, turnTrigger: snapshot.turnTrigger + 1 });
    } else if (event === 'done') {
      stopDisplayTimer();
      set({ remaining: 0, running: false, endAt: null });
    }
  });
}

/* ── the actions the UI calls ────────────────────────────────────────────── */

export const bakeActions = {
  toggleRun() {
    const next = toggleRunState(snapshot);
    if (next.running) beginCountdown(next);
    else stopCountdown(next);
  },

  start() {
    const next = startState(snapshot);
    if (next.running) beginCountdown(next);
  },

  pause() {
    stopCountdown(pauseState(snapshot));
  },

  reset() {
    stopCountdown(resetState(snapshot));
  },

  selectPreset(seconds: number) {
    const next = selectPresetState(snapshot, seconds);
    if (next !== snapshot) stopCountdown(next);
  },

  setDuration(seconds: number) {
    stopCountdown(setDurationState(snapshot, seconds));
  },

  /** Voice "gira" — a turn asked for by hand, outside the halfway trigger. */
  requestTurn() {
    set({ turnTrigger: snapshot.turnTrigger + 1 });
    if (nativeDrivesCues) {
      PizzaBakeService.shout(ITALIAN_LINES.turn, SHOUT.turn.pitch, SHOUT.turn.rate);
    } else {
      speakFallback(ITALIAN_LINES.turn, SHOUT.turn);
    }
  },

  /** Keep the duration valid when the oven preset changes underneath us. */
  conformToOven(presets: readonly number[]) {
    const next = conformToOven(snapshot, presets);
    if (next !== snapshot) set(next);
  },
};
