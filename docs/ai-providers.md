# AI Provider 配置

## 任务模型

系统将任务分成五类，模型名全部来自环境变量：

| 任务    | 环境变量           | 用途                     |
| ------- | ------------------ | ------------------------ |
| expand  | `AI_MODEL_EXPAND`  | 严格 10 项灵感发散       |
| summary | `AI_MODEL_SUMMARY` | 收集结果的创意总结       |
| plan    | `AI_MODEL_PLAN`    | 完整结构化项目计划       |
| prompt  | `AI_MODEL_PROMPT`  | 中英文生图提示词         |
| vision  | `AI_MODEL_VISION`  | 图片分析与 10 个视觉气泡 |

`AI_PROVIDER` 决定默认 Provider。用户也可以在界面切换 Provider；服务端仍会检查对应凭据和任务模型，不能使用时自动进入 Mock。

## 示例

OpenAI：

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=...
AI_MODEL_EXPAND=你的文本模型
AI_MODEL_SUMMARY=你的文本模型
AI_MODEL_PLAN=你的文本模型
AI_MODEL_PROMPT=你的文本模型
AI_MODEL_VISION=你的视觉模型
```

Google Gemini：

```dotenv
AI_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=...
AI_MODEL_EXPAND=你的 Gemini 模型
AI_MODEL_SUMMARY=你的 Gemini 模型
AI_MODEL_PLAN=你的 Gemini 模型
AI_MODEL_PROMPT=你的 Gemini 模型
AI_MODEL_VISION=你的多模态 Gemini 模型
```

DeepSeek（OpenAI-compatible）：

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
AI_MODEL_EXPAND=你的 DeepSeek 模型
AI_MODEL_SUMMARY=你的 DeepSeek 模型
AI_MODEL_PLAN=你的 DeepSeek 模型
AI_MODEL_PROMPT=你的 DeepSeek 模型
```

自定义 OpenAI-compatible 服务：

```dotenv
AI_PROVIDER=openai-compatible
CUSTOM_AI_BASE_URL=https://your-provider.example/v1
CUSTOM_AI_API_KEY=...
CUSTOM_AI_MODEL=你的默认模型
# 任何 AI_MODEL_* 都可以覆盖上面的默认模型
```

不要为不支持图片输入的 Provider 配置 `AI_MODEL_VISION`。图片入口会在失败时展示明确错误，不会假装理解图片。

## 结构化输出与修复

所有真实模型调用通过 AI SDK 的结构化输出 API，并用 Zod 再校验一次。灵感发散先过滤与已有节点及本批次重复的词；不足 10 项时仅追加一次针对缺口数量的修复请求。修复仍失败会返回 502 和可重试标识。

总结、计划、提示词和图片分析不会盲目重试结构错误，以避免不可控成本。Provider 异常会被转换成安全的中文错误，不把上游响应或密钥暴露给浏览器。

## 服务约束

```dotenv
AI_REQUEST_TIMEOUT_MS=30000
AI_RATE_LIMIT_WINDOW_MS=60000
AI_RATE_LIMIT_MAX=24
AI_IDEMPOTENCY_TTL_MS=15000
```

这些值在服务端有最小/最大边界。限流与幂等缓存在进程内；横向扩容后应使用共享存储。

## 安全提醒

- `.env.local` 不应提交到版本库。
- 不要把密钥写成 `NEXT_PUBLIC_*`。
- 自定义 Base URL 只接受 HTTP/HTTPS，但生产环境建议仅允许 HTTPS 并配置域名白名单。
- 当前应用没有用户认证。部署到公网前，应先加认证与项目级访问控制。
