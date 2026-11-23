import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import fs from "node:fs/promises";
import path from "node:path";
import { lazyStyles, staticBytes } from "./mobile-assets.mjs";
const root = process.cwd();
const output = path.join(root, "mobile-dist");
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
const aliases = {
  "next/navigation": "navigation.tsx",
  "next/link": "link.tsx",
  "next/image": "image.tsx",
  "next/dynamic": "dynamic.tsx",
};
const result = await build({
  entryPoints: ["mobile/bootstrap.ts"],
  bundle: true,
  splitting: true,
  format: "esm",
  jsx: "automatic",
  outdir: output,
  loader: {
    ".png": "dataurl",
    ".jpg": "dataurl",
    ".svg": "dataurl",
    ".gif": "dataurl",
  },
  target: ["chrome89"],
  minify: true,
  metafile: true,
  chunkNames: "chunks/[name]-[hash]",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_OFFLINE_APP": '"true"',
    "process.env.npm_lifecycle_event": '""',
    "process.env.NEXT_PUBLIC_MOBILE_API_ORIGIN": JSON.stringify(
      process.env.NEXT_PUBLIC_MOBILE_API_ORIGIN ||
        "https://life-atlas-eight-five.vercel.app",
    ),
  },
  plugins: [
    {
      name: "mobile-adapters",
      setup(build) {
        build.onResolve(
          { filter: /^next\/(navigation|link|image|dynamic)$/ },
          (args) => ({ path: path.join(root, "mobile", aliases[args.path]) }),
        );
        build.onResolve({ filter: /^\.\/actions$/ }, (args) =>
          args.importer.replace(/\\/g, "/").endsWith("/app/admin/Studio.tsx")
            ? { path: path.join(root, "mobile/studio-storage.ts") }
            : null,
        );
        build.onLoad(
          { filter: /[/\\]src[/\\]app[/\\]globals\.css$/ },
          async (args) => {
            const css = await fs.readFile(args.path, "utf8");
            const compiler = await compile(css, {
              base: path.dirname(args.path),
              onDependency: () => {},
            });
            const scanner = new Scanner({
              sources: [
                {
                  base: path.join(root, "src"),
                  pattern: "**/*.{ts,tsx}",
                  negated: false,
                },
                {
                  base: path.join(root, "mobile"),
                  pattern: "**/*.{ts,tsx}",
                  negated: false,
                },
              ],
            });
            return {
              contents: compiler.build(scanner.scan()),
              loader: "css",
              resolveDir: path.dirname(args.path),
            };
          },
        );
      },
    },
  ],
});
// Link the compiler's aggregate CSS once. Do not install duplicate copies for
// each lazy page. If a future build emits additional sources, load those before
// resolving that lazy entry instead of leaving an unstyled screen.
const initialCSS =
  result.metafile.outputs[
    path.relative(root, path.join(output, "bootstrap.js"))
  ]?.cssBundle;
const includedCSS = initialCSS
  ? result.metafile.outputs[initialCSS]?.inputs
  : undefined;
for (const [file] of Object.entries(result.metafile.outputs).filter(([file]) =>
  file.endsWith(".js"),
)) {
  const source = await fs.readFile(file, "utf8");
  await fs.writeFile(
    file,
    lazyStyles(source, file, result.metafile.outputs, output, includedCSS),
  );
}
await fs.copyFile(
  "scripts/mobile-styles.mjs",
  path.join(output, "mobile-styles.js"),
);
const cssLinks = initialCSS
  ? `<link rel="stylesheet" href="/${path.relative(output, path.resolve(initialCSS))}">`
  : "";
const assets = Object.entries(result.metafile.outputs);
const appEntry = assets.find(
  ([, value]) => value.entryPoint === "mobile/App.tsx",
);
const homeEntry = assets.find(
  ([, value]) => value.entryPoint === "src/app/secret/page.tsx",
);
const startup = {
  cssFiles: assets.filter(([name]) => name.endsWith(".css")).length,
  allCSSBytes: assets
    .filter(([name]) => name.endsWith(".css"))
    .reduce((n, [, value]) => n + value.bytes, 0),
  initialCSSBytes: initialCSS ? result.metafile.outputs[initialCSS].bytes : 0,
  homeJSBytes: staticBytes(
    result.metafile.outputs,
    ["mobile-dist/bootstrap.js", appEntry?.[0], homeEntry?.[0]].filter(Boolean),
  ),
};
await fs.writeFile(
  path.join(output, "asset-report.json"),
  JSON.stringify({ startup, outputs: result.metafile.outputs }),
);
await fs.writeFile(
  path.join(output, "index.html"),
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#05070a"><title>Atlas</title>' +
    cssLinks +
    '<style>:root{--font-display:Georgia;--font-sans:Arial;--font-body:Arial}body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/bootstrap.js"></script></body></html>',
);
await fs.copyFile(
  path.join(output, "index.html"),
  path.join(output, "offline.html"),
);
await fs.cp("public/finance", path.join(output, "finance"), {
  recursive: true,
});
await fs.copyFile(
  "public/placeholder-image.jpg",
  path.join(output, "placeholder-image.jpg"),
);
const routes = (await fs.readdir("src/app/secret", { recursive: true })).filter(
  (p) => p.endsWith("page.tsx"),
);
if (
  Object.keys(result.metafile.inputs).some((p) =>
    /finance\/demo(?:Transactions)?\.ts$/.test(p),
  )
)
  throw new Error("Finance demo code must not be included in the APK.");
await fs.writeFile(
  path.join(output, "build-info.json"),
  JSON.stringify({
    mode: "bundled-offline",
    builtAt: new Date().toISOString(),
    screens: routes.length,
  }),
);
console.log(
  `Bundled offline app: ${Object.keys(result.metafile.outputs).length} assets`,
);
