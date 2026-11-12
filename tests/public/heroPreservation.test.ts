import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const baseline = {
  "src/components/home/hero/HeroScene.tsx":
    "1ee698fd59ba170f6ed089ffb37aee53f589010701c8ce17014d749ae7908383",
  "src/components/home/HomePreloader.tsx":
    "04a2064e516db05bc29771b80a6f9c30aa22da259fde7baea17d990a3b0b4c08",
};
test("original frame renderer and entrance preloader remain byte-for-byte identical", () => {
  for (const [file, hash] of Object.entries(baseline))
    assert.equal(
      createHash("sha256").update(readFileSync(file)).digest("hex"),
      hash,
      file,
    );
});
test("hero image scroll controller remains unchanged while editorial text may evolve",()=>{const hero=readFileSync("src/components/home/Hero.tsx","utf8");const controller=hero.slice(hero.indexOf("export default function Hero"),hero.indexOf("\n  return ("));assert.equal(createHash("sha256").update(controller).digest("hex"),"9e9e17b1341b366815bdafbd1d87c4d24436007d007638ccc6b8126ba916a48f");const world=readFileSync("src/components/world/LivingWorld.tsx","utf8");assert.ok(!world.includes("<Arrival"));assert.ok(!world.includes("<Intelligence"));assert.ok(!world.includes("<AtlasSystem"));});
test("all original 287 hero frame assets remain available", () => {
  for (let i = 0; i < 287; i++)
    assert.ok(
      readFileSync(`public/images/door-sequence/frame_${i}.webp`).byteLength >
        0,
    );
});
