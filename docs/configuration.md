# 配置说明

## 入口

本包入口占位值是 `/YOUR_ENTRY_PATH`。部署前请统一改成你自己的安全入口，网页及服务端路由都使用该路径。

先在 `worker.js` 中将所有 `/YOUR_ENTRY_PATH` 路径统一替换为新路径，例如 `/my-sub`。只修改服务端或只修改网页会造成登录、保存或订阅接口不一致。替换后部署，并按部署文档验证。文件顶部的英文注释说明了需要修改的入口。

## 管理与订阅密钥

在 `worker.js` 中搜索以下带英文提示的参数声明：

```js
var gs="YOUR_MANAGEMENT_KEY", // Change this to your own management key.
Nn="YOUR_SUBSCRIPTION_KEY", // Change this to your own subscription key.
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

- `config`：订阅来源、导入文件快照、分流规则和默认路由设置。
- `source:<hash>`：订阅节点缓存；代码设置约七天的过期时间。

程序对新 KV 使用空来源及默认路由。添加来源后的数据只保存在绑定的 KV，不会回写 `worker.js` 或 GitHub 仓库。

## 实例独立性

Worker 名称、KV 命名空间名称及自定义域名可自行选择。每个独立实例应绑定不同的 KV。`CONFIG` 是必须保持一致的绑定变量名。
