# Kimari 订阅管理与转换

一个可在 Cloudflare Workers 手动部署的订阅管理网页。管理界面、订阅解析与转换逻辑都包含在 `worker.js`，无需前端构建或额外上传静态文件。

## 文件

- `worker.js`：从本次部署所用程序完整导出的单文件源码，包含内嵌管理网页与 YAML 处理代码。
- `docs/manual-deployment.md`：Cloudflare 控制台手动部署、绑定 KV、域名设置与验证步骤。
- `docs/configuration.md`：入口、管理密钥、订阅密钥及数据保存方式。
- `SOURCE-NOTES.md`：源码来源和打包范围。
- `.gitignore`、`.gitattributes`：Git 仓库基础配置。

## 快速部署

1. 在 Cloudflare 创建 Worker，例如 `kimari-sub5`。
2. 编辑代码，用本项目 `worker.js` 的全部内容替换默认代码，点击部署。
3. 创建独立 KV 命名空间，例如 `sub5-kimari-config`。
4. 给 Worker 添加 KV 绑定：变量名 **`CONFIG`**，选择刚创建的命名空间。
5. 在 Worker 的域页面添加自定义域名，例如 `sub5.kimari.top`。
6. 打开 `https://sub5.kimari.top/YOUR_ENTRY_PATH`，输入管理密钥。

本包使用占位值：入口 `/YOUR_ENTRY_PATH`，管理密钥 `YOUR_MANAGEMENT_KEY`，订阅密钥 `YOUR_SUBSCRIPTION_KEY`。部署前必须统一替换为你自己的入口和密钥；修改方法见[配置说明](docs/configuration.md)。

完整操作见[手动部署说明](docs/manual-deployment.md)。

## 使用

登录后添加订阅地址或单节点链接，每行一个；也可粘贴 Clash YAML / JSON 节点、导入本地订阅文件。点击“检查来源 / 预览”，检查节点后保存配置，再将页面生成的固定订阅地址导入客户端。

程序支持 Clash YAML、Base64 订阅，以及 SS、VMess、VLESS、Trojan、Hysteria2、TUIC 等节点。包含国内直连、默认服务分组和自定义分流；具体支持范围以当前程序解析结果为准。

新 KV 为空，首次打开使用默认配置。**本包未包含任何已有站点的订阅来源、节点凭据或 KV 数据。**

## 上传 GitHub

先解压压缩包，将项目文件夹中的内容作为仓库根目录上传：根目录应直接显示 `README.md` 和 `worker.js`，并保留 `docs/`。GitHub 网页上传源码时应上传解压后的文件，不要只上传 ZIP；ZIP 也可以作为 Release 附件。

GitHub 仅用于保存源码。本项目的运行环境是 Cloudflare Workers + KV，不能直接作为 GitHub Pages 静态网页运行。
