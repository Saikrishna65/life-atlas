import { test } from "node:test";
import assert from "node:assert/strict";
import { embedUrl, playerFailure } from "../../src/lib/video/player";
import { readPlaybackPreferences } from "../../src/lib/video/playback-preferences";
test("embed stays on the fixed no-cookie host, escapes origin and starts only when configured", () => {
  const url = new URL(embedUrl("dQw4w9WgXcQ", "https://atlas.example", false, 42.9));
  assert.equal(url.origin, "https://www.youtube-nocookie.com");
  assert.equal(url.pathname, "/embed/dQw4w9WgXcQ");
  assert.equal(url.searchParams.get("origin"), "https://atlas.example");
  assert.equal(url.searchParams.get("autoplay"), "0");
  assert.equal(url.searchParams.get("enablejsapi"), "1");
  assert.equal(url.searchParams.get("start"), "42");
  assert.equal(new URL(embedUrl("dQw4w9WgXcQ", "https://atlas.example", true, NaN)).searchParams.get("start"), "0");
  for (const id of ["../bad/path", "https://example.com", "", "bad?param=1"]) assert.throws(() => embedUrl(id, "https://atlas.example", true));
});
test("known provider errors distinguish missing videos, blocked embeds and identity failures", () => {
  assert.match(playerFailure(100), /private/);
  assert.match(playerFailure(101), /owner/);
  assert.equal(playerFailure(101), playerFailure(150));
  assert.match(playerFailure(153), /verify/);
  assert.match(playerFailure(5), /reloading/);
  assert.match(playerFailure(2), /link/);
});
test("playback preferences allow only booleans and never import queries, history or endpoints", () => {
  for (const invalid of [null, [], "data", 1, { autoplay: "false", related: 0 }]) assert.deepEqual(readPlaybackPreferences(invalid), { autoplay: true, related: true });
  assert.deepEqual(readPlaybackPreferences({ autoplay: false, related: false, history: ["video"], endpoint: "https://example.com" }), { autoplay: false, related: false });
});
