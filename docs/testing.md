# 测试策略

## 静态检查

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
```

生产构建不得依赖 AI Provider 环境变量。`.env.example` 不包含部署方 Key 或模型，源码中也不得出现 `NEXT_PUBLIC_*_API_KEY`。

## 单元与集成测试

```bash
npm run test
```

覆盖重点：

- 发散输入/输出 Schema、去重和严格 10 项；
- Mock 的确定性与“蜂巢”相关词；
- 收集阈值、撤销/重做和项目状态；
- 本地 BYOK 配置的默认值、标准化、保存、刷新读取、清除和损坏数据回退；
- 每个真实任务必须使用用户填写的对应模型，不存在部署方默认模型；
- OpenAI-compatible Base URL 仅接受 HTTPS，Key 不进入 URL/query；
- Provider 切换不复用其他 Provider 的凭据；
- 浏览器直连的断网、取消、超时、401/403、CORS 和畸形输出错误脱敏；
- `ExportDocument` 章节过滤、不修改原项目且不包含 Provider/模型/Key；
- 项目完整备份不包含浏览器级 AI 配置；
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

如果受限网络无法下载 Playwright 浏览器且机器已安装 Chrome：

```powershell
$env:PLAYWRIGHT_USE_SYSTEM_CHROME="1"
npm run test:e2e
```

端到端套件从空浏览器状态开始，不能依赖开发机 localStorage 或 Vercel 环境变量。Mock 主流程继续验证：

- 新建项目并输入“蜂巢”；
- 严格 10 个不同相关气泡和逐个出现；
- 收集、取消、重新收集与二层发散；
- 总结、编辑、项目计划和跳过生图提示词；
- DOCX/PDF/TXT 下载与真实内容解析；
- 刷新后从 IndexedDB 恢复项目；
- 移动端布局与 `prefers-reduced-motion`；
- 浏览器 Console 无错误。

Mock 用例不得通过 `AI_PROVIDER=mock` 环境变量制造前置条件；“干净 BrowserContext 默认 Mock”本身就是需要验证的产品行为。

## BYOK 隐私验收

使用明显的假 Key，例如 `IB_BYOK_E2E_SENTINEL_7f2c`，并通过 Playwright 拦截一个假的 HTTPS OpenAI-compatible 地址。不要使用真实凭据。必须验证：

1. 在桌面设置中填写 Provider、sentinel Key、HTTPS Base URL 和五类用户模型，保存后刷新仍存在。
2. 真实任务直接请求被拦截的 Provider URL；认证 Header 包含 sentinel，请求体使用该任务的用户模型。
3. 真实 BYOK 流程没有调用 `/api/ai/*` 或其他同源 AI 代理。
4. 收集所有同源请求的 URL、`allHeaders()`、Cookie 和 `postData()`，序列化后均不包含 sentinel、Base URL 或整份配置。
5. Provider 请求的 URL/query 不包含 Key；认证只存在于目标 Provider Header。
6. 浏览器 Console、page error、可见错误提示和下载内容不包含 sentinel。
7. 切换项目后设置仍在；项目完整备份和所有报告格式不包含 sentinel。
8. 把项目备份恢复到第二个 BrowserContext 后，第二个 Context 仍是 Mock。
9. 第二 BrowserContext、无痕 Context 或不同 Origin 不能读取第一个 Context 的配置。
10. 清除配置后 localStorage 项被删除，刷新仍为 Mock，项目数据保持不变。
11. OpenAI Key 切换到其他 Provider 时不会被复用或发送。
12. 畸形响应、断网、401、取消和重复点击不会回显 Key，也不会写坏项目。

同源网络负断言是“Key 不上传 Idea Bubble/Vercel”的硬门槛。仅检查项目 JSON 或 UI 掩码不足以证明数据边界。

## 移动端设置验收

iPhone 13 viewport 至少覆盖：

- “模型设置”按钮有稳定的可访问名称且可点击；
- Dialog/Sheet 完全位于视口内，没有水平滚动；
- 内容较长时可纵向滚动；
- API Key 使用密码输入，显示/隐藏按钮有可访问名称；
- 软键盘出现时仍能保存与清除；
- Provider、Base URL 和五类模型字段可完整编辑；
- 保存、清除和请求 busy 状态能阻止重复点击。

## 构建与密钥扫描

可以用非凭据 canary 验证旧环境变量不会进入产物。PowerShell 示例：

```powershell
$env:OPENAI_API_KEY="IB_BUILD_CANARY_NOT_A_REAL_KEY"
$env:AI_MODEL_EXPAND="owner-model-must-not-be-used"
npm run build
rg -F "IB_BUILD_CANARY_NOT_A_REAL_KEY" .next/static .next/server
Remove-Item Env:OPENAI_API_KEY
Remove-Item Env:AI_MODEL_EXPAND
```

`rg` 应无输出并以 1 退出，表示未找到 canary。随后在带这些环境变量启动的服务上打开一个干净 Context，仍应显示 Mock，证明部署方不能替用户选择模型。

不要把真实 Key 放入构建命令、CI Secret 扫描样本、Playwright trace、截图或失败报告。BYOK 测试失败时保留 trace 之前，应确认其中只有 sentinel。

## 完整验收

```bash
npm run verify
npm run test:e2e
```

`verify` 依次执行 TypeScript、ESLint、Vitest 和生产构建。导出或字体相关修改不能只看 HTTP 200，必须解析生成文件并检查中文章节。BYOK 修改不能只看 Provider 请求成功，必须同时通过同源网络负断言、跨 Context 隔离、备份/导出隔离和错误脱敏。
