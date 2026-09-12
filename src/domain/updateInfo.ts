/**
 * What the app says about which JavaScript it is actually running.
 *
 * The native shell and the JS bundle update independently, so "have my
 * changes arrived?" is a real question with a non-obvious answer: an APK
 * carries an embedded bundle, and an over-the-air update replaces it while
 * leaving the APK alone. Only the bundle's own identity settles it.
 *
 * Pure so it can be tested; the platform values are read in the UI.
 */

export type UpdateFacts = {
  /** False in builds where expo-updates is switched off entirely. */
  enabled: boolean;
  /** True when running the bundle that shipped inside the APK. */
  embedded: boolean;
  updateId: string | null;
  /** When the running bundle was published. */
  createdAt: Date | null;
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** The first characters of an update id — enough to tell two apart by eye. */
export function shortId(id: string | null): string {
  if (!id) return '—';
  return id.replace(/-/g, '').slice(0, 8);
}

/** "9 Sep 2026, 21:14" — fixed rather than locale-dependent, so it reads the same everywhere. */
export function formatPublished(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = MONTHS[date.getMonth()] ?? '';
  return `${date.getDate()} ${month} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * One line naming the running bundle. The embedded case is called out
 * explicitly, because "no update has been applied" is exactly the state
 * someone checking this screen is trying to rule out.
 */
export function describeBundle(facts: UpdateFacts): string {
  if (!facts.enabled) return 'Updates are switched off in this build';
  if (facts.embedded || !facts.updateId) return 'Original build — no update applied';

  const published = facts.createdAt ? ` · ${formatPublished(facts.createdAt)}` : '';
  return `Update ${shortId(facts.updateId)}${published}`;
}
