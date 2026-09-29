#!/usr/bin/env node
"use strict";

/** A small local preview server. This is not a production application server. */
const http = require("node:http");
const { createReadStream } = require("node:fs");
const { realpath, stat } = require("node:fs/promises");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function isInside(root, filename) {
  const relative = path.relative(root, filename);
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
}

function respond(request, response, status, message, extraHeaders = {}) {
  const body = `${message}\n`;
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

function createServer({ root = PROJECT_ROOT } = {}) {
  const rootPath = path.resolve(root);
  // Resolve both ends before serving, so a symlink cannot expose a file outside root.
  const canonicalRoot = realpath(rootPath);

  return http.createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      respond(request, response, 405, "Method not allowed.", {
        Allow: "GET, HEAD",
      });
      return;
    }

    let pathname;
    try {
      // Check before URL normalization, which would hide encoded traversal attempts.
      pathname = decodeURIComponent((request.url || "/").split("?")[0]);
    } catch {
      respond(request, response, 400, "Invalid URL.");
      return;
    }

    if (
      !pathname.startsWith("/") ||
      pathname.includes("\\") ||
      pathname.includes("\0")
    ) {
      respond(request, response, 400, "Invalid path.");
      return;
    }

    const segments = pathname.split("/").filter(Boolean);
    if (segments.some((segment) => segment.startsWith("."))) {
      respond(request, response, 404, "Not found.");
      return;
    }
    if (pathname === "/") pathname = "/index.html";

    // Deliberately expose only the app, never scripts/, tests/, or configuration.
    const allowed =
      pathname === "/index.html" || /^\/(?:css|js|assets)\/[^/]/.test(pathname);
    const mime = MIME_TYPES[path.extname(pathname).toLowerCase()];
    if (!allowed || !mime) {
      respond(request, response, 404, "Not found.");
      return;
    }

    try {
      const filename = path.resolve(rootPath, `.${pathname}`);
      if (!isInside(rootPath, filename)) {
        respond(request, response, 404, "Not found.");
        return;
      }
      const resolvedFile = await realpath(filename);
      if (!isInside(await canonicalRoot, resolvedFile)) {
        respond(request, response, 404, "Not found.");
        return;
      }
      const info = await stat(resolvedFile);
      if (!info.isFile()) {
        respond(request, response, 404, "Not found.");
        return;
      }
      response.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": info.size,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      const stream = createReadStream(resolvedFile);
      stream.on("error", () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      const missing = ["ENOENT", "ENOTDIR", "EACCES"].includes(error.code);
      respond(
        request,
        response,
        missing ? 404 : 500,
        missing ? "Not found." : "Unable to read the file.",
      );
    }
  });
}

if (require.main === module) {
  const rawPort = process.env.PORT || "8080";
  const port = /^\d+$/.test(rawPort) ? Number(rawPort) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("PORT must be a whole number between 1 and 65535.");
    process.exit(1);
  }
  const server = createServer();
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Stop the other server or set PORT to another number.`,
      );
    } else {
      console.error(`Unable to start the local server: ${error.message}`);
    }
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Pixel Sandbox: http://127.0.0.1:${port}`);
    console.log("Press Ctrl+C to stop.");
  });
  const stop = () => server.close(() => process.exit(0));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

module.exports = { createServer };
