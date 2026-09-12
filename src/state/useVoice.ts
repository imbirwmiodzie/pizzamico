import {
  ExpoSpeechRecognitionModule,
  isRecognitionAvailable,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { VoiceTone } from '../domain/settings';
import { toneCopy } from '../domain/toneCopy';
import type { VoiceStatus } from '../domain/voiceStatus';
import { confirmationFor } from '../domain/voiceStatus';
import type { VoiceCommand } from '../domain/voiceCommands';
import { parseVoiceCommand } from '../domain/voiceCommands';
import { bakeActions } from './bakeStore';

/**
 * The microphone, and the loop that keeps it open.
 *
 * `continuous: true` only works on Android 13 and up, so the recogniser is
 * restarted whenever it ends while we still want to be listening. Some errors
 * mean "nothing was said, listen again" and some mean "stop"; getting that
 * split wrong is the difference between a mic that stays open and one that
 * dies silently after the first pause.
 *
 * Parsing lives in `domain/voiceCommands`, which is pure and tested. This hook
 * only decides when to listen and where the result goes.
 */

/** How long a "✓ Started timer" stays on screen (handoff). */
const CONFIRMATION_MS = 3000;
/** A beat before re-arming, so a recogniser that fails instantly can't spin. */
const RESTART_MS = 250;

/** Nothing was heard. Perfectly normal in a kitchen — just listen again. */
const RECOVERABLE: ReadonlySet<ExpoSpeechRecognitionErrorCode> = new Set([
  'no-speech',
  'speech-timeout',
  'busy',
  'client',
]);

const PROBLEM_COPY: Partial<Record<ExpoSpeechRecognitionErrorCode, string>> = {
  'not-allowed': 'Microphone permission is off — turn it on in Settings.',
  'service-not-allowed': 'No speech recogniser is available on this device.',
  'language-not-supported': 'This device has no English speech model installed.',
  'audio-capture': "Couldn't reach the microphone.",
  network: 'Speech recognition needs a network connection right now.',
};

export function useVoice(tone: VoiceTone): VoiceStatus & {
  toggle: () => void;
  stop: () => void;
} {
  const supported = isRecognitionAvailable();

  const [listening, setListening] = useState(false);
  const [hearing, setHearing] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  /** What the user asked for, as opposed to what the recogniser is doing. */
  const wanted = useRef(false);
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The copy changes with the tone setting mid-session; events read it here so
  // the listeners never need re-registering.
  const copy = useRef(toneCopy(tone));
  copy.current = toneCopy(tone);

  const confirm = useCallback((text: string) => {
    setConfirmation(text);
    if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
    confirmationTimer.current = setTimeout(() => setConfirmation(null), CONFIRMATION_MS);
  }, []);

  const listen = useCallback(() => {
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      // The words the app actually cares about, so the recogniser leans
      // towards them over similar-sounding chatter.
      contextualStrings: ['gira', 'minutes', 'seconds', 'start', 'pause', 'reset'],
    });
  }, []);

  const stop = useCallback(() => {
    wanted.current = false;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = null;
    ExpoSpeechRecognitionModule.stop();
    setListening(false);
    setHearing(null);
  }, []);

  const toggle = useCallback(() => {
    if (!supported) {
      setProblem('This device has no speech recogniser.');
      return;
    }
    if (wanted.current) {
      stop();
      return;
    }
    wanted.current = true;
    setProblem(null);
    ExpoSpeechRecognitionModule.requestPermissionsAsync()
      .then((permission) => {
        if (!wanted.current) return;
        if (!permission.granted) {
          wanted.current = false;
          setProblem(PROBLEM_COPY['not-allowed'] ?? null);
          return;
        }
        listen();
      })
      .catch(() => {
        wanted.current = false;
        setProblem("Couldn't start listening.");
      });
  }, [listen, stop, supported]);

  useSpeechRecognitionEvent('start', () => setListening(true));

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript?.trim() ?? '';
    if (!event.isFinal) {
      setHearing(transcript.length > 0 ? transcript : null);
      return;
    }

    setHearing(null);
    const command = parseVoiceCommand(transcript);
    if (!command) return;
    run(command);
    confirm(confirmationFor(command, copy.current));
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (RECOVERABLE.has(event.error)) return; // `end` re-arms us.
    if (event.error === 'aborted') return; // We asked for this.
    wanted.current = false;
    setProblem(PROBLEM_COPY[event.error] ?? 'Speech recognition stopped unexpectedly.');
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    setHearing(null);
    if (!wanted.current) return;
    // Android below 13 ignores `continuous`, so the session ends after every
    // utterance. Re-arm rather than making the user tap again.
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(() => {
      if (wanted.current) listen();
    }, RESTART_MS);
  });

  useEffect(
    () => () => {
      wanted.current = false;
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
      if (restartTimer.current) clearTimeout(restartTimer.current);
      ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  return { supported, listening, hearing, confirmation, problem, toggle, stop };
}

/** Hands a recognised command to the one live bake. */
function run(command: VoiceCommand): void {
  switch (command.kind) {
    case 'start':
      bakeActions.start();
      return;
    case 'pause':
      bakeActions.pause();
      return;
    case 'reset':
      bakeActions.reset();
      return;
    case 'turn':
      bakeActions.requestTurn();
      return;
    case 'setDuration':
      bakeActions.setDuration(command.seconds);
  }
}
