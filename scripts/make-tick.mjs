/**
 * Renders the ten-second tick to
 * `modules/pizza-bake-service/android/src/main/res/raw/tick.wav`.
 *
 * It used to be synthesised on the phone, one AudioTrack per tick, as a bare
 * 880 Hz sine at 44.1kHz. That was wrong in four ways at once: a single
 * partial down where phone speakers barely respond, a peak of -17 dBFS, an
 * envelope cut off at -44 dBFS rather than taken to silence, and a sample
 * rate the device then had to resample. Rendering it here instead means the
 * sound can be designed properly once and simply played back.
 *
 *   node scripts/make-tick.mjs
 */
import { writeFileSync } from 'node:fs';

/** What Android actually runs at, so nothing has to resample. */
const RATE = 48000;
const MS = 150;
/** Fade the last of it to true silence — a truncated tail is a click. */
const RELEASE_MS = 20;
const ATTACK_MS = 3;
/** Target peak, a little under full scale. */
const PEAK = 0.89;

/**
 * Partials, and how fast each one dies. Higher ones decay first, the way a
 * struck object behaves.
 *
 * The octave leads rather than the fundamental, which puts four fifths of the
 * energy above a kilohertz. That is deliberate: a phone speaker has almost
 * nothing to say below that, so a blip built around 880 Hz is pitched exactly
 * where the hardware is deafest. Chosen by ear from three candidates.
 */
const PARTIALS = [
  { hz: 880, gain: 0.55, tau: 0.06 },
  { hz: 1760, gain: 1.0, tau: 0.05 },
  { hz: 2640, gain: 0.5, tau: 0.032 },
  { hz: 3520, gain: 0.22, tau: 0.022 },
];

const count = Math.round((RATE * MS) / 1000);
const attack = Math.round((RATE * ATTACK_MS) / 1000);
const release = Math.round((RATE * RELEASE_MS) / 1000);

const raw = new Float64Array(count);
for (let i = 0; i < count; i++) {
  const t = i / RATE;
  let v = 0;
  for (const p of PARTIALS) v += p.gain * Math.exp(-t / p.tau) * Math.sin(2 * Math.PI * p.hz * t);

  // Raised cosine in, raised cosine out: no step at either edge.
  if (i < attack) v *= 0.5 - 0.5 * Math.cos((Math.PI * i) / attack);
  const fromEnd = count - 1 - i;
  if (fromEnd < release) v *= 0.5 - 0.5 * Math.cos((Math.PI * fromEnd) / release);

  raw[i] = v;
}

let max = 0;
for (const v of raw) max = Math.max(max, Math.abs(v));
const scale = (PEAK / max) * 32767;

const pcm = Buffer.alloc(count * 2);
for (let i = 0; i < count; i++) pcm.writeInt16LE(Math.round(raw[i] * scale), i * 2);

/** Canonical 16-bit mono PCM WAV — what SoundPool wants. */
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // PCM chunk size
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28); // byte rate
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34); // bits
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

const out = new URL(
  '../modules/pizza-bake-service/android/src/main/res/raw/tick.wav',
  import.meta.url,
);
writeFileSync(out, Buffer.concat([header, pcm]));

const db = (x) => `${(20 * Math.log10(x)).toFixed(1)} dBFS`;
const above1k = PARTIALS.filter((p) => p.hz >= 1000).reduce((s, p) => s + p.gain ** 2, 0);
const total = PARTIALS.reduce((s, p) => s + p.gain ** 2, 0);
console.log(`tick.wav — ${MS}ms, ${RATE} Hz, mono 16-bit, ${44 + pcm.length} bytes`);
console.log(`  peak            ${db(PEAK)}`);
console.log(`  first / last    ${pcm.readInt16LE(0)} / ${pcm.readInt16LE(pcm.length - 2)}  (both must be 0)`);
console.log(`  partials        ${PARTIALS.length}`);
console.log(`  energy >= 1kHz  ${((above1k / total) * 100).toFixed(0)}%  (what a phone speaker can actually reproduce)`);
