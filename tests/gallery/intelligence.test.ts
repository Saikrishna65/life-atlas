import { test } from "node:test";
import assert from "node:assert/strict";
import {
  intelligenceStateText,
  defaultIntelligenceSettings,
  type GalleryIntelligenceStatus,
} from "../../src/lib/gallery/intelligence";
const status: GalleryIntelligenceStatus = {
  ...defaultIntelligenceSettings,
  enabled: false,
  state: "off",
  indexed: 0,
  scanned: 0,
  failed: 0,
  error: "",
  updatedAt: 0,
  modelReady: false,
  modelBytes: 153621508,
};
test("waiting and failures explain what actually prevents indexing", () => {
  assert.match(
    intelligenceStateText({ ...status, state: "waiting" }),
    /charging/,
  );
  assert.doesNotMatch(
    intelligenceStateText({ ...status, state: "waiting", chargingOnly: false }),
    /charging/,
  );
  assert.match(
    intelligenceStateText({ ...status, state: "error", error: "permission" }),
    /permissions/,
  );
  assert.match(
    intelligenceStateText({ ...status, state: "error", error: "download" }),
    /connection/,
  );
  assert.match(
    intelligenceStateText({ ...status, state: "paused" }),
    /index is kept/,
  );
});
