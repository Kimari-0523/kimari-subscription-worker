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
const source = [
  await read("src/ip-transport.js"),
  core,
  "\nconst Sn=" + JSON.stringify(html) + ";\n",
  await read("src/backend.js"),
].join("\n");
await fs.writeFile(new URL("worker.js", root), source);
console.log("Built self-contained worker.js");
