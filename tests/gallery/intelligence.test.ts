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

test("battery saver, heat and the small people download explain real waiting states", () => {
  assert.match(
    intelligenceStateText({ ...status, state: "waiting", waitReason: "heat" }),
    /cools/,
  );
  assert.match(
    intelligenceStateText({
      ...status,
      state: "waiting",
      waitReason: "battery-saver",
    }),
    /Battery Saver/,
  );
  assert.match(
    intelligenceStateText({
      ...status,
      state: "downloading",
      downloadTarget: "people",
    }),
    /people-grouping/,
  );
  assert.equal(defaultIntelligenceSettings.people, false);
  assert.equal(defaultIntelligenceSettings.chargingOnly, true);
  assert.equal(defaultIntelligenceSettings.visual, false);
});

test('low battery, memory pressure and incomplete work have honest status messages',()=>{
 assert.match(intelligenceStateText({...status,state:'waiting',waitReason:'battery'}),/20% battery/);
 assert.match(intelligenceStateText({...status,state:'waiting',waitReason:'memory'}),/needs memory/);
 assert.match(intelligenceStateText({...status,state:'ready',failed:3}),/3 photos need another try/);
 assert.equal(intelligenceStateText({...status,state:'ready',failed:0}),'Up to date');
});
