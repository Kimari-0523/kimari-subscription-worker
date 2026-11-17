import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
let queued = [],
  requests = [];
globalThis.__kimariConnect = (address, options) => {
  requests.push({ address, options });
  const chunks = queued.shift();
  assert.ok(chunks, "unexpected socket");
  return {
    opened: Promise.resolve(),
    closed: Promise.resolve(),
    readable: new ReadableStream({
      start(c) {
        for (const x of chunks) c.enqueue(typeof x === "string" ? new TextEncoder().encode(x) : x);
        c.close();
      },
    }),
    writable: new WritableStream(),
    close: async () => {},
  };
};
const source = (await fs.readFile(new URL("../worker.js", import.meta.url), "utf8")).replace(
  /import\s*\{\s*connect\s*\}\s*from\s*["']cloudflare:sockets["'];?/,
  "const connect=globalThis.__kimariConnect;",
);
const {
  default: worker,
  validate,
  publicUrl,
  ipResponse,
  remote,
} = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const node = {
  name: "test",
  type: "trojan",
  server: "example.com",
  port: 443,
  password: "test-password",
};
const local = {
  id: "local-one",
  name: "saved.yaml",
  kind: "file",
  content: JSON.stringify({ proxies: [node] }),
  addedAt: 123,
};
const base = { sources: "", yaml: "", rules: [], directCN: true, imports: [local] };
function store() {
  const values = new Map();
  return {
    values,
    async get(k, type) {
      return values.has(k) ? (type === "json" ? JSON.parse(values.get(k)) : values.get(k)) : null;
    },
    async put(k, v, options) {
      assert.equal(options, undefined, "config must not expire");
      values.set(k, v);
    },
  };
}
function call(
  route,
  { method = "GET", body, cookie = true, origin = "https://example.com", CONFIG } = {},
) {
  return worker.fetch(
    new Request("https://example.com/YOUR_ENTRY_PATH/" + route, {
      method,
      headers: {
        ...(cookie ? { cookie: "kimari_session=YOUR_MANAGEMENT_KEY" } : {}),
        origin,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    { CONFIG },
    {
      waitUntil(p) {
        p.catch(() => {});
      },
    },
  );
}
test("persistent imports survive save/reopen and are exported in fixed subscription", async () => {
  const CONFIG = store();
  let response = await call("api/config", { method: "POST", body: base, CONFIG });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).count, 1);
  response = await call("api/config", { CONFIG });
  const data = await response.json();
  assert.equal(data.config.imports[0].name, "saved.yaml");
  assert.equal(data.config.imports[0].count, 1);
  assert.equal(data.config.imports[0].addedAt, 123);
  response = await call("sub?token=YOUR_SUBSCRIPTION_KEY", { cookie: false, CONFIG });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).proxies[0].password, "test-password");
  await call("api/config", { method: "POST", body: { ...base, imports: [] }, CONFIG });
  response = await call("api/config", { CONFIG });
  assert.equal((await response.json()).config.imports.length, 0);
});
test("legacy YAML and source files remain compatible", () => {
  const result = validate({
    ...base,
    yaml: local.content,
    sources: "https://example.com/sub",
    sourceFiles: { "https://example.com/sub": { name: "backup.yaml", content: local.content } },
  });
  assert.equal(result.yaml, local.content);
  assert.ok(result.sourceFiles["https://example.com/sub"]);
  assert.equal(result.imports.length, 1);
});
test("an unavailable IP source uses its non-expiring saved backup", async () => {
  const CONFIG = store();
  const url = "http://8.8.8.8:2096/sub";
  const body = {
    ...base,
    imports: [],
    sources: url,
    sourceFiles: { [url]: { name: "backup.yaml", content: local.content } },
  };
  queued.push(["HTTP/1.1 503 Unavailable\r\nContent-Length: 0\r\n\r\n"]);
  const saved = await call("api/config", { method: "POST", body, CONFIG });
  assert.equal(saved.status, 200);
  assert.match((await saved.json()).reports[0].warning, /文件快照/);
  queued.push(["HTTP/1.1 503 Unavailable\r\nContent-Length: 0\r\n\r\n"]);
  const subscription = await call("sub?token=YOUR_SUBSCRIPTION_KEY", { CONFIG, cookie: false });
  assert.equal(subscription.status, 200);
  assert.equal((await subscription.json()).proxies.length, 1);
});
test("auth, origin and import size/IDs are validated", async () => {
  const CONFIG = store();
  assert.equal((await call("api/config", { CONFIG, cookie: false })).status, 401);
  assert.equal(
    (
      await call("api/config", {
        method: "POST",
        CONFIG,
        body: base,
        origin: "https://bad.example",
      })
    ).status,
    403,
  );
  assert.throws(() => validate({ ...base, imports: [local, local] }), /重复/);
  assert.throws(
    () => validate({ ...base, imports: [{ ...local, content: "x".repeat(500001) }] }),
    /500 KB/,
  );
  assert.throws(() => validate({ ...base, imports: [{ ...local, content: "invalid" }] }));
});
test("IP validation allows public v4/v6 and blocks private/reserved variants", () => {
  for (const url of [
    "http://8.8.8.8:2096/sub",
    "https://[2606:4700:4700::1111]/sub",
    "https://example.com/sub",
  ])
    assert.ok(publicUrl(url));
  for (const host of [
    "127.0.0.1",
    "0x7f000001",
    "2130706433",
    "10.0.0.1",
    "172.20.1.1",
    "192.168.1.1",
    "169.254.1.1",
    "100.64.0.1",
    "198.18.0.1",
    "192.0.2.1",
    "[::1]",
    "[::ffff:127.0.0.1]",
    "[fc00::1]",
    "[2001:db8::1]",
    "localhost",
    "a.local",
  ])
    assert.throws(() => publicUrl("http://" + host + "/sub"), host);
});
test("IP HTTP content-length, chunks and gzip decode correctly across packets", async () => {
  queued.push(["HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhe", "llo"]);
  let response = await ipResponse(new URL("http://8.8.8.8:2096/sub"), AbortSignal.timeout(1000));
  assert.equal(await response.text(), "hello");
  assert.equal(requests.at(-1).address.port, 2096);
  queued.push([
    "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nhe\r\n",
    "3;foo=bar\r\nllo\r\n0\r\n\r\n",
  ]);
  response = await ipResponse(new URL("https://8.8.8.8/sub"), AbortSignal.timeout(1000));
  assert.equal(await response.text(), "hello");
  assert.equal(requests.at(-1).options.secureTransport, "on");
  const gzip = zlib.gzipSync("hello");
  queued.push([
    "HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nContent-Length: " + gzip.length + "\r\n\r\n",
    gzip,
  ]);
  response = await ipResponse(new URL("http://8.8.8.8/sub"), AbortSignal.timeout(1000));
  assert.equal(await response.text(), "hello");
});
test("IP redirects to private destinations and truncated/oversized bodies fail", async () => {
  queued.push(["HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1/sub\r\n\r\n"]);
  await assert.rejects(() => remote("http://8.8.8.8/sub"), /公网/);
  queued.push(["HTTP/1.1 200 OK\r\nContent-Length: 5000000\r\n\r\n"]);
  await assert.rejects(
    () => ipResponse(new URL("http://8.8.8.8/sub"), AbortSignal.timeout(1000)),
    /4 MB/,
  );
  queued.push(["HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\nabc"]);
  await assert.rejects(
    () => ipResponse(new URL("http://8.8.8.8/sub"), AbortSignal.timeout(1000)),
    /不完整/,
  );
});
test("generated page scripts parse and QR library creates a real matrix", async () => {
  const html = await (
    await worker.fetch(new Request("https://example.com/YOUR_ENTRY_PATH"), {}, {})
  ).text();
  for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script);
  const ctx = vm.createContext({});
  vm.runInContext(
    await fs.readFile(new URL("../src/vendor/qrcode.js", import.meta.url), "utf8"),
    ctx,
  );
  const qr = ctx.qrcode(0, "M");
  qr.addData("https://example.com/YOUR_ENTRY_PATH/sub?token=review");
  qr.make();
  assert.ok(qr.getModuleCount() > 21);
  assert.ok(qr.createSvgTag().includes("<svg"));
});
