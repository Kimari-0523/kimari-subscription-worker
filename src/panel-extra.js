function updateSaveState() {
  $("saveState").textContent = dirty ? "有未保存的修改" : "已与云端同步";
  $("saveState").dataset.dirty = String(dirty);
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("themeDark").setAttribute("aria-pressed", String(theme === "dark"));
  $("themeLight").setAttribute("aria-pressed", String(theme === "light"));
  try {
    localStorage.setItem("kimari-theme", theme);
  } catch {}
}
$("themeDark").onclick = () => setTheme("dark");
$("themeLight").onclick = () => setTheme("light");
try {
  setTheme(localStorage.getItem("kimari-theme") === "light" ? "light" : "dark");
} catch {
  setTheme("dark");
}

function renderImports() {
  const list = $("importList");
  list.replaceChildren();
  $("libraryCount").textContent = imports.length + " 份内容";
  if (!imports.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    const content = document.createElement("div");
    const icon = document.createElement("b");
    icon.textContent = "＋";
    const title = document.createElement("div");
    title.textContent = "为你的连接，留一份存档";
    const hint = document.createElement("div");
    hint.className = "small";
    hint.textContent = "添加后的文件与节点会在这里长期显示";
    content.append(icon, title, hint);
    empty.append(content);
    list.append(empty);
  }
  for (const item of imports) {
    const row = document.createElement("article");
    row.className = "import-item";
    const head = document.createElement("div");
    head.className = "import-head";
    const icon = document.createElement("span");
    icon.className = "file-icon";
    icon.textContent = item.kind === "file" ? "↥" : "≡";
    icon.setAttribute("aria-hidden", "true");
    const info = document.createElement("div");
    info.className = "import-info";
    const name = document.createElement("span");
    name.className = "import-name";
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.className = "import-meta";
    let nodes = [];
    try {
      nodes = JSON.parse(item.content).proxies || [];
    } catch {}
    meta.textContent =
      (item.kind === "file" ? "上传文件" : "粘贴节点") +
      " · " +
      nodes.length +
      " 个节点 · " +
      (savedIds.has(item.id) ? "已保存" : "待保存");
    info.append(name, meta);
    head.append(icon, info);
    const chips = document.createElement("div");
    chips.className = "node-chips";
    for (const node of nodes.slice(0, 5)) {
      const chip = document.createElement("span");
      chip.textContent = node.name;
      chips.append(chip);
    }
    if (nodes.length > 5) {
      const more = document.createElement("span");
      more.textContent = "另 " + (nodes.length - 5) + " 个";
      chips.append(more);
    }
    info.append(chips);
    const actions = document.createElement("div");
    actions.className = "actions";
    const view = document.createElement("button");
    view.className = "secondary";
    view.textContent = "查看内容";
    view.setAttribute("aria-expanded", "false");
    const content = document.createElement("pre");
    content.className = "import-content";
    content.hidden = true;
    content.textContent = JSON.stringify({ proxies: nodes }, null, 2);
    view.onclick = () => {
      content.hidden = !content.hidden;
      view.textContent = content.hidden ? "查看内容" : "收起内容";
      view.setAttribute("aria-expanded", String(!content.hidden));
    };
    const remove = document.createElement("button");
    remove.className = "secondary";
    remove.textContent = "移除";
    remove.setAttribute("aria-label", "移除 " + item.name);
    remove.onclick = () => {
      imports = imports.filter((i) => i.id !== item.id);
      dirty = true;
      renderImports();
      updateSaveState();
    };
    actions.append(view, remove);
    row.append(head, actions, content);
    list.append(row);
  }
}

async function normalizeLocal(content) {
  const checked = await api("preview", { sources: "", yaml: content, rules: [], directCN: false });
  if (!checked.count) throw Error("未识别到可用节点");
  return {
    count: checked.count,
    content: JSON.stringify({
      proxies: checked.config.proxies.map((p) => ({ ...p, name: p.name.replace(/^\[1\] /, "") })),
    }),
  };
}
function appendLocal(item) {
  if (imports.length >= 30) throw Error("最多保存 30 份本地内容");
  if (imports.reduce((sum, i) => sum + i.content.length, 0) + item.content.length > 1500000)
    throw Error("本地内容合计超过 1.5 MB");
  imports.push({ id: crypto.randomUUID(), addedAt: Date.now(), ...item });
  dirty = true;
  renderImports();
  updateSaveState();
}
$("pasteAdd").onclick = () =>
  run($("pasteAdd"), async () => {
    const content = $("pasteContent").value.trim();
    if (!content) throw Error("请先粘贴订阅内容或节点");
    if (new TextEncoder().encode(content).length > 500000) throw Error("单份内容不能超过 500 KB");
    const normalized = await normalizeLocal(content);
    appendLocal({
      ...normalized,
      name: $("pasteName").value.trim() || "粘贴的节点 " + (imports.length + 1),
      kind: "paste",
    });
    $("pasteName").value = "";
    $("pasteContent").value = "";
    message("已添加 " + normalized.count + " 个节点。点击“保存配置”后长期保留。");
  });
$("libraryUpload").onclick = () => $("libraryFiles").click();
$("libraryFiles").onchange = () =>
  run($("libraryUpload"), async () => {
    let added = 0;
    try {
      for (const file of $("libraryFiles").files) {
        if (file.size > 500000) throw Error(file.name + " 超过 500 KB");
        appendLocal({
          ...(await normalizeLocal(await file.text())),
          name: file.name,
          kind: "file",
        });
        added++;
      }
      if (added) message("已添加 " + added + " 份文件。点击“保存配置”后长期保留。");
    } catch (error) {
      throw Error((added ? "已添加 " + added + " 份文件；" : "") + error.message);
    } finally {
      $("libraryFiles").value = "";
    }
  });
const saveConfig = $("save").onclick;
$("save").onclick = () => {
  if ($("pasteContent").value.trim()) {
    message("粘贴区还有未添加的内容。请先点击“添加到列表”，再保存配置。", true);
    return;
  }
  return saveConfig();
};
for (const event of ["input", "change", "click"])
  $("app").addEventListener(event, () => queueMicrotask(updateSaveState));

let qrSvg = "";
$("qrOpen").onclick = () =>
  run($("qrOpen"), async () => {
    const link = $("subscription").value;
    if (!link) throw Error("订阅地址尚未加载");
    qrcode.stringToBytes = (text) => Array.from(new TextEncoder().encode(text));
    const qr = qrcode(0, "M");
    qr.addData(link, "Byte");
    qr.make();
    qrSvg = qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true });
    $("qrImage").innerHTML = qrSvg;
    $("qrImage").setAttribute("role", "img");
    $("qrImage").setAttribute("aria-label", "固定订阅地址二维码");
    $("qrLink").textContent = link;
    $("qrDialog").showModal();
  });
$("qrClose").onclick = () => $("qrDialog").close();
$("qrSave").onclick = () => download(qrSvg, "kimari-subscription-qr.svg", "image/svg+xml");
