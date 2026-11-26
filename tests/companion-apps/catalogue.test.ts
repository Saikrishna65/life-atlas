import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCompanionManifest,
  releaseAsset,
  VIDEO_SIGNER,
} from "@/lib/companion-apps/catalogue";
import { youtubeId, searchQuery } from "@/lib/video/search";
const base =
  "https://github.com/Saikrishna65/life-atlas/releases/download/atlas-video-1/";
const entry = {
  packageId: "com.lifeatlas.video",
  versionCode: 1,
  versionName: "1.0",
  bytes: 100,
  sha256: "a".repeat(64),
  signerSha256: VIDEO_SIGNER,
  url: base + "atlas-video.apk",
  sourceUrl: base + "atlas-video-source.zip",
  license: "GPL-3.0-or-later",
};
const manifest = (item = entry) => ({ schemaVersion: 1, packages: [item] });
test("first companion install is discoverable without an installed version, with source and pinned signer", () => {
  assert.equal(parseCompanionManifest(manifest())?.versionCode, 1);
  assert.equal(
    parseCompanionManifest({ schemaVersion: 1, packages: [] }),
    null,
  );
});
test("unknown packages cannot be introduced and forged or incomplete releases fail closed", () => {
  assert.equal(
    parseCompanionManifest(manifest({ ...entry, packageId: "evil" })),
    null,
  );
  for (const override of [
    { signerSha256: "b".repeat(64) },
    { url: "https://evil.com/file.apk" },
    { sha256: "bad" },
    { bytes: 0 },
    { versionCode: 0 },
    { sourceUrl: base.replace("-1/", "-2/") + "source.zip" },
    { license: "unknown" },
  ])
    assert.throws(() =>
      parseCompanionManifest(manifest({ ...entry, ...override })),
    );
  assert.throws(() =>
    parseCompanionManifest({ schemaVersion: 1, packages: [entry, entry] }),
  );
  for (const url of [
    base + "../evil",
    base + "file.apk?token=x",
    base + "file.apk#x",
    base.replace("github.com", "github.com.evil") + "file.apk",
  ])
    assert.equal(releaseAsset(url), false);
});
test("YouTube links are parsed locally without accepting arbitrary iframe destinations", () => {
  for (const input of [
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "dQw4w9WgXcQ",
  ])
    assert.equal(youtubeId(input), "dQw4w9WgXcQ");
  for (const input of [
    "javascript:alert(1)",
    "https://youtube.com.evil/watch?v=dQw4w9WgXcQ",
    "https://user@youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/notvalid",
  ])
    assert.equal(youtubeId(input), null);
  assert.equal(searchQuery("  mountains  "), "mountains");
  assert.throws(() => searchQuery("x".repeat(121)));
  assert.throws(() => searchQuery({}));
});
