// Keep placeholder keys in public source. Never commit production keys.
var gs = "YOUR_MANAGEMENT_KEY", // Change this to your own management key.
  Nn = "YOUR_SUBSCRIPTION_KEY", // Change this to your own subscription key.
  Is = () => ({
    sourceFiles: {},
    imports: [],
    sources: "",
    yaml: "",
    rules: [],
    directCN: !0,
    fallback: "\u8282\u70B9\u9009\u62E9",
  }),
  $t = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  },
  _ = (s, e = 200, t = {}) =>
    new Response(JSON.stringify(s), {
      status: e,
      headers: { ...$t, "Content-Type": "application/json; charset=utf-8", ...t },
    }),
  ys = (s, e) => {
    if (typeof s != "string" || s.length !== e.length) return !1;
    let t = 0;
    for (let n = 0; n < s.length; n++) t |= s.charCodeAt(n) ^ e.charCodeAt(n);
    return t === 0;
  },
  ii = async (s) =>
    Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
      .map((e) => e.toString(16).padStart(2, "0"))
      .join("");
function _t(s) {
  return publicUrl(s);
}
async function Pt(s, e = 4 * 1024 * 1024) {
  if (Number(s.headers.get("content-length")) > e)
    throw Error("\u5185\u5BB9\u8D85\u8FC7\u5927\u5C0F\u9650\u5236");
  let t = s.body?.getReader();
  if (!t) return "";
  let n = 0,
    i = [];
  for (;;) {
    let { value: a, done: l } = await t.read();
    if (l) break;
    if (((n += a.length), n > e))
      throw (await t.cancel(), Error("\u5185\u5BB9\u8D85\u8FC7\u5927\u5C0F\u9650\u5236"));
    i.push(a);
  }
  let o = new Uint8Array(n),
    r = 0;
  for (let a of i) (o.set(a, r), (r += a.length));
  return new TextDecoder().decode(o);
}
async function oi(s) {
  let e = _t(s),
    t = AbortSignal.timeout(12e3);
  for (let n = 0; n < 4; n++) {
    let i;
    try {
      i = isIp(e.hostname)
        ? await ipResponse(e, t)
        : await fetch(e, {
            headers: {
              "User-Agent": "Clash.Meta/1.19",
              Accept: "application/yaml,text/yaml,text/plain,*/*",
            },
            redirect: "manual",
            signal: t,
          });
    } catch (error) {
      if (isIp(e.hostname)) throw error;
      throw Error(
        t.aborted
          ? "\u8BA2\u9605\u8BF7\u6C42\u8D85\u65F6\uFF0812 \u79D2\uFF09"
          : "\u8BA2\u9605\u8FDE\u63A5\u5931\u8D25\uFF08DNS\u3001TLS \u6216\u4E0A\u6E38\u4E0D\u53EF\u8FBE\uFF09",
      );
    }
    if (i.status >= 300 && i.status < 400) {
      await i.body?.cancel();
      const location = i.headers.get("location");
      if (!location) throw Error("订阅重定向缺少目标地址");
      e = _t(new URL(location, e).href);
      continue;
    }
    if (!i.ok)
      throw (
        await i.body?.cancel(),
        Error(
          "\u4E0A\u6E38\u8FD4\u56DE HTTP " +
            i.status +
            (/^\d+\.\d+\.\d+\.\d+$/.test(e.hostname)
              ? "\uFF1B\u88F8 IP \u8BA2\u9605\u53EF\u80FD\u53D7 Cloudflare Workers \u9650\u5236\uFF0C\u8BF7\u4F7F\u7528\u673A\u573A\u63D0\u4F9B\u7684\u57DF\u540D\u5730\u5740\u6216\u5BFC\u5165\u914D\u7F6E\u6587\u4EF6"
              : ""),
        )
      );
    let o = await Pt(i);
    if (/^\s*(?:<!doctype html|<html)/i.test(o))
      throw Error(
        "\u4E0A\u6E38\u8FD4\u56DE\u7F51\u9875\u800C\u975E\u8282\u70B9\u914D\u7F6E\uFF08\u53EF\u80FD\u662F\u767B\u5F55\u9875\u6216\u9632\u62A4\u9A8C\u8BC1\uFF09",
      );
    try {
      return ye(o);
    } catch (r) {
      throw Error(
        "\u8BA2\u9605\u5DF2\u4E0B\u8F7D\uFF0C\u4F46\u89E3\u6790\u5931\u8D25\uFF1A" + r.message,
      );
    }
  }
  throw Error("\u8BA2\u9605\u91CD\u5B9A\u5411\u6B21\u6570\u8FC7\u591A");
}
function wn(s) {
  if (!s || typeof s != "object") throw Error("\u914D\u7F6E\u683C\u5F0F\u9519\u8BEF");
  let e = {
    ...Is(),
    sources: String(s.sources || ""),
    yaml: String(s.yaml || ""),
    rules: s.rules || [],
    directCN: s.directCN !== !1,
    fallback: s.fallback === "DIRECT" ? "DIRECT" : "\u8282\u70B9\u9009\u62E9",
  };
  if (
    e.sources.length > 15e4 ||
    e.yaml.length > 5e5 ||
    !Array.isArray(e.rules) ||
    e.rules.length > 300
  )
    throw Error("\u914D\u7F6E\u8D85\u8FC7\u9650\u5236");
  let t = e.sources
    .split(/\r?\n/)
    .map((o) => o.trim())
    .filter(Boolean);
  if (t.length > 30) throw Error("\u6700\u591A\u6DFB\u52A0 30 \u4E2A\u6765\u6E90");
  for (let o of t) /^https?:\/\//i.test(o) ? _t(o) : ye(o);
  e.yaml.trim() && ye(e.yaml);
  let n = s.sourceFiles || {};
  if (typeof n != "object" || Array.isArray(n))
    throw Error("\u6587\u4EF6\u5FEB\u7167\u683C\u5F0F\u9519\u8BEF");
  e.sourceFiles = {};
  let i = 0;
  for (let [o, r] of Object.entries(n)) {
    if (!t.includes(o)) continue;
    if ((_t(o), !r || typeof r.content != "string" || r.content.length > 5e5))
      throw Error("\u914D\u7F6E\u6587\u4EF6\u8FC7\u5927\u6216\u683C\u5F0F\u65E0\u6548");
    if (((i += r.content.length), i > 15e5))
      throw Error("\u6587\u4EF6\u5FEB\u7167\u5408\u8BA1\u8D85\u8FC7 1.5 MB");
    let a = ye(r.content);
    e.sourceFiles[o] = {
      name: String(r.name || "\u914D\u7F6E\u6587\u4EF6").slice(0, 120),
      content: JSON.stringify({ proxies: a }),
    };
  }
  e.imports = validateImports(s.imports);
  return e;
}
async function bs(s, e, t, n = !1) {
  let i = s.sources
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
    o = [],
    r = [];
  for (let l = 0; l < i.length; l += 5)
    await Promise.all(
      i.slice(l, l + 5).map(async (c, m) => {
        let u = l + m,
          f = [],
          h = "";
        if (/^https?:\/\//i.test(c)) {
          let g = "source:" + (await ii(c)),
            p = await e.CONFIG.get(g, "json");
          if (p && !n && Date.now() - p.time < 9e5) f = p.nodes;
          else
            try {
              ((f = await oi(c)),
                t.waitUntil(
                  e.CONFIG.put(g, JSON.stringify({ time: Date.now(), nodes: f }), {
                    expirationTtl: 604800,
                  }),
                ));
            } catch (d) {
              let y = s.sourceFiles?.[c];
              p
                ? ((f = p.nodes),
                  (h =
                    d.message +
                    "\uFF1B\u6CBF\u7528 " +
                    new Date(p.time).toISOString() +
                    " \u7684\u5728\u7EBF\u7F13\u5B58"))
                : y
                  ? ((f = ye(y.content)),
                    (h =
                      d.message +
                      "\uFF1B\u4F7F\u7528\u6587\u4EF6\u5FEB\u7167 " +
                      y.name +
                      "\uFF08\u4E0D\u4F1A\u81EA\u52A8\u66F4\u65B0\u6587\u4EF6\u5185\u5BB9\uFF09"))
                  : (h =
                      d.message +
                      "\uFF1B\u53EF\u4E3A\u6B64\u6765\u6E90\u5BFC\u5165\u672C\u5730\u914D\u7F6E\u6587\u4EF6");
            }
        } else f = ye(c);
        ((o[u] = f), (r[u] = { name: "\u6765\u6E90 " + (u + 1), count: f.length, warning: h }));
      }),
    );
  if (s.yaml.trim()) {
    let l = ye(s.yaml);
    (o.push(l), r.push({ name: "\u6765\u6E90 " + o.length, count: l.length, warning: "" }));
  }
  for (const item of s.imports || []) {
    const nodes = ye(item.content);
    o.push(nodes);
    r.push({ name: "来源 " + o.length + " · " + item.name, count: nodes.length, warning: "" });
  }
  let a = bn(s, o);
  return {
    config: a,
    reports: r,
    targets: [
      ...Te,
      ...a["proxy-groups"].filter((l) => !Te.includes(l.name)).map((l) => l.name),
      ...a.proxies.map((l) => l.name),
    ],
    count: a.proxies.length,
  };
}
var ef = {
  async fetch(s, e, t) {
    try {
      let n = new URL(s.url),
        i = n.pathname.replace(/\/$/, "");
      if (i !== "/YOUR_ENTRY_PATH" && !i.startsWith("/YOUR_ENTRY_PATH/"))
        return new Response("Not found", { status: 404, headers: $t });
      if (i === "/YOUR_ENTRY_PATH" && s.method === "GET")
        return new Response(Sn, { headers: { ...$t, "Content-Type": "text/html; charset=utf-8" } });
      if (!e.CONFIG) return _({ error: "\u6570\u636E\u5B58\u50A8\u5C1A\u672A\u8FDE\u63A5" }, 503);
      let o = ys(
        (s.headers.get("cookie") || "")
          .split(";")
          .map((r) => r.trim())
          .find((r) => r.startsWith("kimari_session="))
          ?.slice(15) || "",
        gs,
      );
      if (s.method !== "GET" && s.headers.get("origin") !== n.origin)
        return _({ error: "\u8BF7\u6C42\u6765\u6E90\u4E0D\u5339\u914D" }, 403);
      if (i === "/YOUR_ENTRY_PATH/api/login" && s.method === "POST") {
        let r = JSON.parse(await Pt(s, 4096));
        return ys(r.key, gs)
          ? _({ ok: !0 }, 200, {
              "Set-Cookie":
                "kimari_session=" +
                gs +
                "; HttpOnly; Secure; SameSite=Strict; Path=/YOUR_ENTRY_PATH; Max-Age=2592000",
            })
          : _({ error: "\u7BA1\u7406\u5BC6\u94A5\u4E0D\u6B63\u786E" }, 401);
      }
      if (i === "/YOUR_ENTRY_PATH/sub" && s.method === "GET") {
        if (!ys(n.searchParams.get("token") || "", Nn))
          return _({ error: "\u8BA2\u9605\u5BC6\u94A5\u4E0D\u6B63\u786E" }, 401);
        let r = (await e.CONFIG.get("config", "json")) || Is(),
          a = await bs(r, e, t);
        return a.count
          ? new Response(JSON.stringify(a.config, null, 2), {
              headers: {
                ...$t,
                "Content-Type": "text/yaml; charset=utf-8",
                "Content-Disposition": 'attachment; filename="kimari.yaml"',
                "profile-update-interval": "6",
                "profile-title": "Kimari",
                "x-kimari-warnings": String(a.reports.filter((l) => l.warning).length),
              },
            })
          : _(
              {
                error:
                  "\u6CA1\u6709\u53EF\u7528\u8282\u70B9\uFF0C\u8BF7\u5728\u7BA1\u7406\u9875\u6DFB\u52A0\u5E76\u68C0\u67E5\u6765\u6E90",
              },
              422,
            );
      }
      if (!o) return _({ error: "\u8BF7\u5148\u767B\u5F55" }, 401);
      if (i === "/YOUR_ENTRY_PATH/api/logout" && s.method === "POST")
        return _({ ok: !0 }, 200, {
          "Set-Cookie":
            "kimari_session=; HttpOnly; Secure; SameSite=Strict; Path=/YOUR_ENTRY_PATH; Max-Age=0",
        });
      if (i === "/YOUR_ENTRY_PATH/api/config" && s.method === "GET")
        return _({
          config: (await e.CONFIG.get("config", "json")) || Is(),
          subscription: n.origin + "/YOUR_ENTRY_PATH/sub?token=" + Nn,
          defaultGroups: Ze,
          targets: Te,
        });
      if (i === "/YOUR_ENTRY_PATH/api/config" && s.method === "POST") {
        let r = wn(JSON.parse(await Pt(s, 4e6))),
          a = await bs(r, e, t);
        return (r.sources.trim() || r.yaml.trim()) && !a.count
          ? _(
              {
                error:
                  "\u6CA1\u6709\u53EF\u7528\u8282\u70B9\uFF0C\u672A\u4FDD\u5B58\uFF1B\u8BF7\u68C0\u67E5\u6765\u6E90",
                reports: a.reports,
              },
              422,
            )
          : (await e.CONFIG.put("config", JSON.stringify(r)), _({ ok: !0, ...a, savedConfig: r }));
      }
      if (i === "/YOUR_ENTRY_PATH/api/preview" && s.method === "POST") {
        let r = wn(JSON.parse(await Pt(s, 4e6)));
        return _(await bs(r, e, t, !0));
      }
      return _({ error: "\u63A5\u53E3\u4E0D\u5B58\u5728" }, 404);
    } catch (n) {
      return _(
        {
          error:
            n instanceof SyntaxError
              ? "\u8F93\u5165\u683C\u5F0F\u9519\u8BEF"
              : n.message || "\u5904\u7406\u5931\u8D25",
        },
        400,
      );
    }
  },
};
export { ef as default, oi as remote, wn as validate, publicUrl, ipResponse };

// Saved imports live in the same non-expiring config KV record as routing rules.
function validateImports(input = []) {
  if (!Array.isArray(input) || input.length > 30) throw Error("最多保存 30 份本地内容");
  let total = 0;
  const ids = new Set();
  return input.map((item) => {
    if (!item || typeof item.content !== "string" || item.content.length > 500000)
      throw Error("本地内容格式无效或超过 500 KB");
    total += item.content.length;
    if (total > 1500000) throw Error("本地内容合计超过 1.5 MB");
    const id = String(item.id || "");
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw Error("本地内容编号无效或重复");
    ids.add(id);
    const nodes = ye(item.content);
    return {
      id,
      name: String(item.name || "粘贴的节点").slice(0, 120),
      kind: item.kind === "file" ? "file" : "paste",
      addedAt: Number.isFinite(item.addedAt) ? item.addedAt : Date.now(),
      count: nodes.length,
      content: JSON.stringify({ proxies: nodes }),
    };
  });
}
