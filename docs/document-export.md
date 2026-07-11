# 文档导出

## 单一文档模型

`src/lib/export/build-export-document.ts` 将 `Project + ExportPreset + exportedAt` 规范化为 `ExportDocument`。它是实时预览和全部文件格式的唯一内容源。

这一层只包含适合交付的文本、表格、列表和素材描述，不包含节点 ID、来源 ID、AI 请求日志、Provider、模型名或 API 配置。章节为空时会被省略；章节顺序与用户勾选顺序一致。

## 格式实现

### DOCX

使用 `docx` 生成标准 OOXML，包括封面、标题层级、表格、页眉页脚、页码字段、横纵向和可更新的目录字段。每次导出会收集文档实际字符并把 Noto Sans CJK SC 子集化后嵌入，因此文件无需依赖接收者机器字体，也不会嵌入完整 16 MB 字体。

### PDF

使用 PDFKit 直接排版，不通过 HTML 截图或浏览器打印。随项目分发的 `public/fonts/NotoSansCJKsc-Regular.otf` 会由 PDFKit 按使用字符嵌入，中文可复制、检索并可被 PDF.js 解析。

### TXT

使用 UTF-8 BOM（`EF BB BF`），保留清晰的标题、列表和表格文本，兼容 Windows 记事本及常见办公软件。

### Markdown / JSON

Markdown 面向人工继续编辑；JSON 保留规范化文档结构，适合集成。它们与三种必选格式使用相同章节过滤结果。

## 素材

只有用户勾选“包含素材图片”时，非视频 data URL 才会进入导出请求。视频 data URL 永远不会写入文档；视频只输出名称、类型、大小和状态说明。图片解码失败时跳过图片本体并保留文字信息，不中断整个报告。

线上导出的序列化请求严格限制在 4.25 MB 以内。预览只发送素材元数据，不发送 data URL；正式下载若超过限制，会在浏览器发请求前提示关闭“包含素材图片”、减少素材或精简项目内容。这样可以避免 base64 约三分之一的体积膨胀触发托管平台的 413 错误。

## 字体许可与部署

字体来自 Noto CJK，许可文本位于 `public/fonts/OFL-NotoSansSC.txt`。`next.config.ts` 显式把 OTF 纳入 `/api/export/*` 的输出追踪，并把 `pdfkit`、`subset-font` 设为服务端外部包。

如果部署平台重新组织服务端文件，必须验证字体仍位于运行时的 `process.cwd()/public/fonts/`。部署后至少执行一次包含中文的 DOCX/PDF 下载与解析测试。

## 已知边界

- Word 的目录页码由客户端打开/更新字段后计算；服务端不会伪造未知页码。
- 自然语言补充要求作为文档备注保存，首版不将任意描述转换成未验证的排版操作。
- 同步导出适合 MVP。大素材或高并发场景应使用任务队列、对象存储和签名 URL。
