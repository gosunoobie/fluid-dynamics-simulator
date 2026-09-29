#!/usr/bin/env node
"use strict";

// Pass explicit file names: shell wildcard expansion is not portable to Windows.
const { readdirSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const tests = readdirSync(path.join(root, "tests"))
  .filter((name) => name.endsWith(".test.cjs"))
  .sort()
  .map((name) => path.join(root, "tests", name));

if (tests.length === 0) {
  console.error("No test files were found in tests/.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--test", ...process.argv.slice(2), ...tests],
  {
    cwd: root,
    stdio: "inherit",
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status === null ? 1 : result.status);
