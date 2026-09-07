import type { ToneCopy } from './toneCopy';
import { ITALIAN_LINES } from './toneCopy';
import type { VoiceCommand } from './voiceCommands';

/**
 * What the line under the microphone says, and what a recognised command is
 * called once it has run. Both are pure string rules from the handoff, so they
 * live here with the rest of the spec rather than inside the screen.
 */

export type VoiceStatus = {
  /** False when the device has no speech recogniser at all. */
  supported: boolean;
  listening: boolean;
  /** Interim words, as they arrive. */
  hearing: string | null;
  /** The last command we acted on, for a few seconds after. */
  confirmation: string | null;
  /** Why the mic isn't working, when it isn't. */
  problem: string | null;
};

/**
 * The handoff's priority order: what it is hearing right now beats what it
 * just did, which beats the bare fact that it is listening, which beats a
 * problem worth reporting, which beats the standing invitation to talk.
 */
export function transcriptLine(status: VoiceStatus, micPrompt: string): string {
  if (status.hearing) return `Hearing: “${status.hearing}”`;
  if (status.confirmation) return `✓ ${status.confirmation}`;
  if (status.listening) return 'Listening…';
  if (status.problem) return status.problem;
  if (!status.supported) return 'This device has no speech recogniser.';
  return micPrompt;
}

/** What to show after a command has been carried out. */
export function confirmationFor(command: VoiceCommand, copy: ToneCopy): string {
  switch (command.kind) {
    case 'start':
      return copy.startAnnounce;
    case 'pause':
      return copy.pauseAnnounce;
    case 'reset':
      return copy.resetAnnounce;
    case 'turn':
      return ITALIAN_LINES.turnToast;
    case 'setDuration': {
      // The number as it was spoken, not as it was stored: "three minutes"
      // confirms as 3 minutes, never as 180 seconds.
      const unit = command.inMinutes ? 'minute' : 'second';
      return `Set to ${command.spokenValue} ${command.spokenValue === 1 ? unit : `${unit}s`}`;
    }
  }
}
