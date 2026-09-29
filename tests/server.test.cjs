"use strict";

const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("../scripts/serve.cjs");

let fixture;
let root;
let server;
let port;

before(async () => {
  fixture = await fs.mkdtemp(path.join(os.tmpdir(), "pixel-sandbox-server-"));
  root = path.join(fixture, "project");
  await fs.mkdir(path.join(root, "css"), { recursive: true });
  await fs.mkdir(path.join(root, "js"), { recursive: true });
  await fs.mkdir(path.join(root, "scripts"), { recursive: true });
  await fs.mkdir(path.join(root, "js", "directory.js"));
  await Promise.all([
    fs.writeFile(path.join(root, "index.html"), "<h1>Sandbox</h1>"),
    fs.writeFile(
      path.join(root, "css", "styles.css"),
      "body { color: black; }",
    ),
    fs.writeFile(path.join(root, "js", "app.js"), 'console.log("Sandbox");'),
    fs.writeFile(path.join(root, "js", ".private.js"), "private"),
    fs.writeFile(path.join(root, "scripts", "private.js"), "private"),
    fs.writeFile(path.join(root, "package.json"), "{}"),
    fs.writeFile(path.join(fixture, "outside.js"), "outside"),
  ]);
  server = createServer({ root });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  port = server.address().port;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (fixture) await fs.rm(fixture, { recursive: true, force: true });
});

function request(pathname, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path: pathname, method },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

test("serves the entry point and local resources with correct MIME types", async () => {
  const entry = await request("/");
  assert.equal(entry.status, 200);
  assert.equal(entry.body, "<h1>Sandbox</h1>");
  assert.equal(entry.headers["content-type"], "text/html; charset=utf-8");
  assert.equal(entry.headers["x-content-type-options"], "nosniff");
  const css = await request("/css/styles.css");
  assert.equal(css.status, 200);
  assert.equal(css.headers["content-type"], "text/css; charset=utf-8");
  const js = await request("/js/app.js?v=1");
  assert.equal(js.status, 200);
  assert.equal(js.headers["content-type"], "text/javascript; charset=utf-8");
});

test("HEAD returns headers without a response body", async () => {
  const result = await request("/index.html", "HEAD");
  assert.equal(result.status, 200);
  assert.equal(result.body, "");
  assert.equal(
    Number(result.headers["content-length"]),
    Buffer.byteLength("<h1>Sandbox</h1>"),
  );
});

test("rejects unsupported HTTP methods", async () => {
  const result = await request("/index.html", "POST");
  assert.equal(result.status, 405);
  assert.equal(result.headers.allow, "GET, HEAD");
});

test("does not expose private files, directories, or source tooling", async () => {
  for (const pathname of [
    "/package.json",
    "/scripts/private.js",
    "/js/.private.js",
    "/css/",
    "/js/directory.js",
    "/js/missing.js",
    "/.env",
  ]) {
    assert.equal((await request(pathname)).status, 404, pathname);
  }
});

test("blocks traversal paths before normalization", async () => {
  for (const pathname of [
    "/../outside.js",
    "/js/../../outside.js",
    "/js/%2e%2e/%2e%2e/outside.js",
    "/js/..%2f..%2foutside.js",
    "/js/%2e/app.js",
  ]) {
    assert.equal((await request(pathname)).status, 404, pathname);
  }
});

test("handles malformed or unsafe URL encodings", async () => {
  for (const pathname of ["/js/%", "/js/%00app.js", "/js/%5c..%5coutside.js"]) {
    assert.equal((await request(pathname)).status, 400, pathname);
  }
});

test("does not follow symlinks outside the project", async (context) => {
  try {
    await fs.symlink(
      path.join(fixture, "outside.js"),
      path.join(root, "js", "linked.js"),
    );
  } catch (error) {
    if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) {
      context.skip("This system does not permit creating symlinks.");
      return;
    }
    throw error;
  }
  assert.equal((await request("/js/linked.js")).status, 404);
});
