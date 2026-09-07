/**
 * The "Classical" design system, copied verbatim from the handoff's
 * `styles.css` `:root` block. Do not invent values here — if the token sheet
 * changes, change these and nothing else, and never inline a hex in a
 * component.
 */
export const Tokens = {
  bg: '#f3f2f2',
  surface: '#eae9e9',
  text: '#201f1d',
  accent: '#b68235',
  accent2: '#ac803e',

  /** --color-divider: #201f1d at 16% */
  divider: 'rgba(32, 31, 29, 0.16)',

  neutral100: '#f8f4f4',
  neutral200: '#eae7e7',
  neutral300: '#d7d3d3',
  neutral500: '#9b9797',
  neutral800: '#444141',
  neutral900: '#2d2b2b',

  accent100: '#fff3e4',
  /** The big time readout and the kicker. */
  accent700: '#7d5411',
  accent800: '#5a3b0a',
} as const;

/** Spacing scale from the token sheet. */
export const Space = {
  s1: 4.6,
  s2: 9.2,
  s3: 13.8,
  s4: 18.4,
  s6: 27.6,
  s8: 36.8,
} as const;

export const Radius = {
  sm: 2,
  md: 4,
  lg: 7,
} as const;

/**
 * Pizza illustration ramps — the raw → baked interpolation endpoints.
 * Kept as RGB triples because the drawing code interpolates them channel by
 * channel, exactly as the prototype does.
 */
export const PizzaRamp = {
  rawCrust: [244, 231, 205],
  bakedCrust: [193, 126, 55],
  rawCheese: [252, 246, 222],
  bakedCheese: [231, 176, 72],
  rawPepperoni: [216, 128, 118],
  bakedPepperoni: [148, 46, 34],
  rawVeggie: [176, 214, 150],
  bakedVeggie: [96, 138, 68],
  fleck: '#6b4a2b',
  char: '#5c3a1e',
} as const;

/** Flame gradient stops, bottom → top (CSS `linear-gradient(to top, …)`). */
export const Flame = {
  deep: '#d6360f',
  orange: '#ff6a1a',
  amber: '#ffa233',
  pale: '#ffd75f',
} as const;

/** Channel-wise interpolation between two RGB triples, as the prototype does. */
export function mixRgb(
  from: readonly [number, number, number] | readonly number[],
  to: readonly [number, number, number] | readonly number[],
  t: number,
): string {
  const clamped = Math.min(1, Math.max(0, t));
  const channel = (i: number) =>
    Math.round((from[i] ?? 0) + ((to[i] ?? 0) - (from[i] ?? 0)) * clamped);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}
