# 架构说明

## 核心闭环

```text
项目资料 / 文字 / 图片
          ↓
  AI 发散（严格 10 项）
          ↓
 React Flow 气泡画布
          ↓ 用户显式收集
      创意总结草稿
          ↓ 编辑 / 保存版本
      完整项目计划
          ↓ 编辑 / 保存版本
统一 ExportDocument → DOCX / PDF / TXT / Markdown / JSON
```

AI 结果和用户选择分开存储：气泡的 `collected` 是人的判断；总结与计划保留 `sourceNodeIds` 便于回溯，但导出层会移除这些内部标识。

## 分层

### 界面层

`src/components/idea-bubble-app.tsx` 负责阶段编排。画布、收集栏、总结编辑器、计划编辑器、媒体入口、模型设置和导出面板各自独立。桌面端使用三栏布局，移动端把辅助区域变成 Sheet/Dialog。

### 项目状态与持久化

Zustand store 是浏览器内的工作流状态源。用户更改进入带时间合并的自动保存；项目仓库通过 `idb` 写入 IndexedDB。撤销/重做只维护当前会话中的项目快照，不会把 UI 临时状态写入领域对象。

`Project` 是唯一项目持久化边界：项目资料、原始输入、素材 data URL、节点/边、当前草稿、版本、导出预设和非敏感请求日志可以保存。当前阶段、面板开关、loading 状态和 AI Provider 配置不属于项目。

### 浏览器级 BYOK 配置

Provider、API Key、OpenAI-compatible Base URL 和五类任务模型保存在当前 Origin 的 localStorage 中。它是独立于 `Project` 的浏览器级配置：

- 新建、复制、切换或删除项目不会复制或删除配置；
- 项目完整备份和恢复不携带配置；
- DOCX/PDF/TXT/Markdown/JSON 与预览不携带配置；
- 不同 BrowserContext、浏览器配置文件、Preview URL、生产域名和自定义域名互不共享；
- “清除本地配置”删除该 Origin 的设置并恢复 Mock。

配置不用 Cookie 保存，因为 Cookie 会自动随同源请求上传。localStorage 也不是安全保险箱；它只是避免浏览器自动把值发送到服务器，仍可能被同源 XSS、恶意扩展或共享电脑上的其他使用者读取。

### AI 调用

Mock 是干净浏览器的默认 Provider，不需要外部服务或密钥。真实 AI 采用浏览器直连：

```text
用户操作
  ↓
读取本 Origin 的 BYOK 配置
  ↓ 校验 Provider / Key / 当前任务模型 / HTTPS Base URL
浏览器 fetch → 用户选择的 Provider
  ↓
响应 Schema 校验、去重与安全错误映射
  ↓
Zustand / IndexedDB Project（仅保存生成结果，不保存配置）
```

Idea Bubble 的 Next.js/Vercel API 不接收或代理真实 AI 请求，不读取部署方 API Key，也不选择真实模型。每个任务只使用用户为该任务填写的模型：`expand`、`summary`、`plan`、`prompt`、`vision`。

浏览器层继续负责：

- 请求互斥、取消和超时；
- 结构化输入和输出校验；
- 发散结果去重与严格 10 项约束；
- 网络、CORS、认证、额度和格式错误的安全中文提示；
- 防止旧项目/旧请求的响应污染当前项目；
- 禁止 Key 出现在 URL、同源请求、日志和错误信息中。

浏览器直连无法提供平台级共享限流和幂等。费用、配额与 Provider 侧速率限制由用户自己的账户承担；界面通过 busy 状态和请求互斥避免重复点击。

### 导出服务

客户端把项目快照、Preset 和同一批次时间发给导出 Route Handler。`buildExportDocument` 负责：

1. 清洗用户文本与文件名；
2. 按勾选顺序构建非空章节；
3. 解析当前草稿/最终版本优先级；
4. 删除内部 ID、AI 日志和 Provider 信息；
5. 统一封面、元数据、版式与素材描述。

实时预览、DOCX、PDF、TXT、Markdown 和 JSON 都消费同一个模型，因此章节选择和内容不会各自漂移。导出 Route Handler 只接收项目导出数据，绝不能接收 BYOK 配置。

## 关键约束

- 单项目最多 200 个节点，避免画布与 IndexedDB 无边界增长。
- 静态图片 3 MB、GIF 8 MB、视频 25 MB；当前持久化为 data URL，适合演示而非大规模素材库。
- 图片分析只在用户主动触发时直发所选 Provider；视频/GIF 分析明确不支持。
- 自定义 AI Base URL 只接受 HTTPS，并依赖目标服务允许浏览器 CORS。
- PDF/DOCX 使用随项目分发的 OFL 字体，避免依赖部署机器系统字体。

## 安全与信任边界

- Vercel/GitHub 构建产物和环境变量中没有用户 API Key。
- Idea Bubble 云端不会收到用户 Key；所选 Provider 或用户自建网关会收到 Key 与本次任务内容。
- Key 掩码不是加密。发生 XSS、依赖供应链攻击或恶意扩展时，浏览器内 Key 可能泄露。
- 用户应使用低权限、有限额、可撤销的专用 Key，并在共享电脑上及时清除配置。
- 第三方 Provider 禁止浏览器 CORS 时，不能通过公共云代理绕过而仍声称 Key 没有上传到 Idea Bubble。

## 建议的后续演进

1. 为 IndexedDB 项目与 localStorage AI 配置增加显式 schema 版本和迁移。
2. 增加严格 CSP、依赖审计和前端错误脱敏回归，降低本地 Key 被脚本读取的风险。
3. 用 Blob/S3 和异步队列处理大型素材与导出，但继续保持 BYOK 与项目数据隔离。
4. 若未来加入账号同步，默认仍不上传 Key；任何加密同步必须另行设计、明确告知并由用户主动选择。
