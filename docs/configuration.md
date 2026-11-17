# 配置说明

## 入口

本包入口占位值是 `/YOUR_ENTRY_PATH`。部署前请统一改成你自己的安全入口，网页及服务端路由都使用该路径。

先在 `worker.js` 中将所有 `/YOUR_ENTRY_PATH` 路径统一替换为新路径，例如 `/my-sub`。只修改服务端或只修改网页会造成登录、保存或订阅接口不一致。替换后部署，并按部署文档验证。文件顶部的英文注释说明了需要修改的入口。

## 管理与订阅密钥

在 `src/backend.js` 中搜索以下参数声明，修改后运行 `node scripts/build.mjs`。也可直接修改生成的 `worker.js`，但下次构建会覆盖直接修改：

```js
var gs = "YOUR_MANAGEMENT_KEY",
    Nn = "YOUR_SUBSCRIPTION_KEY";
```

- `gs` 是管理密钥，用于登录及管理会话。
- `Nn` 是订阅密钥，用于固定订阅地址的 `token`。

例如可以分别修改为：

```js
var gs="YOUR_MANAGEMENT_KEY",Nn="YOUR_SUBSCRIPTION_KEY"
```

选择不同的随机字符串，修改后重新部署。直接修改字符串时避免未转义的引号和反斜杠。修改管理密钥会使旧登录会话失效；修改订阅密钥后需要更新客户端订阅地址。

当前单文件版本将密钥写在代码常量中，不会从 Cloudflare 的变量或 Secret 自动读取；仅在控制台新增 Secret 不会改变程序行为。公开仓库应保留示例值，实际密钥不要提交到公开 Git 历史。

## KV 数据

Worker 通过 `env.CONFIG` 访问 KV：

- `config`：订阅来源、导入文件快照、本地内容列表 `imports`、分流规则和默认路由设置，无过期时间。上传或粘贴后点击“保存配置”，重开页面会重新读取这些内容。
- `source:<hash>`：订阅节点缓存；代码设置约七天的过期时间。

程序对新 KV 使用空来源及默认路由。添加来源后的数据只保存在绑定的 KV，不会回写 `worker.js` 或 GitHub 仓库。

每份本地内容最多 500 KB，最多 30 份，内容合计最多 1.5 MB。备用文件另按原有 1.5 MB 上限处理。上传文件与粘贴节点转换为规范节点内容保存，保留名称和节点凭据，不保留完整 Clash 配置中原有的 DNS、规则、注释等非节点字段；订阅输出使用本面板的路由设置。

独立本地内容按列表顺序接在在线来源和旧 `yaml` 内容之后。移除前面的来源或本地内容会改变后续来源编号，已有按来源或节点名称指定的分流规则需要相应检查。

## IP 来源限制

公网 IP 订阅使用 `cloudflare:sockets` 直连原地址与端口，不经过第三方代理，不关闭 TLS 校验。超时为 12 秒，重定向目标也会重新校验公网地址。Cloudflare 平台禁止的目标（包括 Cloudflare 自有 IP 段）、上游网络限制和无有效证书的 HTTPS IP 地址仍可能失败。失败时继续沿用原有在线缓存或已保存的来源备用文件，并显示提示。

参考：[Cloudflare TCP sockets](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)、[Workers 已知限制](https://developers.cloudflare.com/workers/platform/known-issues/)。

## 实例独立性

Worker 名称、KV 命名空间名称及自定义域名可自行选择。每个独立实例应绑定不同的 KV。`CONFIG` 是必须保持一致的绑定变量名。
