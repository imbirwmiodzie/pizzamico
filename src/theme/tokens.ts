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

/**
 * Oven illustration ramps — cold → up to temperature. Same channel-wise
 * interpolation as the pizza, so the two illustrations heat the same way.
 */
export const OvenRamp = {
  coldCavity: [45, 43, 43],
  hotCavity: [126, 42, 12],
  coldCoil: [155, 151, 151],
  hotCoil: [255, 162, 51],
  /** The oven's body and its trim, from the neutral scale. */
  body: '#eae7e7',
  trim: '#9b9797',
  outline: '#2d2b2b',
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

/**
 * A second, warmer palette for the timer screen only — from a reference
 * screenshot the project owner supplied later, not the original handoff.
 * Everything else (Settings, the "Classical" tokens above) is untouched;
 * this is scoped to `TimerScreen` and the components it composes.
 */
export const Sunset = {
  bg: '#f7f1e6',
  surface: '#ffffff',
  /** The wake pill and the turn toast, once toggled/shown. */
  chipOn: '#fde3d3',
  hairline: 'rgba(44, 32, 24, 0.14)',
  text: '#2c2018',
  textMuted: '#8a7a6c',
  kicker: '#c2410c',

  /** Preset-pill gradient endpoints, mixed per pill with `mixRgb`. */
  pillFrom: [242, 163, 60],
  pillTo: [216, 74, 54],
  onPill: '#ffffff',
  selectedRing: 'rgba(255, 255, 255, 0.85)',

  /** The circular readout's disc. */
  coral: '#ef7a5c',
  redDeep: '#c8402d',
  ringTrack: 'rgba(255, 255, 255, 0.32)',
  ringActive: 'rgba(255, 255, 255, 0.92)',
  onDisc: '#fff8f4',
  onDiscMuted: 'rgba(255, 248, 244, 0.82)',

  /** The bottom transport bar. */
  navy: '#2a211c',
  navyIcon: '#f3ece3',
} as const;

/**
 * Typefaces. The handoff's "Classical" stack is a display serif for the
 * headings and the readout, and a text serif for everything you actually
 * read; `@expo-google-fonts` gives us the real ones rather than the system
 * fallback the Kotlin build had to settle for. The keys are the family names
 * `useFonts` registers, so they double as `fontFamily` values.
 *
 * Only weights the screens actually use are listed: each face is a separate
 * ~670KB file in the APK, so an unused one is dead weight, not an option.
 */
export const Fonts = {
  displaySemiBold: 'CormorantGaramond_600SemiBold',
  bodyRegular: 'Lora_400Regular',
  bodySemiBold: 'Lora_600SemiBold',
  /**
   * The countdown, and deliberately not the display serif: Cormorant's thin
   * strokes and short figures look right in a heading but are hard to read at
   * a glance from across a kitchen, which is the one job this number has.
   * Lora is already loaded, so this costs no extra font file.
   */
  readout: 'Lora_600SemiBold',
} as const;

/** The type scale, in the sizes the handoff sets. */
export const Type = {
  /** The countdown. 80px, tabular figures, accent700. */
  readout: 80,
  title: 27,
  kicker: 11,
  body: 14,
  label: 13,
  chip: 12,
} as const;
