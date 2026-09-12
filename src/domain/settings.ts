/** Tweakable #1 — topping style. */
export type ToppingStyle = 'pepperoni' | 'margherita' | 'veggie';

/** Tweakable #2 — voice tone (drives all status copy and hint chips). */
export type VoiceTone = 'casual' | 'formal';

/** Tweakable #3 — oven preset (drives the three duration chips). */
export type OvenPreset = 'home' | 'woodFired';

export const OVEN_PRESETS: Record<OvenPreset, readonly number[]> = {
  home: [60, 90, 1800],
  // Every oven needs preheating, and a wood-fired one more than most, so the
  // long preset is on both rather than being a quirk of the home oven.
  woodFired: [45, 60, 90, 1800],
};

/**
 * A duration this long is not a bake — nothing survives half an hour in a
 * pizza oven. It is the oven coming up to temperature, which is a different
 * thing to watch and a different thing to be told when it finishes.
 */
export const PREHEAT_FROM_SECONDS = 1800;

export function isPreheat(seconds: number): boolean {
  return seconds >= PREHEAT_FROM_SECONDS;
}

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
