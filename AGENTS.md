# Idea Bubble 协作约定

## 产品原则

1. AI 只负责发散、归纳和结构化建议；关键选择必须由用户显式完成。
2. 不伪造能力。未实现的视频/GIF 语义理解必须返回明确的 `unsupported`/`501`。
3. 所有生成结果都必须可编辑、可追溯、可保存版本。
4. 导出必须生成真实文件，并以统一 `ExportDocument` 为唯一内容来源。

## 代码边界

- `src/lib/domain.ts` 是持久化领域模型；修改字段时要考虑 IndexedDB 中的旧项目。
- `src/store/idea-store.ts` 负责用户工作流状态，组件不应直接写 IndexedDB。
- `src/lib/ai/providers.ts` 是 Provider 和任务模型的唯一选择入口；不要在组件或 Prompt 中写死模型名。
- `src/lib/schemas.ts` 与 `src/lib/ai/schemas.ts` 是网络边界的结构约束。AI 输出进入 store 前必须再次解析。
- `src/lib/export/build-export-document.ts` 是所有导出内容的规范化入口。不要让单个渲染器自行读取 `Project`。
- API Key 只能从服务端环境变量读取，禁止使用 `NEXT_PUBLIC_*` 暴露密钥。

## 变更要求

- 新增 AI 任务时：增加任务类型、环境变量映射、Zod Schema、Mock 实现、Prompt、路由与测试。
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

导出相关变更还要确认：DOCX 可由 Mammoth 解析，PDF 可由 PDF.js 解析，TXT 前三个字节为 `EF BB BF`，并且中文章节不乱码。
