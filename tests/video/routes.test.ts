import { test } from "node:test";
import assert from "node:assert/strict";
import { isVideoWebPath, videoWebHref } from "../../src/lib/video/routes";
import { isPublicPath, isPageNavigation } from "../../src/lib/public-loading/readiness";
test("standalone Video bypasses travel-media readiness without changing travel/private routes", () => {
  for (const path of ["/video", "/video/"]) {
    assert.equal(isVideoWebPath(path), true);
    assert.equal(isPublicPath(path), false);
    assert.equal(isPageNavigation(path, "https://atlas.example/trips"), false);
  }
  for (const path of [null, "/videos", "/video-extra", "/secret/video"]) assert.equal(isVideoWebPath(path), false);
  assert.equal(isPublicPath("/trips"), true);
  assert.equal(isPublicPath("/"), true);
  assert.equal(isPublicPath("/secret/video"), false);
});
test("browser links use the standalone player and packaged/native links keep the mobile route", () => {
  assert.equal(videoWebHref(false, false), "/video");
  assert.equal(videoWebHref(true, false), "/secret/video");
  assert.equal(videoWebHref(false, true), "/secret/video");
  assert.equal(videoWebHref(true, true), "/secret/video");
});
