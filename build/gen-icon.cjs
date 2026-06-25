const fs = require('fs');
const zlib = require('zlib');

const inputPngPath = process.argv[2];

const W = 256;
const H = 256;
const rgba = Buffer.alloc(W * H * 4, 0);

const setPixel = (x, y, r, g, b, a) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
};

const fillRect = (x, y, w, h, r, g, b, a) => {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      setPixel(xx, yy, r, g, b, a);
    }
  }
};

const fillCircle = (cx, cy, rad, r, g, b, a) => {
  const r2 = rad * rad;
  const minX = Math.floor(cx - rad);
  const maxX = Math.ceil(cx + rad);
  const minY = Math.floor(cy - rad);
  const maxY = Math.ceil(cy + rad);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(x, y, r, g, b, a);
    }
  }
};

const strokeCircle = (cx, cy, rad, th, r, g, b, a) => {
  const rOut = rad;
  const rIn = Math.max(0, rad - th);
  const rOut2 = rOut * rOut;
  const rIn2 = rIn * rIn;
  const minX = Math.floor(cx - rOut);
  const maxX = Math.ceil(cx + rOut);
  const minY = Math.floor(cy - rOut);
  const maxY = Math.ceil(cy + rOut);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= rOut2 && d2 >= rIn2) setPixel(x, y, r, g, b, a);
    }
  }
};

const drawLine = (x0, y0, x1, y1, th, r, g, b, a) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const half = th / 2;
  const minX = Math.floor(Math.min(x0, x1) - th);
  const maxX = Math.ceil(Math.max(x0, x1) + th);
  const minY = Math.floor(Math.min(y0, y1) - th);
  const maxY = Math.ceil(Math.max(y0, y1) + th);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const vx = x - x0;
      const vy = y - y0;
      const proj = vx * ux + vy * uy;
      const perp = Math.abs(vx * px + vy * py);
      if (proj >= 0 && proj <= len && perp <= half) setPixel(x, y, r, g, b, a);
    }
  }
};

const drawBlockText = (str, x, y, scale, r, g, b, a) => {
  const font = {
    C: ['1111', '1000', '1000', '1000', '1000', '1000', '1111'],
    S: ['1111', '1000', '1000', '1111', '0001', '0001', '1111'],
    G: ['1111', '1000', '1000', '1011', '1001', '1001', '1111'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  };
  let cx = x;
  for (const ch of str) {
    const glyph = font[ch];
    if (!glyph) {
      cx += 6 * scale;
      continue;
    }
    const gh = glyph.length;
    const gw = glyph[0].length;
    for (let yy = 0; yy < gh; yy++) {
      for (let xx = 0; xx < gw; xx++) {
        if (glyph[yy][xx] === '1') fillRect(cx + xx * scale, y + yy * scale, scale, scale, r, g, b, a);
      }
    }
    cx += (gw + 1) * scale;
  }
};

const crc32 = (buf) => {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (~c) >>> 0;
};

const chunk = (type, data) => {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, t, data, crc]);
};

const pngFromRgba = (buf, w, h) => {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[(stride + 1) * y] = 0;
    buf.copy(raw, (stride + 1) * y + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
};

let png;
if (inputPngPath) {
  png = fs.readFileSync(inputPngPath);
} else {
  const green = [11, 122, 59, 255];
  fillCircle(W / 2, H / 2, 118, green[0], green[1], green[2], green[3]);
  strokeCircle(W / 2, H / 2, 118, 10, 255, 255, 255, 255);
  strokeCircle(W / 2, H / 2, 98, 6, 255, 255, 255, 255);
  drawLine(85, 170, 175, 80, 18, 255, 255, 255, 255);
  drawLine(92, 178, 182, 88, 6, green[0], green[1], green[2], green[3]);
  drawBlockText('CSGT', 64, 112, 6, 255, 255, 255, 255);
  png = pngFromRgba(rgba, W, H);
}
const iconDir = Buffer.alloc(6);
iconDir.writeUInt16LE(0, 0);
iconDir.writeUInt16LE(1, 2);
iconDir.writeUInt16LE(1, 4);

const entry = Buffer.alloc(16);
entry[0] = 0;
entry[1] = 0;
entry[2] = 0;
entry[3] = 0;
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);

const ico = Buffer.concat([iconDir, entry, png]);
fs.writeFileSync('build/icon.ico', ico);
