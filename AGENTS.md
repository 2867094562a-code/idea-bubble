# Idea Bubble 协作约定

## 产品原则

1. AI 只负责发散、归纳和结构化建议；关键选择必须由用户显式完成。
2. 不伪造能力。未实现的视频/GIF 语义理解必须返回明确的 `unsupported`/`501`。
3. 所有生成结果都必须可编辑、可追溯、可保存版本。
4. 导出必须生成真实文件，并以统一 `ExportDocument` 为唯一内容来源。
5. 真实 AI 必须使用访问者自己的配置；部署方不提供 Key，也不指定模型。

## 代码边界

- `src/lib/domain.ts` 是持久化领域模型；修改字段时要考虑 IndexedDB 中的旧项目。
- `src/store/idea-store.ts` 负责用户工作流状态，组件不应直接写 IndexedDB。
- AI 配置是浏览器级设置，不属于 `Project`。它只允许写入当前 Origin 的 localStorage，不得进入 IndexedDB 项目、备份、导出、URL、日志或遥测。
- Mock 是默认 Provider。真实 AI 请求必须从浏览器直接发往用户所选 Provider，禁止把 API Key、Base URL 或整份本地配置发给 Idea Bubble/Vercel API。
- 模型名称由用户按 `expand`、`summary`、`plan`、`prompt`、`vision` 分别填写；业务代码不得写死真实模型。
- Provider 直连层与 AI 输出 Schema 是网络边界。进入 store 前必须再次解析和去重。
- `src/lib/export/build-export-document.ts` 是所有导出内容的规范化入口。不要让单个渲染器自行读取 `Project`。
- 禁止使用 Cookie 保存 API Key：同源 Cookie 会自动上传到服务器。也禁止使用 `NEXT_PUBLIC_*` 注入任何密钥。

## 安全要求

- 自定义 Base URL 只接受 HTTPS；请求不得把 Key 放进 URL/query。
- 跨 Provider 切换时不得复用另一 Provider 的凭据。
- 上游错误、浏览器控制台和用户可见提示不得回显 API Key 或完整认证 Header。
- 直连请求应禁用凭据、缓存和 Referrer，并避免把认证信息带到重定向目标。
- 设置界面必须说明：localStorage 可被同源脚本、XSS、恶意扩展或共享电脑上的其他使用者读取；提供明确的“清除本地配置”操作。
- 项目备份、恢复与任意文档导出必须保持 AI 配置隔离。

## 变更要求

- 新增 AI 任务时：增加任务类型、本地模型字段、结构化 Schema、Mock 实现、直连适配、错误脱敏与测试。
- 新增 Provider 时：记录其浏览器 CORS 支持、认证 Header、固定端点或 Base URL 规则，不得增加部署方 Key。
- 新增导出章节时：扩展 `ExportSectionId`、章节构建器、预览和至少三种必选格式测试。
- 新增领域字段时：提供默认值或迁移策略，避免旧 IndexedDB 项目在 hydration 时崩溃。
- 媒体上传必须验证 MIME、大小和 data URL，且不能把视频伪装成图片分析。
- 动画必须尊重 `prefers-reduced-motion`。

## 完成前检查

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

BYOK 相关变更还要确认：干净浏览器默认 Mock；配置刷新后保留但不跨 BrowserContext/Origin；真实请求只去目标 Provider；同源请求、项目备份、导出和构建产物均不包含测试密钥。

导出相关变更还要确认：DOCX 可由 Mammoth 解析，PDF 可由 PDF.js 解析，TXT 前三个字节为 `EF BB BF`，并且中文章节不乱码。
