const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create PNG buffer generator
function createTennisPng(size, isMaskable = false) {
  const width = size;
  const height = size;

  // Raw RGBA buffer
  const rawData = Buffer.alloc(height * (1 + width * 4));

  const cx = width / 2;
  const cy = height / 2;
  const radius = isMaskable ? width * 0.36 : width * 0.42;
  const cornerRadius = isMaskable ? 0 : width * 0.22;

  let pos = 0;
  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      // Distance from center
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background gradient: dark slate to dark emerald
      const tBg = (x + y) / (width + height);
      let r = Math.round(15 * (1 - tBg) + 4 * tBg);
      let g = Math.round(23 * (1 - tBg) + 60 * tBg);
      let b = Math.round(42 * (1 - tBg) + 45 * tBg);
      let a = 255;

      // Check rounded corner for non-maskable
      if (!isMaskable) {
        const cornerX = Math.abs(x - cx) - (cx - cornerRadius);
        const cornerY = Math.abs(y - cy) - (cy - cornerRadius);
        if (cornerX > 0 && cornerY > 0) {
          const cornerDist = Math.sqrt(cornerX * cornerX + cornerY * cornerY);
          if (cornerDist > cornerRadius) {
            a = 0;
          }
        }
      }

      // Tennis Ball Drawing
      if (dist <= radius) {
        // Shading inside ball
        const lightDx = x - (cx - radius * 0.35);
        const lightDy = y - (cy - radius * 0.35);
        const lightDist = Math.sqrt(lightDx * lightDx + lightDy * lightDy) / (radius * 1.6);
        const lightFactor = Math.max(0, Math.min(1, 1 - lightDist));

        // Tennis ball yellow-green: #d9f99d (#d9, #f9, #9d) to #65a30d (#65, #a3, #0d)
        r = Math.round(101 + lightFactor * 116);
        g = Math.round(163 + lightFactor * 86);
        b = Math.round(13 + lightFactor * 144);

        // Seam curves (two arcs)
        const seam1Dx = x - (cx - radius * 0.55);
        const seam2Dx = x - (cx + radius * 0.55);
        const seamWidth = Math.max(2, radius * 0.08);

        const distSeam1 = Math.abs(Math.sqrt(seam1Dx * seam1Dx + dy * dy * 0.6) - radius * 0.78);
        const distSeam2 = Math.abs(Math.sqrt(seam2Dx * seam2Dx + dy * dy * 0.6) - radius * 0.78);

        if (distSeam1 < seamWidth || distSeam2 < seamWidth) {
          // White seam
          r = 255;
          g = 255;
          b = 255;
        } else if (distSeam1 < seamWidth + 1.5 || distSeam2 < seamWidth + 1.5) {
          // Seam anti-aliasing blend
          r = Math.round((r + 255) / 2);
          g = Math.round((g + 255) / 2);
          b = Math.round((b + 255) / 2);
        }
      } else if (dist <= radius + Math.max(2, size * 0.015)) {
        // Ball border glow
        const borderFactor = 1 - (dist - radius) / Math.max(2, size * 0.015);
        r = Math.round(r * (1 - borderFactor) + 56 * borderFactor);
        g = Math.round(g * (1 - borderFactor) + 189 * borderFactor);
        b = Math.round(b * (1 - borderFactor) + 248 * borderFactor);
      }

      rawData[pos++] = r;
      rawData[pos++] = g;
      rawData[pos++] = b;
      rawData[pos++] = a;
    }
  }

  // Deflate rawData
  const deflated = zlib.deflateSync(rawData);

  // PNG structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const crcPayload = Buffer.concat([typeBuf, data]);

    const crc = Buffer.alloc(4);
    crc.writeInt32BE(crc32(crcPayload), 0);

    return Buffer.concat([len, typeBuf, data, crc]);
  }

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // Bit depth: 8
  ihdrData.writeUInt8(6, 9); // Color type: 6 (RGBA)
  ihdrData.writeUInt8(0, 10); // Compression method: 0
  ihdrData.writeUInt8(0, 11); // Filter method: 0
  ihdrData.writeUInt8(0, 12); // Interlace method: 0

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Simple CRC32 table & function
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) | 0;
}

const publicDir = path.resolve(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createTennisPng(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createTennisPng(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createTennisPng(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createTennisPng(180, false));

console.log('Successfully generated PWA PNG icons!');
