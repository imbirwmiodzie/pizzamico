/**
 * Draws `assets/icon.png`.
 *
 * The handoff has no icon asset, so the launcher icon is the same pizza the
 * app draws, in the same tokens: the fully-baked end of the crust and cheese
 * ramps on the paper background. Generating it keeps the icon honest — change
 * a token, re-run this, and the icon follows.
 *
 *   node scripts/make-icon.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 1024;
/** Supersample, then box-filter down: cheap antialiasing without a canvas. */
const SS = 4;
/** Android's adaptive icon crops hard; the pie stays inside the safe circle. */
const PIE_R = 0.3;

const BG = [243, 242, 242];
const CRUST = [193, 126, 55];
const CHEESE = [231, 176, 72];
const PEPPERONI = [148, 46, 34];
const CHAR = [92, 58, 30];

// The illustration's own 200-unit viewbox, so the icon and the app agree.
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

const w = SIZE * SS;
const centre = w / 2;
const scale = (w * PIE_R * 2) / 200; // viewbox units → supersampled pixels
const big = new Uint8Array(w * w * 3);

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const unitX = (x) => centre + (x - 100) * scale;
const unitY = (y) => centre + (y - 100) * scale;

for (let y = 0; y < w; y++) {
  for (let x = 0; x < w; x++) {
    let colour = BG;
    if (inCircle(x, y, centre, centre, 96 * scale)) colour = CRUST;
    if (inCircle(x, y, centre, centre, 80 * scale)) colour = CHEESE;
    for (const [tx, ty] of TOPPINGS) {
      if (inCircle(x, y, unitX(tx), unitY(ty), 8.5 * scale)) colour = PEPPERONI;
    }
    for (const [cx, cy, r] of CHAR_SPOTS) {
      if (inCircle(x, y, unitX(cx), unitY(cy), r * scale)) colour = CHAR;
    }
    const i = (y * w + x) * 3;
    big[i] = colour[0];
    big[i + 1] = colour[1];
    big[i + 2] = colour[2];
  }
}

// Down-sample, and lay the rows out as PNG scanlines (filter byte 0 each).
const raw = Buffer.alloc(SIZE * (1 + SIZE * 3));
for (let y = 0; y < SIZE; y++) {
  const row = y * (1 + SIZE * 3);
  raw[row] = 0;
  for (let x = 0; x < SIZE; x++) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * w + (x * SS + sx)) * 3;
        r += big[i];
        g += big[i + 1];
        b += big[i + 2];
      }
    }
    const n = SS * SS;
    const at = row + 1 + x * 3;
    raw[at] = Math.round(r / n);
    raw[at + 1] = Math.round(g / n);
    raw[at + 2] = Math.round(b / n);
  }
}

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

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

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // truecolour
writeFileSync(
  new URL('../assets/icon.png', import.meta.url),
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);

console.log(`assets/icon.png — ${SIZE}×${SIZE}`);
