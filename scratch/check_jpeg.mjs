import fs from "fs";

// Read JPEG header to get width and height
const buf = fs.readFileSync("public/textures/door/door_master_diff.jpg");
let offset = 2;
let width = 0;
let height = 0;

while (offset < buf.length) {
  if (buf[offset] !== 0xff) {
    offset++;
    continue;
  }
  const marker = buf[offset + 1];
  if (marker === 0xc0 || marker === 0xc2) {
    height = buf.readUInt16BE(offset + 5);
    width = buf.readUInt16BE(offset + 7);
    break;
  }
  const len = buf.readUInt16BE(offset + 2);
  offset += 2 + len;
}

console.log(`door_master_diff.jpg dimensions: ${width}x${height}`);
