import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { AppSettings, OvenPreset, ToppingStyle, VoiceTone } from '../domain/settings';
import { DEFAULT_SETTINGS, OVEN_PRESETS } from '../domain/settings';
import { bakeActions } from './bakeStore';

const STORAGE_KEY = 'pizza-timer/settings/v1';

const TOPPINGS: ToppingStyle[] = ['pepperoni', 'margherita', 'veggie'];
const TONES: VoiceTone[] = ['casual', 'formal'];
const OVENS: OvenPreset[] = ['home', 'woodFired'];

/** Anything unrecognised falls back to the default rather than throwing. */
function parse(raw: string | null): AppSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const stored = JSON.parse(raw) as Partial<AppSettings>;
    return {
      toppingStyle: TOPPINGS.includes(stored.toppingStyle as ToppingStyle)
        ? (stored.toppingStyle as ToppingStyle)
        : DEFAULT_SETTINGS.toppingStyle,
      voiceTone: TONES.includes(stored.voiceTone as VoiceTone)
        ? (stored.voiceTone as VoiceTone)
        : DEFAULT_SETTINGS.voiceTone,
      ovenPreset: OVENS.includes(stored.ovenPreset as OvenPreset)
        ? (stored.ovenPreset as OvenPreset)
        : DEFAULT_SETTINGS.ovenPreset,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * The three tweakables from the handoff, persisted on the device.
 *
 * Changing the oven also nudges the timer onto a duration that oven offers,
 * so the preset row can never show three chips with none of them selected.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        const parsed = parse(raw);
        setSettings(parsed);
        bakeActions.conformToOven(OVEN_PRESETS[parsed.ovenPreset]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      if (patch.ovenPreset) bakeActions.conformToOven(OVEN_PRESETS[patch.ovenPreset]);
      return next;
    });
  }, []);

  return { settings, loaded, update };
}
