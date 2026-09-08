/**
 * Draws the app's two PNGs.
 *
 *   assets/icon.png         launcher icon — opaque, on the paper background
 *   assets/splash-icon.png  splash logo — the same pie on transparency
 *
 * The handoff ships no icon assets, so both are the pizza the app itself
 * draws, in the same tokens: the fully-baked end of the crust and cheese
 * ramps. Generating them keeps the artwork honest — change a token, re-run
 * this, and both follow.
 *
 * The splash logo is transparent rather than a copy of the icon so it stays
 * correct if the splash background is ever changed; a baked-in background
 * would show up as a square.
 *
 *   node scripts/make-icon.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

/** Supersample, then box-filter down: cheap antialiasing without a canvas. */
const SS = 4;

const BG = [243, 242, 242];
const CRUST = [193, 126, 55];
const CHEESE = [231, 176, 72];
const PEPPERONI = [148, 46, 34];
const CHAR = [92, 58, 30];

// The illustration's own 200-unit viewbox, so the artwork and the app agree.
const TOPPINGS = [
  [76, 78],
  [122, 72],
  [100, 108],
  [68, 122],
  [130, 126],
  [96, 148],
];
const CHAR_SPOTS = [
  [40, 100, 4],
  [160, 95, 3.5],
  [100, 22, 4],
  [100, 178, 3.5],
];

/**
 * Renders the pie into an RGBA buffer at `size * SS`.
 *
 * `pieR` is the pie's radius as a fraction of the canvas — the launcher icon
 * keeps it small enough to survive Android's adaptive-icon crop, the splash
 * logo does not have to.
 */
function render({ size, pieR, transparent }) {
  const w = size * SS;
  const centre = w / 2;
  const scale = (w * pieR * 2) / 200; // viewbox units → supersampled pixels
  const buf = new Uint8Array(w * w * 4);

  const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  const unitX = (x) => centre + (x - 100) * scale;
  const unitY = (y) => centre + (y - 100) * scale;

  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      let colour = BG;
      let alpha = transparent ? 0 : 255;

      if (inCircle(x, y, centre, centre, 96 * scale)) {
        colour = CRUST;
        alpha = 255;
      }
      if (inCircle(x, y, centre, centre, 80 * scale)) colour = CHEESE;
      for (const [tx, ty] of TOPPINGS) {
        if (inCircle(x, y, unitX(tx), unitY(ty), 8.5 * scale)) colour = PEPPERONI;
      }
      for (const [cx, cy, r] of CHAR_SPOTS) {
        if (inCircle(x, y, unitX(cx), unitY(cy), r * scale)) colour = CHAR;
      }

      const i = (y * w + x) * 4;
      buf[i] = colour[0];
      buf[i + 1] = colour[1];
      buf[i + 2] = colour[2];
      buf[i + 3] = alpha;
    }
  }
  return buf;
}

/** Down-samples and lays the rows out as PNG scanlines (filter byte 0 each). */
function scanlines(big, size, channels) {
  const w = size * SS;
  const stride = 1 + size * channels;
  const raw = Buffer.alloc(size * stride);

  for (let y = 0; y < size; y++) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * w + (x * SS + sx)) * 4;
          for (let c = 0; c < 4; c++) acc[c] += big[i + c];
        }
      }
      const n = SS * SS;
      const at = row + 1 + x * channels;
      for (let c = 0; c < channels; c++) raw[at + c] = Math.round(acc[c] / n);
    }
  }
  return raw;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function writePng(name, { size, pieR, transparent }) {
  const channels = transparent ? 4 : 3;
  const raw = scanlines(render({ size, pieR, transparent }), size, channels);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = transparent ? 6 : 2; // truecolour with / without alpha

  writeFileSync(
    new URL(`../assets/${name}`, import.meta.url),
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
  console.log(`assets/${name} — ${size}×${size}${transparent ? ' (transparent)' : ''}`);
}

// Android's adaptive icon crops hard, so the pie stays inside the safe circle.
writePng('icon.png', { size: 1024, pieR: 0.3, transparent: false });
// Nothing crops the splash logo, so it can fill its box.
writePng('splash-icon.png', { size: 512, pieR: 0.45, transparent: true });
