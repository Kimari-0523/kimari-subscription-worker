// Bare-IP URLs cannot use Workers fetch(). Keep them on a bounded TCP transport.
import { connect } from "cloudflare:sockets";

function isIp(host) {
  return host.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(host);
}

function publicUrl(input) {
  const url = new URL(input),
    host = url.hostname.toLowerCase();
  const fail = () => {
    throw Error("订阅必须使用公网 HTTP(S) 地址，不支持内网、回环或保留地址");
  };
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) fail();
  if (host.startsWith("[")) {
    // Only global unicast; reject documentation and special-purpose prefixes.
    const [first, second] = host
      .slice(1, -1)
      .split(":")
      .map((part) => parseInt(part || "0", 16));
    if (
      first < 0x2000 ||
      first >= 0x4000 ||
      (first === 0x2001 && (second < 0x200 || second === 0xdb8)) ||
      first === 0x2002 ||
      first === 0x3fff
    )
      fail();
  } else if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b, c] = host.split(".").map(Number);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || b === 2 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    )
      fail();
  } else if (!host.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host))
    fail();
  return url;
}

async function ipResponse(url, signal) {
  const socket = connect(
    {
      hostname: url.hostname.replace(/^\[|\]$/g, ""),
      port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    },
    { secureTransport: url.protocol === "https:" ? "on" : "off" },
  );
  socket.closed.catch(() => {});
  const abort = () => {
    socket.close().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  let reader;
  try {
    if (signal.aborted) throw Error("订阅请求超时（12 秒）");
    await socket.opened;
    const writer = socket.writable.getWriter();
    await writer.write(
      new TextEncoder().encode(
        `GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.host}\r\nUser-Agent: Clash.Meta/1.19\r\nAccept: application/yaml,text/yaml,text/plain,*/*\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`,
      ),
    );
    writer.releaseLock();
    reader = socket.readable.getReader();
    let buffer = new Uint8Array(),
      eof = false,
      received = 0;
    const limit = 4 * 1024 * 1024;
    async function more() {
      const { done, value } = await reader.read();
      if (done) {
        eof = true;
        return;
      }
      received += value.length;
      if (received > limit + 65536) throw Error("订阅响应超过 4 MB 限制");
      const next = new Uint8Array(buffer.length + value.length);
      next.set(buffer);
      next.set(value, buffer.length);
      buffer = next;
    }
    async function take(n) {
      while (buffer.length < n && !eof) await more();
      if (buffer.length < n) throw Error("IP 订阅响应不完整");
      const result = buffer.slice(0, n);
      buffer = buffer.slice(n);
      return result;
    }
    async function line(max = 8192) {
      while (true) {
        const i = buffer.findIndex((v, j) => v === 13 && buffer[j + 1] === 10);
        if (i >= 0) {
          if (i > max) throw Error("IP 订阅响应头过大");
          const result = new TextDecoder().decode(buffer.slice(0, i));
          buffer = buffer.slice(i + 2);
          return result;
        }
        if (buffer.length > max || eof) throw Error("IP 订阅响应格式错误");
        await more();
      }
    }
    const statusLine = await line(),
      match = /^HTTP\/1\.[01] (\d{3})(?: |$)/.exec(statusLine);
    if (!match) throw Error("IP 订阅返回无效 HTTP 响应");
    const status = Number(match[1]),
      headers = new Headers();
    let size = statusLine.length;
    while (true) {
      const text = await line();
      if (!text) break;
      size += text.length;
      if (size > 32768) throw Error("IP 订阅响应头过大");
      const colon = text.indexOf(":");
      if (colon < 1) throw Error("IP 订阅响应头无效");
      headers.append(text.slice(0, colon), text.slice(colon + 1).trim());
    }
    if ((status >= 300 && status < 400) || status < 200 || status >= 400)
      return new Response(null, { status, headers });
    let body;
    if (/chunked/i.test(headers.get("transfer-encoding") || "")) {
      const chunks = [];
      let total = 0;
      while (true) {
        const lengthText = (await line()).split(";")[0];
        if (!/^[\da-f]+$/i.test(lengthText)) throw Error("IP 订阅分块格式错误");
        const n = parseInt(lengthText, 16);
        if (n === 0) break;
        if (total + n > limit) throw Error("订阅内容超过 4 MB 限制");
        chunks.push(await take(n));
        total += n;
        const ending = await take(2);
        if (ending[0] !== 13 || ending[1] !== 10) throw Error("IP 订阅分块不完整");
      }
      body = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }
    } else if (headers.has("content-length")) {
      const value = headers.get("content-length");
      if (!/^\d+$/.test(value)) throw Error("IP 订阅长度无效");
      const n = Number(value);
      if (n > limit) throw Error("订阅内容超过 4 MB 限制");
      body = await take(n);
    } else {
      while (!eof) await more();
      if (buffer.length > limit) throw Error("订阅内容超过 4 MB 限制");
      body = buffer;
    }
    const encoding = (headers.get("content-encoding") || "identity").toLowerCase();
    if (encoding !== "identity") {
      if (!["gzip", "deflate"].includes(encoding)) throw Error("IP 订阅使用不支持的压缩格式");
      // Pt enforces the limit again after decompression.
      body = new Response(body).body.pipeThrough(new DecompressionStream(encoding));
    }
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("transfer-encoding");
    return new Response(body, { status, headers });
  } catch (error) {
    throw Error(
      signal.aborted
        ? "订阅请求超时（12 秒）"
        : "IP 订阅连接失败：" + error.message + "；HTTPS 地址需要有效证书",
    );
  } finally {
    signal.removeEventListener("abort", abort);
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    await socket.close().catch(() => {});
  }
}
