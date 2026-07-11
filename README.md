# Idea Bubble / 灵感气泡

一个可以真实运行的 AI 辅助灵感系统。AI 负责从文字或图片发散，用户在无限画布中选择有价值的气泡，再把选择收束为可编辑的创意总结、完整项目计划和真实可打开的 DOCX、PDF、TXT、Markdown、JSON 文件。

没有 API Key 也能运行：系统会自动使用确定性的 Mock 演示模式，完整闭环、持久化与文档导出都可用。

## 已实现

- 新建项目：名称、类型、目标、人群、场景、要求与禁止元素。
- 灵感发散：每次严格返回 10 个不重复方向；支持继续发散、锁定、折叠、删除、撤销和重做。
- 人工选择：单击气泡收集/取消，达到可调阈值后由用户主动触发总结。
- 创意与计划：可编辑、可保存版本、可恢复，并保留来源节点关联。
- 素材：图片、GIF、视频本地预览与持久化；图片可调用视觉模型生成 10 个气泡。
- 导出：统一 `ExportDocument` 驱动实时预览和五种格式；DOCX/PDF/TXT 是服务端直接生成的真实文件。
- 本地项目历史：IndexedDB 自动保存，刷新后恢复，可切换、备份与删除项目。
- 响应式界面：桌面三栏工作台，移动端抽屉；支持键盘焦点与减少动态效果偏好。

## 快速开始

需要 Node.js 20.9 或更高版本。

```bash
npm install
copy .env.example .env.local
npm run dev
```

打开 <http://localhost:3000>。默认 `.env.example` 使用 `AI_PROVIDER=mock`，不需要任何外部服务。

生产构建：

```bash
npm run build
npm run start
```

## 配置真实 AI

所有模型名称都通过环境变量注入，不写死在业务代码里。每类任务可以使用独立模型：

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=...
AI_MODEL_EXPAND=你的文本模型
AI_MODEL_SUMMARY=你的文本模型
AI_MODEL_PLAN=你的文本模型
AI_MODEL_PROMPT=你的文本模型
AI_MODEL_VISION=你的视觉模型
```

支持的 `AI_PROVIDER`：

| Provider            | 凭据                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `openai`            | `OPENAI_API_KEY`                                                  |
| `google`            | `GOOGLE_GENERATIVE_AI_API_KEY`                                    |
| `deepseek`          | `DEEPSEEK_API_KEY`，可选 `DEEPSEEK_BASE_URL`                      |
| `openai-compatible` | `CUSTOM_AI_BASE_URL`、`CUSTOM_AI_API_KEY`，可选 `CUSTOM_AI_MODEL` |
| `mock`              | 无                                                                |

如果某个任务缺少模型名、凭据或有效 Base URL，该任务会安全降级到 Mock，而不是让应用无法启动。浏览器不会接触服务端 API Key。更详细的配置和降级规则见 [docs/ai-providers.md](docs/ai-providers.md)。

## 导出

导出面板可选择内容、顺序、A4 横纵向、封面、目录、页眉页脚、页码、素材和多个文件格式。所有渲染器消费同一份经过清洗的 `ExportDocument`，不会把内部节点 ID、AI 日志或 Provider 配置写进报告。

- DOCX：标准 OOXML，内嵌按本次文档字符子集化的 Noto Sans CJK SC 字体。
- PDF：PDFKit 直接排版，使用随项目分发的 Noto CJK 字体，中文可复制和检索。
- TXT：UTF-8 BOM，兼容 Windows 记事本和常见办公软件。
- Markdown / JSON：便于二次编辑与系统集成。

实现与部署时的字体注意事项见 [docs/document-export.md](docs/document-export.md)。

## 验证

```bash
npm run typecheck
npm run lint
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
```

单元测试会解析生成的 DOCX/PDF/TXT 并校验中文章节；端到端测试会在真实浏览器中走完“创建 → 发散 → 收集 → 总结 → 计划 → 三格式下载 → 刷新恢复”，同时覆盖移动端和减少动态效果。详见 [docs/testing.md](docs/testing.md)。

## 项目结构

```text
src/app/api/ai       AI 状态、发散、总结、计划、提示词与素材分析
src/app/api/export   预览和 DOCX/PDF/TXT/Markdown/JSON 导出
src/components       画布、收集栏、编辑器、媒体、导出与壳层界面
src/lib/ai           Provider 适配、Prompt、结构化生成、Mock 与校验
src/lib/export       统一文档模型、清洗、字体与各格式渲染器
src/store            Zustand 工作流状态、版本和撤销/重做
src/lib/repository   IndexedDB 项目仓库
tests/e2e            Playwright 完整闭环与移动端测试
```

设计边界、数据流和扩展点见 [docs/architecture.md](docs/architecture.md)。

## 当前边界

- 项目数据保存在当前浏览器的 IndexedDB，没有账号、跨设备同步或多人协作。
- 图片可由真实视觉模型分析；视频/GIF 目前只做本地保存与预览，接口明确返回“不支持”，不会伪造语义理解。
- 自然语言“补充导出要求”会被保留在导出文档中，但首版不会声称理解任意排版指令。
- DOCX 目录是可由 Word 更新的目录字段；服务端不伪造未知页码。
- 导出是同步请求，适合 MVP 体量；大项目生产化应迁移到对象存储、异步队列和带权限的下载链接。

更多说明：

- [Mock 模式](docs/mock-mode.md)
- [测试策略](docs/testing.md)
- [部署指南](docs/deployment.md)
- [协作约定](AGENTS.md)

## 主要技术

Next.js App Router、React、TypeScript、Tailwind CSS、shadcn/ui、React Flow、Zustand、IndexedDB、Vercel AI SDK、Zod、docx、PDFKit、Vitest、Playwright。
