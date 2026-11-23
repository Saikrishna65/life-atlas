import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { lazyStyles, staticBytes } from "../../scripts/mobile-assets.mjs";

test("lazy entry CSS resolves relative to the importing chunk, including nested chunks", () => {
  const output = path.resolve("mobile-dist");
  const outputs = {
    "mobile-dist/chunks/gallery.js": {
      cssBundle: "mobile-dist/chunks/gallery.css",
    },
  };
  const source =
    'const gallery=()=>import("./gallery.js");const music=()=>import("./music.js");';
  const transformed = lazyStyles(
    source,
    "mobile-dist/chunks/App.js",
    outputs,
    output,
  );
  assert.ok(transformed.includes('from"../mobile-styles.js"'));
  assert.ok(transformed.includes('__atlasLoadStyles(["/chunks/gallery.css"])'));
  assert.ok(transformed.includes('const music=()=>import("./music.js")'));
  assert.ok(transformed.includes(".then(([module])=>module)"));
});

test("startup size follows static dependencies once without including lazy screens", () => {
  const outputs = {
    "app.js": {
      bytes: 10,
      imports: [
        { path: "shared.js", kind: "import-statement" },
        { path: "gallery.js", kind: "dynamic-import" },
      ],
    },
    "home.js": {
      bytes: 20,
      imports: [{ path: "shared.js", kind: "import-statement" }],
    },
    "shared.js": { bytes: 30 },
    "gallery.js": { bytes: 900 },
  };
  assert.equal(staticBytes(outputs, ["app.js", "home.js"]), 60);
});

test("aggregate CSS coverage prevents loading duplicate page styles", () => {
  const outputs = {
    "mobile-dist/page.js": { cssBundle: "mobile-dist/page.css" },
    "mobile-dist/page.css": { inputs: { "shared.css": {}, "page.css": {} } },
  };
  const source = 'import("./page.js")';
  const included = { "shared.css": {}, "page.css": {}, "other.css": {} };
  assert.equal(
    lazyStyles(
      source,
      "mobile-dist/app.js",
      outputs,
      path.resolve("mobile-dist"),
      included,
    ),
    source,
  );
  assert.ok(
    lazyStyles(
      source,
      "mobile-dist/app.js",
      outputs,
      path.resolve("mobile-dist"),
      { "shared.css": {} },
    ).includes("__atlasLoadStyles"),
  );
});
