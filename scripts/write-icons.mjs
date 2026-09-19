/**
 * 最小 PNG を zlib だけで書く（追加パッケージなし）。
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BG = [0x0b, 0x12, 0x20];
const FELT = [0x1f, 0xa3, 0x7a];
const INK = [0xe8, 0xed, 0xf7];

function crcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC = crcTable();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    const idx = (c ^ b) & 0xff;
    c = (CRC[idx] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  const crcBytes = out.subarray(4, 8 + data.length);
  view.setUint32(8 + data.length, crc32(crcBytes));
  return out;
}

function png(size) {
  const stride = 1 + size * 3;
  const raw = new Uint8Array(stride * size);
  const cx = (size - (size % 2)) / 2;
  const cy = cx;
  const outer = (size * 42 - (size * 42) % 100) / 100;
  const inner = (size * 32 - (size * 32) % 100) / 100;
  const pip = size < 80 ? 2 : (size * 4 - (size * 4) % 100) / 100;
  for (let y = 0; y < size; y++) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      let r = BG[0];
      let g = BG[1];
      let b = BG[2];
      if (d2 <= outer * outer && d2 >= inner * inner) {
        r = FELT[0];
        g = FELT[1];
        b = FELT[2];
      } else if (d2 < inner * inner) {
        r = INK[0];
        g = INK[1];
        b = INK[2];
      }
      const i = row + 1 + x * 3;
      raw[i] = r ?? 0;
      raw[i + 1] = g ?? 0;
      raw[i + 2] = b ?? 0;
    }
  }
  const pips = [
    [cx, cy - (inner - (inner % 3)) / 2],
    [cx, cy + (inner - (inner % 3)) / 2],
    [cx - (inner - (inner % 3)) / 2, cy],
    [cx + (inner - (inner % 3)) / 2, cy],
  ];
  for (const [px, py] of pips) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - px;
        const dy = y - py;
        if (dx * dx + dy * dy <= pip * pip) {
          const i = y * stride + 1 + x * 3;
          raw[i] = FELT[0];
          raw[i + 1] = FELT[1];
          raw[i + 2] = FELT[2];
        }
      }
    }
  }
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, size);
  ihdrView.setUint32(4, size);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array())]);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'icon-192.png'), png(192));
writeFileSync(join(dir, 'icon-512.png'), png(512));
writeFileSync(join(dir, 'apple-touch-icon.png'), png(180));
console.log('wrote public/icon-192.png public/icon-512.png public/apple-touch-icon.png');
