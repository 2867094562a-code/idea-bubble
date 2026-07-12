# 部署指南

## 部署模型

Idea Bubble 是标准 Next.js App Router 项目。部署方只托管网页和文档导出 Route Handler，不提供真实 AI 服务：

- 不在 Vercel 配置 `OPENAI_API_KEY`、`GOOGLE_GENERATIVE_AI_API_KEY`、`DEEPSEEK_API_KEY` 或自定义 Provider Key；
- 不配置部署方默认真实模型；
- 干净浏览器始终从 Mock 开始；
- 每位访问者在浏览器中填写自己的 BYOK 配置，真实请求从该浏览器直接发往 Provider；
- 用户修改、清除或切换模型配置不需要重新构建或部署。

因此 `.env.example` 没有 AI Provider 变量。禁止通过 `NEXT_PUBLIC_*` 注入密钥；这会把值编译进客户端产物并向所有访问者公开。

## 本地生产检查

需要 Node.js 20.9 或更高版本。无需创建 `.env.local`：

```bash
npm ci
npm run verify
npm run start
```

打开 <http://localhost:3000>，在没有任何配置时先验证 Mock。若要验证真实 Provider，只在页面“模型设置”中填写测试用 Key；不要把 Key 写入终端历史、环境文件、截图或测试夹具。

## Vercel

1. 导入 GitHub 仓库，项目根目录保持为仓库根目录。
2. 使用默认 Next.js 构建命令，不添加 AI 环境变量。
3. 保留 `next.config.ts` 中导出字体的 output tracing 与服务端外部包配置。
4. 完成部署后，用一个全新的浏览器 Context 打开生产域名，确认显示 Mock 并能完成“蜂巢”主流程。
5. 在浏览器本地填入低额度测试 Key，确认真实请求直接到目标 Provider；检查同源请求和 Vercel Function 日志都不包含 Key、Base URL 或本地配置。
6. 验证包含中文的 DOCX、PDF、TXT 下载与项目刷新恢复。

如果项目之前配置过平台 API Key，应从 Vercel Project Settings 删除并重新部署。代码不会读取这些值，但保留无用生产密钥会造成误解和额外风险。

## Origin 隔离

localStorage 以 Origin（协议、域名、端口）隔离。以下地址不会共享 BYOK 配置：

- `https://example.vercel.app` 与单次 Preview URL；
- Vercel 默认域名与自定义域名；
- HTTP 本地地址与 HTTPS 生产地址；
- 不同浏览器配置文件或无痕 Context。

应选定稳定的生产域名让真实用户使用。切换域名后，需要用户在新域名重新填写配置；项目数据同样不会自动跨 Origin 迁移。

## Provider CORS

上线不代表所有 Provider 都能浏览器直连。目标接口必须允许生产 Origin 的 CORS 请求。遇到浏览器报错时检查：

- Provider 是否支持从网页调用；
- `Access-Control-Allow-Origin` 是否允许当前生产 Origin；
- 认证 Header 是否在 `Access-Control-Allow-Headers` 中；
- 自定义 Base URL 是否为有效 HTTPS 地址；
- Provider 模型名、额度和区域限制是否正确。

若增加 CSP，`connect-src` 也必须允许目标 Provider。由于 OpenAI-compatible Base URL 可由用户填写，过窄的静态 CSP 会阻断该能力；不能用一个收集用户 Key 的公共 Vercel 代理来规避此问题。

## 文档导出限制

Vercel Functions 的请求和非流式响应存在平台 payload 上限。本项目将 Function JSON 控制在 4.25 MB 内：静态图片最大 3 MB，导出预览不上传图片 data URL，正式导出在浏览器端按 UTF-8 字节数预检。

更大的素材应迁移到 Blob/S3 直传和异步导出，而不是提高应用内请求上限。对象存储演进也不得把 BYOK 配置混入项目或导出负载。

## 上线验收

- 干净浏览器无配置时默认 Mock，完整闭环可用；
- 生产构建产物中不存在 canary API Key；
- 真实 AI 请求只发往所选 Provider，不经过 `/api/ai/*` 或其他同源代理；
- URL、Cookie、同源 Headers/Body、Vercel 日志和错误监控中没有 Key；
- 项目完整备份、报告导出与恢复不包含 AI 配置；
- 第二个 BrowserContext 看不到第一个 Context 的配置；
- 移动端设置弹窗可完整填写、保存和清除；
- CORS/断网/401/畸形输出不会回显认证信息；
- DOCX、PDF、TXT 可真实打开并正确显示中文。

## 当前边界

项目与 BYOK 配置都只存在访问者浏览器中，没有账号、跨设备同步或多人协作。同一浏览器配置文件的共用者可能访问已保存的 Key；XSS、恶意扩展或被攻陷的前端依赖也可能读取 localStorage。生产环境应持续进行依赖审计、CSP 评估和错误脱敏检查，并在界面提供清晰的“清除本地配置”入口。
