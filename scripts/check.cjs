#!/usr/bin/env node
"use strict";

/** Syntax and asset checks with Node built-ins; no build step or network required. */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const failures = [];

function collect(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(folder, entry.name);
    if (entry.isDirectory()) return collect(filename);
    return /\.(?:c?js|mjs)$/.test(entry.name) ? [filename] : [];
  });
}

const scripts = ["js", "scripts", "tests"].flatMap((folder) =>
  collect(path.join(root, folder)),
);
for (const filename of scripts) {
  const result = spawnSync(process.execPath, ["--check", filename], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failures.push(
      `${path.relative(root, filename)}: ${result.stderr || result.error?.message || "Invalid JavaScript."}`,
    );
  }
}

const htmlPath = path.join(root, "index.html");
let resourceCount = 0;
if (!fs.existsSync(htmlPath)) {
  failures.push("index.html is missing.");
} else {
  const html = fs.readFileSync(htmlPath, "utf8");
  for (const match of html.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)) {
    const tag = match[1].toLowerCase();
    for (const attribute of match[0].matchAll(
      /\b(src|href)\s*=\s*(["'])(.*?)\2/gi,
    )) {
      const value = attribute[3];
      if (!value || value.startsWith("#")) continue;
      const remote = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value);
      if (remote) {
        if (tag !== "a")
          failures.push(`Runtime resources must be local: ${value}`);
        continue;
      }
      const pathname = value.split(/[?#]/)[0];
      const filename = path.resolve(root, pathname.replace(/^\//, ""));
      const relative = path.relative(root, filename);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        failures.push(`Resource leaves the project folder: ${value}`);
      } else if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
        failures.push(`Missing local resource: ${value}`);
      } else {
        resourceCount += 1;
      }
    }
  }
  if (/@visualize|window\.openai|viz-root/.test(html)) {
    failures.push("index.html contains an embedded-host dependency.");
  }
}

const cssPath = path.join(root, "css", "styles.css");
if (!fs.existsSync(cssPath)) {
  failures.push("css/styles.css is missing.");
} else {
  const css = fs.readFileSync(cssPath, "utf8");
  if (/@import\b|url\(\s*['"]?(?:https?:|\/\/)/i.test(css)) {
    failures.push("CSS must not load external stylesheets or assets.");
  }
}

try {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  if (
    Object.keys(metadata.dependencies || {}).length ||
    Object.keys(metadata.devDependencies || {}).length
  ) {
    failures.push("The plain JavaScript project must remain dependency-free.");
  }
} catch (error) {
  failures.push(`Cannot read package.json: ${error.message}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${scripts.length} JavaScript files and ${resourceCount} local HTML references. No external runtime dependencies.`,
  );
}
