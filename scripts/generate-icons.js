
// =============================================================================
// 0xAgent — Autonomous PWA Icon Generator (zero-dependency PNG encoder)
// Renders the unified brutal-monochrome "0x" glyph (ring-zero + diagonal cross)
// with a glitch band, then packs RGBA frames into valid PNG via node:zlib.
//
// Usage:  node scripts/generate-icons.js
// Output: public/icons/{pwa-192,pwa-512,maskable-192,maskable-512,apple-touch}.png + icon.svg
// =============================================================================
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Minimal PNG encoder (RGBA, 8-bit): signature + IHDR + IDAT(deflate) + IEND
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    rgba.subarray(y * stride, (y + 1) * stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// Color / smoothing helpers
// ---------------------------------------------------------------------------
const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;
function smoothstep(e0, e1, x) {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Glyph sampler. u,v in [-1,1], center at origin. Returns [r,g,b,a].
//   S = overall glyph scale (< 1 for maskable safe zone)
// ---------------------------------------------------------------------------
function sample(u, v, size, S) {
  const aa = 1.6 / size; // anti-alias width in normalized units

  // --- Background: vertical gradient + soft vignette ---
  const t = (v + 1) / 2; // top -> bottom
  let r = lerp(9, 15, t);
  let g = lerp(9, 15, t);
  let b = lerp(13, 22, t);
  const vig = smoothstep(1.08, 0.34, Math.hypot(u, v));
  r *= 0.5 + 0.6 * vig; g *= 0.5 + 0.6 * vig; b *= 0.5 + 0.6 * vig;

  // --- Glitch band: shift glyph horizontally in a thin strip for the "torn" slice
  let gu = u;
  const bandCenter = 0.12, bandHalf = 0.045;
  if (Math.abs(v - bandCenter) < bandHalf) gu -= 0.06 * S;

  // --- Ring (digit zero) ---
  const R = 0.62 * S;
  const d = Math.hypot(gu, v) - R;
  const ringThick = 0.115 * S;
  const ring = smoothstep(ringThick + aa, -ringThick - aa, Math.abs(d));

  // --- Diagonal cross (x) clipped to the glyph disc ---
  const ct = 0.095 * S;
  const line1 = smoothstep(ct + aa, -ct - aa, Math.abs(v - gu));
  const line2 = smoothstep(ct + aa, -ct - aa, Math.abs(v + gu));
  let cross = Math.min(line1 + line2, 1);
  const discEdge = smoothstep(R * 0.96, R * 0.78, Math.hypot(gu, v));
  cross *= Math.max(discEdge, ring);

  // --- Foreground: warm-neutral light, faint top glow ---
  const fg = lerp(214, 248, clamp(0.5 - v * 0.5));
  const fr = fg, fgc = fg, fb = Math.min(255, fg + 6);
  const cover = clamp(Math.max(ring, cross));
  r = lerp(r, fr, cover); g = lerp(g, fgc, cover); b = lerp(b, fb, cover);

  // --- Inner "agent eye" core dot ---
  const coreR = Math.hypot(gu, v);
  const core = smoothstep(0.055 * S + aa, -0.02 * S, coreR) * (1 - ring * 0.4);
  r = lerp(r, fg + 8, core); g = lerp(g, fg + 8, core); b = lerp(b, fb + 8, core);

  return [r | 0, g | 0, b | 0, 255];
}

function render(size, scale) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1;
      const v = ((y + 0.5) / size) * 2 - 1;
      const [r, g, b, a] = sample(u, v, size, scale);
      const i = (y * size + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
    }
  }
  return encodePNG(size, rgba);
}

// ---------------------------------------------------------------------------
// Emit all required PWA assets (maskable shrinks glyph into the safe zone)
// ---------------------------------------------------------------------------
const targets = [
  { file: 'pwa-192.png',        size: 192, scale: 0.84 },
  { file: 'pwa-512.png',        size: 512, scale: 0.84 },
  { file: 'maskable-192.png',   size: 192, scale: 0.66 },
  { file: 'maskable-512.png',   size: 512, scale: 0.66 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.84 },
];

for (const t of targets) {
  const png = render(t.size, t.scale);
  writeFileSync(join(OUT_DIR, t.file), png);
  console.log(`[icons] wrote ${t.file} (${png.length} bytes)`);
}

// ---------------------------------------------------------------------------
// Vector source of truth (icon.svg) — matches the raster glyph for crisp reuse
// ---------------------------------------------------------------------------
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0e0e13"/>
      <stop offset="1" stop-color="#0a0a0d"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256)" stroke="#f4f4f5" fill="none">
    <!-- diagonal cross (x), clipped by the disc -->
    <clipPath id="disc"><circle r="150"/></clipPath>
    <g clip-path="url(#disc)">
      <line x1="-160" y1="-160" x2="160" y2="160" stroke-width="34"/>
      <line x1="-160" y1="160"  x2="160" y2="-160" stroke-width="34"/>
    </g>
    <!-- ring (zero) -->
    <circle r="150" stroke-width="40"/>
    <!-- agent eye core -->
    <circle r="18" fill="#f4f4f5" stroke="none"/>
  </g>
</svg>`;
writeFileSync(join(OUT_DIR, 'icon.svg'), svg);
console.log('[icons] wrote icon.svg');
console.log('[icons] done.');

