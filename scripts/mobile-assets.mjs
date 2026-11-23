import path from "node:path";

export function lazyStyles(
  source,
  file,
  outputs,
  outputDirectory,
  includedCSS,
) {
  let used = false;
  const contents = source.replace(
    /\bimport\((["'])([^"']+)\1\)/g,
    (expression, _quote, relative) => {
      const target = path.resolve(path.dirname(file), relative);
      const entry = Object.entries(outputs).find(
        ([name]) => path.resolve(name) === target,
      )?.[1];
      if (!entry?.cssBundle) return expression;
      const sources = Object.keys(outputs[entry.cssBundle]?.inputs || {});
      // esbuild currently aggregates these same sources into the root CSS.
      // Skip duplicate copies only when metadata proves every source is present.
      if (
        includedCSS &&
        sources.length &&
        sources.every((source) => source in includedCSS)
      )
        return expression;
      used = true;
      const url =
        "/" +
        path
          .relative(outputDirectory, path.resolve(entry.cssBundle))
          .split(path.sep)
          .join("/");
      return `Promise.all([${expression},__atlasLoadStyles([${JSON.stringify(url)}])]).then(([module])=>module)`;
    },
  );
  if (!used) return contents;
  const relative = path
    .relative(
      path.dirname(path.resolve(file)),
      path.join(outputDirectory, "mobile-styles.js"),
    )
    .split(path.sep)
    .join("/");
  return `import{loadStyles as __atlasLoadStyles}from${JSON.stringify(relative.startsWith(".") ? relative : "./" + relative)};\n${contents}`;
}

export function staticBytes(outputs, entries) {
  const visited = new Set();
  function visit(file) {
    if (visited.has(file) || !outputs[file]) return;
    visited.add(file);
    for (const imported of outputs[file].imports || []) {
      if (imported.kind === "import-statement" && !imported.external)
        visit(imported.path);
    }
  }
  entries.forEach(visit);
  return [...visited].reduce((sum, file) => sum + outputs[file].bytes, 0);
}
