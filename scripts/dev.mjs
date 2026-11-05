import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const build = spawn(process.execPath, ["scripts/build-bundle.mjs"], { cwd: root, stdio: "inherit" });
build.on("exit", code => {
  if (code !== 0) { process.exitCode = code ?? 1; return; }
  console.log("Preview: http://127.0.0.1:4173/tests/fixtures/browser.html (rerun build after source changes)");
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    try {
      const relative = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
      const filePath = join(root, relative);
      if (filePath !== root && !filePath.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) {
        response.writeHead(403);
        response.end();
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, { "content-type": contentTypes[extname(filePath)] || "application/octet-stream" });
      response.end(body);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 404);
      response.end();
    }
  });
  server.listen(4173, "127.0.0.1");
  process.on("SIGINT", () => server.close());
  process.on("SIGTERM", () => server.close());
});
