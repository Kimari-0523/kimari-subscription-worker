// Isolated local preview. Uses demo data only; never connects to production KV.
import http from "node:http";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import net from "node:net";
import tls from "node:tls";
import { Readable, Writable } from "node:stream";
const root = new URL("../", import.meta.url);
const dataFile = process.env.KIMARI_PREVIEW_DATA || fileURLToPath(new URL("../preview-data.json", root));
globalThis.__kimariConnect = (address, options) => {
  const raw =
    options.secureTransport === "on"
      ? tls.connect({ host: address.hostname, port: address.port, rejectUnauthorized: true })
      : net.connect({ host: address.hostname, port: address.port });
  const opened = new Promise((resolve, reject) => {
    raw.once(options.secureTransport === "on" ? "secureConnect" : "connect", resolve);
    raw.once("error", reject);
  });
  const closed = new Promise((resolve) => raw.once("close", resolve));
  return {
    opened,
    closed,
    readable: Readable.toWeb(raw),
    writable: Writable.toWeb(raw),
    close: async () => {
      raw.destroy();
    },
  };
};
const node = (name, server) => ({
  name,
  type: "trojan",
  server,
  port: 443,
  password: "demo-preview-only",
  sni: "example.com",
});
let entries = {
  config: JSON.stringify({
    sources: "",
    yaml: "",
    rules: [],
    directCN: true,
    fallback: "节点选择",
    sourceFiles: {},
    imports: [
      {
        id: "demo-upload",
        name: "旅行备用.yaml",
        kind: "file",
        count: 2,
        addedAt: Date.now(),
        content: JSON.stringify({
          proxies: [node("东京 · 备用 01", "example.com"), node("新加坡 · 备用 02", "example.org")],
        }),
      },
      {
        id: "demo-paste",
        name: "我的常用节点",
        kind: "paste",
        count: 1,
        addedAt: Date.now(),
        content: JSON.stringify({ proxies: [node("香港 · 日常连接", "example.net")] }),
      },
    ],
  }),
};
try {
  entries = JSON.parse(await fs.readFile(dataFile, "utf8"));
} catch {}
const CONFIG = {
  async get(key, type) {
    const value = entries[key];
    return value === undefined ? null : type === "json" ? JSON.parse(value) : value;
  },
  async put(key, value) {
    entries[key] = value;
    await fs.writeFile(dataFile, JSON.stringify(entries));
  },
};
let worker, mtime;
async function getWorker() {
  const stat = await fs.stat(new URL("worker.js", root));
  if (worker && mtime === stat.mtimeMs) return worker;
  let source = await fs.readFile(new URL("worker.js", root), "utf8");
  source = source
    .replace(
      /import\s*\{\s*connect\s*\}\s*from\s*["']cloudflare:sockets["'];?/,
      "const connect=globalThis.__kimariConnect;",
    )
    .replaceAll("/YOUR_ENTRY_PATH", "/kimari")
    .replaceAll("YOUR_MANAGEMENT_KEY", "local-preview-key")
    .replaceAll("YOUR_SUBSCRIPTION_KEY", "preview-only");
  worker = (await import("data:text/javascript;base64," + Buffer.from(source).toString("base64")))
    .default;
  mtime = stat.mtimeMs;
  return worker;
}
const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = new Headers(req.headers);
    // The preview is confined to loopback and is automatically signed into demo KV.
    headers.set("cookie", "kimari_session=local-preview-key");
    const request = new Request("http://127.0.0.1:8787" + req.url, {
      method: req.method,
      headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    const response = await (
      await getWorker()
    ).fetch(
      request,
      { CONFIG },
      {
        waitUntil(p) {
          p.catch(() => {});
        },
      },
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error.message);
    res.writeHead(500);
    res.end("Preview error");
  }
});
server.listen(8787, "127.0.0.1", () =>
  console.log("Local preview: http://127.0.0.1:8787/kimari (isolated demo data)"),
);
