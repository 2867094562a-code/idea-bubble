# Idea Bubble / 灵感气泡

Idea Bubble 是一个可真实运行的 AI 辅助灵感系统。AI 从文字或图片发散，用户在无限画布中选择有价值的气泡，再把选择收束为可编辑的创意总结、完整项目计划和真实可打开的 DOCX、PDF、TXT、Markdown、JSON 文件。

没有 API Key 也能使用：干净浏览器默认进入确定性的 Mock 演示模式，完整闭环、持久化和文档导出都可用。真实 AI 使用 BYOK（Bring Your Own Key），由每位访问者在自己的浏览器中配置；部署方不提供 Key，也不指定模型。

## 已实现

- 新建项目：名称、类型、目标、人群、场景、要求与禁止元素；
- 灵感发散：每次严格返回 10 个不重复方向，支持继续发散、锁定、折叠、删除、撤销和重做；
- 人工选择：单击气泡收集/取消，达到可调阈值后由用户主动触发总结；
- 创意与计划：可编辑、可保存版本、可恢复，并保留来源节点关联；
- 素材：图片、GIF、视频本地预览与持久化；静态图片可使用用户配置的视觉模型生成 10 个气泡；
- 导出：统一 `ExportDocument` 驱动实时预览和五种格式；DOCX/PDF/TXT 是真实文件；
- 本地历史：IndexedDB 自动保存项目，刷新后恢复，可切换、备份和删除；
- 浏览器级 BYOK：Provider、Key、Base URL 与五类任务模型保存在当前 Origin 的 localStorage；
- 响应式界面：桌面三栏工作台、移动端抽屉；支持键盘焦点与减少动态效果偏好。

## 快速开始

需要 Node.js 20.9 或更高版本。

```bash
npm ci
npm run dev
```

打开 <http://localhost:3000>。不需要 `.env.local`，默认 Mock 不调用外部 AI。

生产构建：

```bash
npm run build
npm run start
```

## 配置自己的 AI

在页面右上角打开“模型设置”：

1. 选择 Provider；
2. 填写自己的 API Key；
3. OpenAI Compatible 还需要填写 HTTPS Base URL；
4. 为需要使用的任务填写模型名称；
5. 保存后执行一个任务验证额度、模型名和 CORS。

系统不写死真实模型。五类模型分别对应：

| 任务      | 用途       |
| --------- | ---------- |
| `expand`  | 灵感发散   |
| `summary` | 概念总结   |
| `plan`    | 项目计划   |
| `prompt`  | 生图提示词 |
| `vision`  | 图片分析   |

支持 OpenAI、Google Gemini、DeepSeek、OpenAI-compatible 和 Mock。缺少当前任务的 Key、模型或有效 Base URL 时，应用会要求补全配置，不会借用部署方凭据或默认模型。

### 配置边界

- 配置保存在 `localStorage`，不是 Cookie。Cookie 会自动随同源请求上传，不符合本项目的本地配置要求。
- 真实 AI 请求从浏览器直接发送给所选 Provider，不经过 Idea Bubble/Vercel AI 代理。
- Key 不进入项目 IndexedDB、项目备份、报告导出、URL、日志、GitHub 或 Vercel 环境变量。
- Key 和本次任务内容会发送给所选 Provider；图片只在用户主动分析时发送。
- 配置按浏览器配置文件和 Origin 隔离。Preview URL、生产域名、自定义域名、无痕窗口与另一台设备不会共享。
- 点击“清除本地配置”可删除当前 Origin 的 BYOK 设置，不会删除项目。

纯浏览器调用依赖 Provider 允许 CORS。若目标接口禁止浏览器直连，需要使用用户自己控制且支持 CORS 的 HTTPS 网关，或继续使用 Mock；不能用收集 Key 的公共云代理同时声称 Key 没有上传。

localStorage 不是密钥保险箱：同源 XSS、恶意扩展、被攻陷的依赖或共享电脑上的其他使用者可能读取 Key。建议使用低权限、有限额、可撤销的专用 Key，并在共享电脑上及时清除。详细说明见 [AI Provider 与 BYOK 配置](docs/ai-providers.md)。

## 部署

Vercel 不需要任何 AI Provider、API Key 或模型环境变量。导入仓库并使用默认 Next.js 构建即可；每位用户的模型设置发生在其浏览器中，更改配置不需要重新部署。

部署后必须用干净 BrowserContext 验证默认 Mock，并用 sentinel/fake Provider 拦截验证真实 BYOK 请求只去目标 Provider、同源请求不包含 Key。完整步骤见 [部署指南](docs/deployment.md)。

## 导出

导出面板可选择内容、顺序、A4 横纵向、封面、目录、页眉页脚、页码、素材和多个文件格式。所有渲染器消费同一份清洗后的 `ExportDocument`，不会把内部节点 ID、AI 日志、Provider、模型名或 API 配置写进报告。

- DOCX：标准 OOXML，嵌入按本次文档字符子集化的 Noto Sans CJK SC 字体；
- PDF：PDFKit 直接排版，中文可复制和检索；
- TXT：UTF-8 BOM，兼容 Windows 记事本和常见办公软件；
- Markdown / JSON：便于二次编辑与系统集成。

实现与字体注意事项见 [文档导出](docs/document-export.md)。

## 验证

```bash
npm run typecheck
npm run lint
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
```

测试覆盖完整主流程、严格 10 个气泡、重复点击与断网、项目刷新恢复、移动端、减少动态效果、真实文件解析，以及 BYOK 本地持久化、跨 Context 隔离、同源网络负断言、备份/导出隔离和构建密钥扫描。详见 [测试策略](docs/testing.md)。

## 项目结构

```text
src/components       画布、收集栏、编辑器、模型设置、媒体、导出与壳层界面
src/lib/ai           浏览器 Provider 适配、Prompt、结构化生成、Mock 与校验
src/lib/export       统一文档模型、清洗、字体与各格式渲染器
src/lib/repository   IndexedDB 项目仓库
src/store            Zustand 工作流状态、版本和撤销/重做
src/app/api/export   预览和 DOCX/PDF/TXT/Markdown/JSON 导出
tests/e2e            完整闭环、BYOK 隐私边界与移动端测试
```

设计边界、数据流和扩展点见 [架构说明](docs/architecture.md)。

## 当前边界

- 项目保存在当前浏览器的 IndexedDB，BYOK 配置保存在当前 Origin 的 localStorage；没有账号、跨设备同步或多人协作；
- 图片可由用户配置的视觉模型分析；视频/GIF 目前只做本地保存与预览，并明确返回不支持；
- Provider 必须支持浏览器 CORS；不支持时无法在“不经过 Idea Bubble 云端”的前提下直连；
- 自然语言“补充导出要求”会保留在导出文档中，但首版不会声称理解任意排版指令；
- DOCX 目录由 Word 更新，服务端不伪造未知页码；
- 导出是同步请求，适合 MVP 体量；大项目应迁移到对象存储、异步队列和带权限的下载链接，但仍不得混入 BYOK 配置。

更多说明：

- [AI Provider 与 BYOK 配置](docs/ai-providers.md)
- [Mock 模式](docs/mock-mode.md)
- [测试策略](docs/testing.md)
- [部署指南](docs/deployment.md)
- [协作约定](AGENTS.md)

## 主要技术

Next.js App Router、React、TypeScript、Tailwind CSS、shadcn/ui、React Flow、Zustand、IndexedDB、Vercel AI SDK、Zod、docx、PDFKit、Vitest、Playwright。
