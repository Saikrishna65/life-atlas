import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const baseline = {
  "src/components/home/Hero.tsx":
    "f1f729d17ddab5fb33217ce2b4b521b32a9d7ba672464a8024d60e2044a881f3",
  "src/components/home/hero/HeroScene.tsx":
    "1ee698fd59ba170f6ed089ffb37aee53f589010701c8ce17014d749ae7908383",
  "src/components/home/HomePreloader.tsx":
    "04a2064e516db05bc29771b80a6f9c30aa22da259fde7baea17d990a3b0b4c08",
};
test("original hero, frame renderer and entrance preloader remain byte-for-byte identical", () => {
  for (const [file, hash] of Object.entries(baseline))
    assert.equal(
      createHash("sha256").update(readFileSync(file)).digest("hex"),
      hash,
      file,
    );
});
test("Arrival begins with the exact original final frame after the unchanged hero", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  assert.ok(page.indexOf("<Hero") < page.indexOf("<LivingWorld"));
  assert.ok(
    readFileSync("src/components/world/world.css", "utf8").includes(
      "/images/door-sequence/frame_286.webp",
    ),
  );
});
test("all original 287 hero frame assets remain available", () => {
  for (let i = 0; i < 287; i++)
    assert.ok(
      readFileSync(`public/images/door-sequence/frame_${i}.webp`).byteLength >
        0,
    );
});
