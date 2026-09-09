import type { UpdateFacts } from '../src/domain/updateInfo';
import { describeBundle, formatPublished, shortId } from '../src/domain/updateInfo';

const facts = (over: Partial<UpdateFacts> = {}): UpdateFacts => ({
  enabled: true,
  embedded: false,
  updateId: '3f9a2b1c-7d4e-4a55-9b21-0c8e5f6a1234',
  createdAt: new Date(2026, 8, 9, 21, 14),
  ...over,
});

describe('naming the running bundle', () => {
  it('names the update and when it was published', () => {
    expect(describeBundle(facts())).toBe('Update 3f9a2b1c · 9 Sep 2026, 21:14');
  });

  it('says plainly when no update has been applied', () => {
    expect(describeBundle(facts({ embedded: true }))).toBe('Original build — no update applied');
    // An update id is what proves one was applied, so its absence says the same.
    expect(describeBundle(facts({ updateId: null }))).toBe('Original build — no update applied');
  });

  it('does not pretend to know anything when updates are switched off', () => {
    expect(describeBundle(facts({ enabled: false }))).toBe(
      'Updates are switched off in this build',
    );
  });

  it('copes with an update whose publish time is unknown', () => {
    expect(describeBundle(facts({ createdAt: null }))).toBe('Update 3f9a2b1c');
  });
});

describe('the pieces', () => {
  it('shortens an id to something comparable by eye', () => {
    expect(shortId('3f9a2b1c-7d4e-4a55-9b21-0c8e5f6a1234')).toBe('3f9a2b1c');
    expect(shortId(null)).toBe('—');
  });

  it('pads the clock and never leans on the device locale', () => {
    expect(formatPublished(new Date(2026, 0, 5, 9, 7))).toBe('5 Jan 2026, 09:07');
    expect(formatPublished(new Date(2026, 11, 31, 23, 59))).toBe('31 Dec 2026, 23:59');
  });
});
