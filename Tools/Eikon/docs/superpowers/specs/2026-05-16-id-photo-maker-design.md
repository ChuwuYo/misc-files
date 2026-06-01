# 证件照制作网页 — 设计文档

日期：2026-05-16
状态：**部分已废止** — 本文档为按日期冻结的历史规格快照。
其中所有关于「AI 抠图换底 / @imgly / core/background.ts / editor.cutout* / isnet_quint8 /
WebGPU 回退 / `抠图库` 选型」的内容已于 2026-05-17 整体移除，
详见 [`docs/decisions/2026-05-17-remove-ai-cutout.md`](../../decisions/2026-05-17-remove-ai-cutout.md)。
其余章节（裁剪、尺寸库、背景色板、导出、排版、双主题、隐私模型）仍反映当前实现。

## 1. 目标

浏览器端、纯本地、隐私安全的专业证件照工具。用户上传照片 → 选标准尺寸 → 裁剪 →
（可选）AI 换底 → 单张导出 / 六寸排版拼图导出。无后端，无上传。

## 2. 范围

- **尺寸**：内置 23 个中外标准尺寸（常用/身份证件/护照签证/证书考试/相纸）+ 自定义
  mm·px·dpi。详见 `src/lib/domain/sizes.ts`。
- **裁剪**：锁定目标比例，缩放/旋转/居中/重置，按目标 px 精确导出。
- **背景**：白/蓝(#438edb)/红 预设 + 自定义色；AI 抠图换底（按需懒加载模型）。
- **排版**：任选标准照在五寸/六寸相纸上自动网格拼图，带裁切间距。
- **导出**：JPG/PNG，文件名含尺寸名。
- **不做**：账号、云端、批量、人脸美颜/瘦脸、PDF。

## 3. 技术栈（均为查证后的最新版）

Vite 8 · Svelte 5.55（runes）· TypeScript 6 · Cropper.js 2.1.1 ·
@imgly/background-removal 1.7 · 包管理 bun 1.3 · lint oxlint · format biome。

## 4. 架构（第一性原理 + 模块化）

单页三栏，单向数据流：UI 组件读写 `state/*`（runes 单例），`core/*` 为纯函数式
能力模块（不依赖 Svelte），`domain/*` 为无副作用数据与类型。

```
domain/   sizes.ts(尺寸库+自定义+背景常量) · types.ts(共享类型唯一源)
state/    editor.svelte.ts(源图/尺寸/背景/抠图状态) · theme.svelte.ts(主题)
core/     cropper.ts(Cropper.js v2 封装) · background.ts(@imgly 懒加载)
          compose.ts(排版网格计算+绘制) · export.ts(canvas→下载)
components/ panels/(SourcePanel·SizeLibrary·CropCanvas·SidePanel)
            ui/(Button·Panel·ThemeToggle)
App.svelte  三栏 shell + 顶栏
styles/   tokens.css(DESIGN.md token) · theme-light(Solarized) · theme-dark(官方暗色)
```

边界约定：

- `core/*` 输入输出均为 DOM/Blob/Canvas 原语 + `domain` 类型，可独立单测，
  不感知 UI 与状态。
- `state/*` 是 UI 与 `core/*` 的唯一中介；面板之间不直接通信。
- `domain/*` 纯数据，无 import 副作用。
- 组件只做渲染与事件转发，业务计算下沉到 `core/*`。

## 5. 数据流

1. `SourcePanel` 读文件 → `editor.setSource(objectURL)`。
2. `SizeLibrary` 选 spec / 自定义 → `editor.spec`；`editor.aspectRatio` 派生。
3. `CropCanvas` 监听 `editor.spec`，经 `core/cropper` 设定锁定比例渲染。
4. `SidePanel` 选背景；点 AI 换底 → `core/background.removeBackground`
   （首次动态 import 拉 ~40MB ISNet 模型，`editor.cutoutStatus` 驱动进度 UI）。
5. 导出：`cropper.renderTo(spec,bg)` → `core/export.exportCanvas`；
   排版：`core/compose.planSheet` → `composeSheet` → 导出。

## 6. 视觉系统

- Token 全量取自 `docs/DESIGN.md`：圆角 2/6/8/24/32/50/9999；间距 8px 基数；
  字体 Inter（figmaSans 替代）+ JetBrains Mono（figmaMono 替代）；阴影极少
  （描边/色块分层）；CTA 一律 pill，图标按钮圆形。
- **亮色** = Solarized Light 全亮，无任何暗色元素
  （canvas #fdf6e3 / ink #073642 / accent #268bd2）。
- **暗色** = `design-preview/preview-dark.html` 官方 dark palette 逐字落地
  （canvas #0a0a0a / surface 1 #161616 / surface 2 #1f1f1f / 反白文字分级
  0.85·0.6 / hairline rgba(255,255,255,.12) / 主色反白 #fff / magenta #ff3d8b /
  success #2ecc5b）。无蓝紫。
- 主题随系统首选项初始化，可手动切换并持久化到 localStorage。

## 7. 关键技术决策

- **抠图库**：@imgly/background-removal —— 唯一开箱即用纯浏览器方案，ISNet 模型，
  发丝边缘质量最佳；用 `isnet_quint8`(~40MB) + WebGPU，**懒加载**，不点不下载，
  保证裁剪功能秒开。
- **裁剪库**：Cropper.js v2 —— Web Components 架构，`selection.$toCanvas({width,
  height})` 可输出任意标准 px 尺寸并锁定比例，天然适配证件照。
- **排版**：纯 Canvas 2D 绘制；`planSheet` 按 mm 计算行列，`composeSheet` 平铺
  并留裁切间距，输出相纸 px 尺寸。

## 8. 错误与边界

- 非图片/超大文件：`SourcePanel` 校验类型并提示，不进入裁剪。
- 抠图失败/不支持 WebGPU：回退 CPU，`cutoutStatus="error"` 显示重试。
- 自定义尺寸非法（≤0 或过大）：表单拦截。
- 导出失败（toBlob null）：抛错并提示。
- 内存：换源/重置时 `URL.revokeObjectURL` 释放旧对象 URL。

## 9. 测试策略

- `domain`：`customSpec` mm→px 换算、尺寸库完整性。
- `core/compose`：`planSheet` 行列计算（多尺寸/相纸组合）。
- `core/export`：toBlob 调用与文件名。
- `core/cropper`、`core/background`：以 DOM/Blob 桩做接口契约测试。
- 手动验收：双主题视觉、各标准尺寸导出像素正确、六寸排版拼图、抠图换底。

## 10. 现状

骨架、依赖、工具链、token、尺寸库、双主题、组件 shell 已就位并通过
`svelte-check` / `vite build` / `oxlint`。`core/*` 为稳定接口 + stub，
待实现计划逐步填充真实逻辑。
