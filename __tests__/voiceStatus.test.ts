import { toneCopy } from '../src/domain/toneCopy';
import type { VoiceStatus } from '../src/domain/voiceStatus';
import { confirmationFor, transcriptLine } from '../src/domain/voiceStatus';

const status = (over: Partial<VoiceStatus> = {}): VoiceStatus => ({
  supported: true,
  listening: false,
  hearing: null,
  confirmation: null,
  problem: null,
  ...over,
});

const PROMPT = 'Tap to speak';

describe('the line under the microphone', () => {
  it('puts what it is hearing above everything else', () => {
    const line = transcriptLine(
      status({ listening: true, hearing: 'three min', confirmation: 'Paused timer' }),
      PROMPT,
    );
    expect(line).toBe('Hearing: “three min”');
  });

  it('shows the last confirmed command while it is still listening', () => {
    expect(transcriptLine(status({ listening: true, confirmation: 'Started timer' }), PROMPT)).toBe(
      '✓ Started timer',
    );
  });

  it('falls back through listening, then the problem, then the prompt', () => {
    expect(transcriptLine(status({ listening: true }), PROMPT)).toBe('Listening…');
    expect(transcriptLine(status({ problem: 'Microphone is off.' }), PROMPT)).toBe(
      'Microphone is off.',
    );
    expect(transcriptLine(status(), PROMPT)).toBe(PROMPT);
  });

  it('says so when the device has no recogniser at all', () => {
    expect(transcriptLine(status({ supported: false }), PROMPT)).toBe(
      'This device has no speech recogniser.',
    );
  });
});

describe('confirming a command', () => {
  const casual = toneCopy('casual');
  const formal = toneCopy('formal');

  it('uses the tone the user picked', () => {
    expect(confirmationFor({ kind: 'start' }, casual)).toBe('Started timer');
    expect(confirmationFor({ kind: 'start' }, formal)).toBe('Commenced bake');
    expect(confirmationFor({ kind: 'pause' }, formal)).toBe('Suspended bake');
    expect(confirmationFor({ kind: 'reset' }, formal)).toBe('Bake reset');
  });

  it('keeps the shouted Italian in both tones', () => {
    expect(confirmationFor({ kind: 'turn' }, casual)).toBe('Gira, gira! 🍕');
    expect(confirmationFor({ kind: 'turn' }, formal)).toBe('Gira, gira! 🍕');
  });

  it('echoes a duration the way it was spoken, not the way it was stored', () => {
    const spoken = { kind: 'setDuration' as const, seconds: 180, spokenValue: 3, inMinutes: true };
    expect(confirmationFor(spoken, casual)).toBe('Set to 3 minutes');

    const one = { kind: 'setDuration' as const, seconds: 60, spokenValue: 1, inMinutes: true };
    expect(confirmationFor(one, casual)).toBe('Set to 1 minute');

    const seconds = { kind: 'setDuration' as const, seconds: 45, spokenValue: 45, inMinutes: false };
    expect(confirmationFor(seconds, casual)).toBe('Set to 45 seconds');
  });
});
