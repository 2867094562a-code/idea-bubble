# 部署指南

## 基础部署

应用是标准 Next.js App Router 项目，API 路由要求 Node.js runtime。部署环境需要：

- Node.js 20.9+；
- 可写临时目录（依赖库生成文件时使用）和足够内存完成字体子集化/PDF 排版；
- `public/fonts/NotoSansCJKsc-Regular.otf` 被包含在服务端产物中；
- 按需配置 AI Provider 环境变量。

本地生产检查：

```bash
npm ci
npm run verify
npm run start
```

## Vercel

1. 导入仓库并保持项目根目录为本目录。
2. 在 Project Settings → Environment Variables 配置 `.env.example` 中需要的变量。
3. 保留 `next.config.ts` 中的字体 output tracing 和服务端外部包配置。
4. 部署后验证 `/api/ai/status`、一次 Mock/真实发散，以及包含中文的 DOCX、PDF、TXT 下载。

在无 Key 的预览环境设置 `AI_PROVIDER=mock`，可获得零外部调用的完整演示。

Vercel Functions 的请求和非流式响应存在 4.5 MB payload 上限。本项目把 Function JSON 控制在 4.25 MB 内：静态图片最大 3 MB，导出预览不上传图片 data URL，正式导出会在浏览器端按 UTF-8 字节数预检。更大的素材需要改为 Blob/S3 直传和异步导出，不能直接提高应用内的请求上限。

## 上线前必须补强

当前 MVP 的项目数据在访问者浏览器中，API 路由没有用户身份。公开上线前至少需要：

- 身份认证与项目级授权；
- 反向代理/平台级限流和请求体限制；
- 对自定义 AI Base URL 采用服务端域名白名单；
- CSP、Origin/CSRF 策略和安全响应头；
- 数据库、对象存储、备份与删除策略；
- 隐私政策，说明图片会在用户点击分析后发送给所选模型 Provider；
- 错误监控、模型成本记录和导出耗时监控。

## 横向扩容

当前限流与幂等记录位于单个 Node.js 进程内。多实例环境应迁移到 Redis/KV。大型导出、视频抽帧和持久下载应放入队列，生成文件写入 Blob/S3，再返回有过期时间且绑定用户的签名 URL。
