import type { BakeEvent, BakeState } from '../src/domain/bakeState';
import { isDone, isPaused, progressOf, timeLabel } from '../src/domain/bakeState';
import {
  conformToOven,
  pause,
  reset,
  selectPreset,
  setDuration,
  start,
  tickSecond,
  toggleRun,
} from '../src/domain/timerEngine';
import { OVEN_PRESETS, isPreheat, presetLabel } from '../src/domain/settings';

const bake = (over: Partial<BakeState> = {}): BakeState => ({
  presetSeconds: 90,
  remaining: 90,
  running: false,
  hasTurned: false,
  ...over,
});

/** Runs a whole bake and reports what was heard, second by second. */
function runBake(from: BakeState): { end: BakeState; log: Array<[number, BakeEvent]> } {
  let state = from;
  const log: Array<[number, BakeEvent]> = [];
  for (let i = 0; i < from.presetSeconds + 5; i++) {
    const step = tickSecond(state);
    state = step.state;
    step.events.forEach((event) => log.push([state.remaining, event]));
  }
  return { end: state, log };
}

const at = (log: Array<[number, BakeEvent]>, event: BakeEvent) =>
  log.filter(([, e]) => e === event).map(([remaining]) => remaining);

describe('the countdown', () => {
  it('turns once at the halfway mark of a 90 second bake', () => {
    const { log } = runBake(bake({ running: true }));
    expect(at(log, 'turn')).toEqual([45]);
  });

  it('ticks every ten seconds and never at zero', () => {
    const { log } = runBake(bake({ running: true }));
    expect(at(log, 'tick')).toEqual([80, 70, 60, 50, 40, 30, 20, 10]);
  });

  it('ends exactly once, at zero, and stops itself', () => {
    const { end, log } = runBake(bake({ presetSeconds: 60, remaining: 60, running: true }));
    expect(at(log, 'done')).toEqual([0]);
    expect(end.remaining).toBe(0);
    expect(end.running).toBe(false);
  });

  it('still turns once on an odd duration, just past the midpoint', () => {
    const { log } = runBake(bake({ presetSeconds: 45, remaining: 45, running: true }));
    expect(at(log, 'turn')).toEqual([22]);
  });

  it('does not move while paused', () => {
    const paused = bake({ remaining: 42 });
    const step = tickSecond(paused);
    expect(step.state).toEqual(paused);
    expect(step.events).toEqual([]);
  });
});

describe('the transport', () => {
  it('restarts from the preset and re-arms the turn when play is pressed at zero', () => {
    const restarted = toggleRun(bake({ presetSeconds: 60, remaining: 0, hasTurned: true }));
    expect(restarted.running).toBe(true);
    expect(restarted.remaining).toBe(60);
    expect(restarted.hasTurned).toBe(false);
  });

  it('pauses without losing the remaining time', () => {
    expect(pause(bake({ remaining: 33, running: true }))).toEqual(
      bake({ remaining: 33, running: false }),
    );
  });

  it('resets to the top of the preset and re-arms the turn', () => {
    const back = reset(bake({ remaining: 12, running: true, hasTurned: true }));
    expect(back).toEqual(bake());
  });

  it('ignores preset chips while the bake runs', () => {
    const running = bake({ remaining: 40, running: true });
    expect(selectPreset(running, 720)).toEqual(running);

    const picked = selectPreset(bake({ hasTurned: true }), 720);
    expect(picked.presetSeconds).toBe(720);
    expect(picked.remaining).toBe(720);
    expect(picked.hasTurned).toBe(false);
  });

  it('stops and re-arms when a duration is set by voice mid-bake', () => {
    const set = setDuration(bake({ remaining: 40, running: true, hasTurned: true }), 180);
    expect(set).toEqual(bake({ presetSeconds: 180, remaining: 180 }));
  });

  it('resumes where it was, and restarts from zero', () => {
    expect(start(bake({ remaining: 33 })).remaining).toBe(33);
    expect(start(bake({ remaining: 33 })).running).toBe(true);
    expect(start(bake({ remaining: 0 })).remaining).toBe(90);
  });
});

describe('derived values', () => {
  it('tracks progress and the readout', () => {
    expect(progressOf(bake())).toBe(0);
    expect(timeLabel(bake())).toBe('1:30');

    expect(progressOf(bake({ remaining: 45 }))).toBe(0.5);
    expect(timeLabel(bake({ remaining: 45 }))).toBe('0:45');

    const done = bake({ remaining: 0 });
    expect(progressOf(done)).toBe(1);
    expect(timeLabel(done)).toBe('0:00');
    expect(isDone(done)).toBe(true);

    expect(timeLabel(bake({ presetSeconds: 720, remaining: 720 }))).toBe('12:00');
  });

  it('knows a paused bake from a fresh one', () => {
    expect(isPaused(bake())).toBe(false);
    expect(isPaused(bake({ remaining: 42 }))).toBe(true);
    expect(isPaused(bake({ remaining: 42, running: true }))).toBe(false);
    expect(isPaused(bake({ remaining: 0 }))).toBe(false);
  });
});

describe('oven presets', () => {
  it('snaps an idle timer onto a duration the new oven offers', () => {
    const conformed = conformToOven(
      bake({ presetSeconds: 720, remaining: 720 }),
      OVEN_PRESETS.woodFired,
    );
    expect(conformed.presetSeconds).toBe(60);
    expect(conformed.remaining).toBe(60);
  });

  it('never snaps onto a preheat — that would arm half an hour unnoticed', () => {
    const conformed = conformToOven(bake({ presetSeconds: 12, remaining: 12 }), OVEN_PRESETS.home);
    expect(isPreheat(conformed.presetSeconds)).toBe(false);
    expect(OVEN_PRESETS.home).toContain(conformed.presetSeconds);
  });

  it('leaves a valid or running timer alone', () => {
    const valid = bake();
    expect(conformToOven(valid, OVEN_PRESETS.woodFired)).toEqual(valid);

    const running = bake({ presetSeconds: 720, remaining: 700, running: true });
    expect(conformToOven(running, OVEN_PRESETS.woodFired)).toEqual(running);
  });

  it('offers the preheat on every oven', () => {
    expect(OVEN_PRESETS.home.filter(isPreheat)).toHaveLength(1);
    expect(OVEN_PRESETS.woodFired.filter(isPreheat)).toHaveLength(1);
  });

  it('calls the long preset a preheat and the short ones a bake', () => {
    expect(OVEN_PRESETS.home.map(isPreheat)).toEqual([false, false, true]);
    expect(OVEN_PRESETS.woodFired.map(isPreheat)).toEqual([false, false, false, true]);

    // The boundary itself counts as a preheat, and a voice-set duration is
    // judged by the same rule as a preset chip.
    expect(isPreheat(1799)).toBe(false);
    expect(isPreheat(1800)).toBe(true);
    expect(isPreheat(3600)).toBe(true);
  });

  it('labels durations the way the handoff does', () => {
    expect(OVEN_PRESETS.home.map(presetLabel)).toEqual(['60s', '90s', '30 min']);
    expect(OVEN_PRESETS.woodFired.map(presetLabel)).toEqual(['45s', '60s', '90s', '30 min']);
  });
});
