import fs from "node:fs/promises";
const root = new URL("../", import.meta.url);
const read = async (path) => (await fs.readFile(new URL(path, root), "utf8")).replace(/\r\n/g, "\n");
const core = await read("src/core.js");
let html = await read("src/panel.html");
const css = await read("src/panel.css");
html = html.replace("<!-- PANEL_STYLE -->", () => "<style>\n" + css + "\n</style>");
const qr = await read("src/vendor/qrcode.js");
html = html.replace("<!-- QR_LIBRARY -->", () => "<script>\n" + qr + "\n</script>");
const extra = await read("src/panel-extra.js");
html = html.replace("// EXTRA_SCRIPT", () => extra);
let source = [
  await read("src/ip-transport.js"),
  core,
  "\nconst Sn=" + JSON.stringify(html) + ";\n",
  await read("src/backend.js"),
].join("\n");
// Production values are supplied only by Cloudflare's private build environment.
// Normal builds and tests keep the public placeholders and never contain secrets.
if (process.env.KIMARI_PRODUCTION_BUILD === "1") {
  const entryPath = process.env.KIMARI_ENTRY_PATH;
  const managementKey = process.env.KIMARI_MANAGEMENT_KEY;
  const subscriptionKey = process.env.KIMARI_SUBSCRIPTION_KEY;
  if (!entryPath || !managementKey || !subscriptionKey) {
    throw new Error("Production build requires all three KIMARI configuration values");
  }
  if (!/^\/[A-Za-z0-9_-]+$/.test(entryPath)) {
    throw new Error("Invalid production entry path");
  }
  source = source.replaceAll("/YOUR_ENTRY_PATH", () => entryPath);
  for (const [placeholder, value] of [
    ["YOUR_MANAGEMENT_KEY", managementKey],
    ["YOUR_SUBSCRIPTION_KEY", subscriptionKey],
  ]) {
    const literal = JSON.stringify(placeholder);
    if (source.split(literal).length !== 2) {
      throw new Error("Expected exactly one production key placeholder");
    }
    source = source.replace(literal, () => JSON.stringify(value));
  }
}
await fs.writeFile(new URL("worker.js", root), source);
console.log("Built self-contained worker.js");
