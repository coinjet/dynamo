import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createSolidPng(width, height, r, g, b, a = 255) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA (6)
  ihdrData[10] = 0; // Compression method: 0
  ihdrData[11] = 0; // Filter method: 0
  ihdrData[12] = 0; // Interlace method: 0

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines with RGBA
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);

  // Center bolt coordinate approximate bounds
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.44;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Gradient background
      let pr = Math.round(18 + (x / width) * 10);
      let pg = Math.round(22 + (y / height) * 12);
      let pb = Math.round(28 + (y / height) * 10);

      // Gold / Amber accent in center circle
      if (dist < radius * 0.7 && Math.abs(dx * 0.7 + dy * 1.2) < radius * 0.4) {
        pr = 245; // #F59E0B
        pg = 158;
        pb = 11;
      } else if (Math.abs(dist - radius * 0.8) < 3) {
        pr = 217;
        pg = 119;
        pb = 6;
      }

      rawData[pxOffset] = pr;
      rawData[pxOffset + 1] = pg;
      rawData[pxOffset + 2] = pb;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// Standard CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createSolidPng(192, 192, 18, 22, 28));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createSolidPng(512, 512, 18, 22, 28));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createSolidPng(512, 512, 18, 22, 28));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createSolidPng(180, 180, 18, 22, 28));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createSolidPng(32, 32, 245, 158, 11));

console.log('PNG PWA assets generated successfully!');
