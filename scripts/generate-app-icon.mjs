#!/usr/bin/env node
/**
 * Generates the iOS app icon from design tokens — no image tooling required.
 *
 * The handoff supplied no logo ("wordmark set in display font wherever a mark
 * would go"), so this uses the brand's own cross-mark motif in gold on the Deep
 * Mist canvas gradient. Provisional: replace when a real mark exists.
 *
 *   node scripts/generate-app-icon.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// --- tokens -----------------------------------------------------------------
const GRADIENT_FROM = [0x16, 0x14, 0x26]; // #161426, Deep Mist surface start
const GRADIENT_TO = [0x0a, 0x09, 0x12]; //   #0a0912, Deep Mist surface end
const GOLD = [0xf5, 0xc5, 0x18]; //          --gold-500

// Cross-mark geometry, as fractions of the icon edge.
const ARM = 0.3;
const THICKNESS = 0.092;

// --- raster -----------------------------------------------------------------
function smooth(a, b, x) {
  if (x <= a) return 0;
  if (x >= b) return 1;
  const t = (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

/** Antialiased coverage of one 45-degree bar in its own local frame. */
function barCoverage(u, v, arm, half) {
  const edge = 1.2;
  const across = 1 - smooth(half - edge, half + edge, Math.abs(v));
  const cap = 1 - smooth(arm - edge, arm + edge, Math.abs(u));
  return Math.min(across, cap);
}

/** Renders the icon at `size` and returns raw RGB pixels. */
function render(size) {
  const px = Buffer.alloc(size * size * 3);
  const rad = ((155 - 90) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const denom = size * (cos + sin);
  const c = size / 2;
  const arm = ARM * size;
  const half = (THICKNESS * size) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 155deg linear gradient, matching --surface-mist.
      const t = Math.min(1, Math.max(0, (x * cos + y * sin) / denom));
      const bg = [
        GRADIENT_FROM[0] + (GRADIENT_TO[0] - GRADIENT_FROM[0]) * t,
        GRADIENT_FROM[1] + (GRADIENT_TO[1] - GRADIENT_FROM[1]) * t,
        GRADIENT_FROM[2] + (GRADIENT_TO[2] - GRADIENT_FROM[2]) * t,
      ];

      const dx = x - c;
      const dy = y - c;
      const u = (dx + dy) * Math.SQRT1_2;
      const v = (dy - dx) * Math.SQRT1_2;
      const cov = Math.max(barCoverage(u, v, arm, half), barCoverage(v, u, arm, half));

      const i = (y * size + x) * 3;
      px[i] = Math.round(bg[0] + (GOLD[0] - bg[0]) * cov);
      px[i + 1] = Math.round(bg[1] + (GOLD[1] - bg[1]) * cov);
      px[i + 2] = Math.round(bg[2] + (GOLD[2] - bg[2]) * cov);
    }
  }
  return px;
}

// --- PNG encoding -----------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour, no alpha — iOS icons must be opaque
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    px.copy(raw, y * stride + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- outputs ----------------------------------------------------------------
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const TARGETS = [
  // iOS native shell
  [1024, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"],
  // PWA / Home Screen
  [180, "public/apple-touch-icon.png"],
  [192, "public/icon-192.png"],
  [512, "public/icon-512.png"],
  [32, "public/favicon.png"],
];

for (const [size, rel] of TARGETS) {
  const png = encodePng(size, render(size));
  const out = path.join(root, rel);
  writeFileSync(out, png);
  console.log(`${rel.padEnd(58)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`);
}
