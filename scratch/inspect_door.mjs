import fs from "fs";
import path from "path";

// Let's check image dimensions and metadata using sharp or canvas if installed, or read PNG header
const buf = fs.readFileSync("scratch/reference_door.png");
// PNG dimensions at byte 16: width (4 bytes big endian), height (4 bytes big endian)
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
console.log(`reference_door.png size: ${width}x${height}`);

const masterBuf = fs.readFileSync("public/textures/door/door_master_diff.jpg");
console.log(`door_master_diff.jpg byte length: ${masterBuf.length}`);
