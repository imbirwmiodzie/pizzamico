import { parseVoiceCommand } from '../src/domain/voiceCommands';

const duration = (seconds: number, spokenValue: number, inMinutes: boolean) => ({
  kind: 'setDuration',
  seconds,
  spokenValue,
  inMinutes,
});

describe('parsing spoken commands', () => {
  it('reads digits with a unit', () => {
    expect(parseVoiceCommand('set a timer for 3 minutes')).toEqual(duration(180, 3, true));
    expect(parseVoiceCommand('45 seconds')).toEqual(duration(45, 45, false));
    expect(parseVoiceCommand('12 min')).toEqual(duration(720, 12, true));
    expect(parseVoiceCommand('90 sec')).toEqual(duration(90, 90, false));
  });

  it('reads spelled-out numbers', () => {
    expect(parseVoiceCommand('ninety seconds')).toEqual(duration(90, 90, false));
    expect(parseVoiceCommand('forty five seconds')).toEqual(duration(45, 45, false));
    expect(parseVoiceCommand('one minute')).toEqual(duration(60, 1, true));
    expect(parseVoiceCommand('give it a minute')).toEqual(duration(60, 1, true));
  });

  it('prefers a duration over a transport word in the same phrase', () => {
    expect(parseVoiceCommand('start a 3 minute bake')).toEqual(duration(180, 3, true));
  });

  it('recognises transport words', () => {
    ['start', 'begin', 'resume', "let's go", 'Timer, commence'].forEach((phrase) => {
      expect(parseVoiceCommand(phrase)).toEqual({ kind: 'start' });
    });
    ['pause', 'stop the timer', 'hold', 'suspend bake'].forEach((phrase) => {
      expect(parseVoiceCommand(phrase)).toEqual({ kind: 'pause' });
    });
    ['reset', 'restart', 'reset bake'].forEach((phrase) => {
      expect(parseVoiceCommand(phrase)).toEqual({ kind: 'reset' });
    });
    expect(parseVoiceCommand('gira')).toEqual({ kind: 'turn' });
    expect(parseVoiceCommand('gira gira!')).toEqual({ kind: 'turn' });
  });

  it('treats "restart" as a reset, not a start', () => {
    expect(parseVoiceCommand('restart')).toEqual({ kind: 'reset' });
  });

  it('ignores case', () => {
    expect(parseVoiceCommand('START')).toEqual({ kind: 'start' });
    expect(parseVoiceCommand('TWO MINUTES')).toEqual(duration(120, 2, true));
  });

  it('ignores chatter', () => {
    expect(parseVoiceCommand('what a lovely evening')).toBeNull();
    expect(parseVoiceCommand('')).toBeNull();
    expect(parseVoiceCommand('minutes')).toBeNull();
    expect(parseVoiceCommand('zero minutes')).toBeNull();
  });

  it('rejects absurd durations rather than setting them', () => {
    expect(parseVoiceCommand('500 minutes')).toBeNull();
  });
});
