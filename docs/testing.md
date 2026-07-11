# 测试策略

## 静态检查

```bash
npm run typecheck
npm run lint
npm run format:check
```

## 单元与集成测试

```bash
npm run test
```

覆盖重点：

- 发散输入/输出 Schema、去重和严格 10 项；
- Mock 的确定性；
- 收集阈值、撤销/重做和项目状态；
- `ExportDocument` 章节过滤、不修改原项目、不泄露内部 ID；
- 文件名清洗与 Windows 保留名；
- DOCX ZIP 头、文件体积、Mammoth 中文解析；
- PDF `%PDF-` 头、PDF.js 中文解析；
- TXT UTF-8 BOM 与中文内容。

## 浏览器端到端

首次运行安装 Chromium：

```bash
npx playwright install chromium
npm run test:e2e
```

如果受限网络无法下载 Playwright 浏览器、机器已安装 Chrome，可以改用：

```bash
set PLAYWRIGHT_USE_SYSTEM_CHROME=1
npm run test:e2e
```

桌面用例真实操作完整闭环，并监听三个下载事件，随后解析下载的 DOCX、PDF 和 TXT。它还刷新页面验证 IndexedDB 恢复，并模拟 `prefers-reduced-motion: reduce`。

移动端用例使用 iPhone 13 viewport，验证项目创建、左右抽屉、文字发散、11 个节点（1 个来源 + 10 个结果）和收集栏可见性。

测试的 Web Server 强制 `AI_PROVIDER=mock`，因此结果可重复且不会产生外部费用。

## 完整验收

```bash
npm run verify
npm run test:e2e
```

`verify` 依次执行 TypeScript、ESLint、Vitest 和生产构建。导出或字体相关修改不能只看 HTTP 200，必须解析生成文件并检查中文章节。
