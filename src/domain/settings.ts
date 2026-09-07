/** Tweakable #1 — topping style. */
export type ToppingStyle = 'pepperoni' | 'margherita' | 'veggie';

/** Tweakable #2 — voice tone (drives all status copy and hint chips). */
export type VoiceTone = 'casual' | 'formal';

/** Tweakable #3 — oven preset (drives the three duration chips). */
export type OvenPreset = 'home' | 'woodFired';

export const OVEN_PRESETS: Record<OvenPreset, readonly number[]> = {
  home: [60, 90, 720],
  woodFired: [45, 60, 90],
};

/** "60s", "90s", "12 min" — matches the labels in the prototype. */
export function presetLabel(seconds: number): string {
  return seconds >= 120 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds}s`;
}

export type AppSettings = {
  toppingStyle: ToppingStyle;
  voiceTone: VoiceTone;
  ovenPreset: OvenPreset;
};

export const DEFAULT_SETTINGS: AppSettings = {
  toppingStyle: 'pepperoni',
  voiceTone: 'casual',
  ovenPreset: 'home',
};
