const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function createPng(size, filename) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.42;
  const rows = [];

  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        const t = Math.max(0, Math.min(1, (dx + dy) / (size * 0.8) + 0.5));
        const r = Math.round(255 * (1 - t * 0.3));
        const g = Math.round(107 + t * 50);
        const b = Math.round(53 + t * 100);
        row.push(r, g, b, 255);
      } else if (dist <= radius + 2) {
        const alpha = Math.round(255 * (1 - (dist - radius) / 2));
        row.push(255, 107, 53, alpha);
      } else {
        row.push(0, 0, 0, 0);
      }
    }
    rows.push(Buffer.from(row));
  }

  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    const crcData = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(crcData) >>> 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filename, png);
  console.log(`Created ${filename}`);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

createPng(192, "icon-192.png");
createPng(512, "icon-512.png");

const assetsDir = "assets";
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);
createPng(256, path.join(assetsDir, "icon.png"));
