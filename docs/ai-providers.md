# AI Provider 与 BYOK 配置

Idea Bubble 不提供共享模型、平台 API Key 或默认真实模型。每位访问者在“模型设置”中填写自己的配置（BYOK，Bring Your Own Key）；未配置时始终使用 Mock。

## 数据流与保存位置

真实 AI 的调用链是：

```text
当前浏览器 localStorage
  └─ Provider / API Key / Base URL / 每任务模型
                     ↓ 用户触发生成
浏览器 ─────────────→ 用户所选 Provider
```

- 配置保存在当前浏览器、当前站点 Origin 的 `localStorage`，键名为 `idea-bubble:ai-config:v1`。
- 配置不是 `Project` 的一部分，不写入项目 IndexedDB、项目备份、报告导出、URL、日志或 Vercel 环境变量。
- 真实请求由浏览器直接发送给 Provider；Idea Bubble/Vercel API 不接收、代理或保存 API Key。
- API Key 会在用户执行真实 AI 任务时发送给所选 Provider，这是调用其服务所必需的。Prompt、项目上下文以及主动提交分析的图片也会发送给该 Provider。
- 更换生产域名、使用 Vercel Preview URL、切换浏览器配置文件或无痕窗口，都会得到独立配置；它们不会自动同步。

这里特意不使用 Cookie。Cookie 会自动附加到匹配的同源请求，不能满足“配置不上传到 Idea Bubble/Vercel”的约束。

## Provider 字段

支持的 Provider：

| Provider          | 需要填写                            | 说明                                                                                                                                           |
| ----------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Mock              | 无                                  | 本地演示数据，不调用外部模型                                                                                                                   |
| OpenAI            | API Key、各任务模型                 | 使用 OpenAI 固定接口                                                                                                                           |
| Google Gemini     | API Key、各任务模型                 | 使用 Google 固定接口                                                                                                                           |
| DeepSeek          | API Key、各任务模型                 | 使用 DeepSeek 固定接口                                                                                                                         |
| Xiaomi MiMo       | API Key、各任务模型、可选 Base URL  | 默认使用 `https://api.xiaomimimo.com/v1`；Token Plan 可填写专属地址；始终使用 `api-key` 认证和 Chat Completions，不依赖 JSON Schema 结构化输出 |
| OpenAI Compatible | HTTPS Base URL、API Key、各任务模型 | 用于支持 OpenAI 协议且允许浏览器跨域调用的服务                                                                                                 |

系统不会替用户猜测或写死真实模型名。以下五类任务分别保存模型名称：

| 任务    | 设置项     | 用途                             |
| ------- | ---------- | -------------------------------- |
| expand  | 灵感发散   | 严格生成 10 个不重复气泡         |
| summary | 概念总结   | 收束已收集灵感                   |
| plan    | 项目计划   | 生成结构化执行计划               |
| prompt  | 生图提示词 | 生成中英文视觉提示词             |
| vision  | 图片分析   | 分析静态图片并生成 10 个视觉气泡 |

只需要填写实际使用的任务模型。执行某项任务时若其模型为空，界面会要求补充，不会借用部署方模型，也不会把其他 Provider 的凭据拿来重试。

## 配置步骤

1. 打开右上角“模型设置”。
2. 选择 Provider。
3. 填写自己的 API Key；OpenAI Compatible 还必须填写 HTTPS Base URL。MiMo 选择专用项即可，按量 API 使用 `sk-` Key；Token Plan 请把控制台提供的专属 Base URL 填入 MiMo 的可选字段。
4. 为需要的任务填写 Provider 中真实存在的模型名称。
5. 保存。本次配置只写入当前浏览器。
6. 发起一个低成本任务验证模型名称、额度和 CORS 是否可用。

清除配置会删除本 Origin 下的 BYOK 数据并立即恢复 Mock。删除项目、导入项目备份或切换项目不会修改 BYOK 配置。

## CORS 与浏览器兼容性

纯浏览器 BYOK 需要 Provider 接口允许当前网页 Origin 跨域请求。若 Provider 不返回合适的 CORS 响应头，浏览器会在请求层阻止调用；这不是 API Key 或模型内容错误。

必须同时满足“Key 不经过 Idea Bubble 云端”和“Provider 禁止浏览器直连”时，两者在纯网页中无法兼得。可选择：

- 使用明确支持浏览器 CORS 的 Provider/网关；
- 使用由用户自己控制的 OpenAI-compatible HTTPS 网关并配置 CORS；
- 继续使用 Mock。

不要为了绕过 CORS 把 Key 改交给公共代理。自定义 Base URL 只接受 HTTPS；使用自建网关意味着该网关能够看到 Key、Prompt 和上传内容，应由用户自行信任和保护。

## 本地密钥风险

客户端可用的 Key 必须能被网页 JavaScript 读取，因此 localStorage 不能提供 HttpOnly Cookie 级别的隔离：

- 同源 XSS、被攻陷的前端依赖或恶意浏览器扩展可能读取 Key；
- 共用同一浏览器配置文件的人可能使用已保存的 Key；
- 清除站点数据、无痕窗口结束或浏览器策略可能删除配置；
- 浏览器本地配置没有账号恢复或跨设备同步。

只使用权限和额度受限、可随时撤销的 Key；不要使用组织管理员 Key。离开共享电脑前点击“清除本地配置”，并在 Provider 控制台撤销不再使用的凭据。界面中的掩码只防止旁观者直接看到，并不等同于加密保险箱。

## 输出与错误边界

所有真实模型输出都要经过结构化 Schema 校验。发散与图片分析必须得到严格 10 个去重结果；格式错误、网络中断、CORS、401/403、额度不足和超时都会显示可重试的安全错误。

错误信息不得回显 API Key、完整 Authorization Header 或上游原始响应。Key 也不得进入请求 URL/query；跨 Provider 切换时必须使用各自保存的配置。
