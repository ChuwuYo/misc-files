# 方寸 Eikon

隐私优先、**纯本地**的证件照与图片工具。所有处理都在浏览器内完成（Canvas /
WASM），图片**永不上传**、不依赖任何后端或第三方云。

- **证件照**：上传 → 23 个中外标准尺寸库（可搜索 / 手风琴 / 自定义 mm·px·dpi）
  → Cropper.js 裁剪（边界夹取）→ 白/蓝/红/自定义底色 → AI 抠图换底（本地
  自托管、离线）→ 单张导出 / 六寸排版拼图
- **图片工具**：降采样代理实时预览（Konva 缩放/拖拽）→ 调整（亮度/对比度/
  饱和度/色相/色温/黑白）→ 锐化（pica USM）→ 无损(PNG·oxipng)/高质(JPEG·
  mozjpeg) 压缩与下载

## 快速开始

```bash
bash scripts/dev.sh      # 零前提一键启动：自举 bun、装依赖、同步离线模型、起 dev
# 或（bun 已在 PATH 时）
bun install && bun run start
```

打开终端打印的地址（默认 http://localhost:5173）。

## 脚本

| 命令 | 作用 |
|---|---|
| `bun run dev` / `bun run start` | 开发服务器（start 走 `scripts/dev.sh`） |
| `bun run build` / `bun run preview` | 生产构建 / 预览 |
| `bun run check` | svelte-check + tsc 类型检查 |
| `bun run lint` / `bun run fix` | oxlint 检查 / oxlint --fix + biome 格式化 |
| `bun run qa` | lint + 格式校验 + 类型检查一把过 |
| `bun run sync:imgly` | 同步离线 AI 抠图模型到 `public/imgly/`（~81MB） |

技术栈：Vite 8 · Svelte 5（runes）· TS · 包管理 **bun** · lint **oxlint** ·
format **biome** · 图标 IconaMoon（unplugin-icons，离线内联）。

## 架构（第一性原理 + 模块化）

单向数据流，严格分层 `domain ← core ← state ← components/pages`：

- **`src/lib/domain/`** — 纯数据与类型（尺寸库、格式墙、常量），无副作用
- **`src/lib/core/`** — 纯能力模块，**不依赖 Svelte/UI**：`cropper` `background`
  `compose` `pipeline` `compress` `adjust` `proxy` `preview-pipeline` `export`
- **`src/lib/state/`** — runes 单例，UI↔core 唯一中介：`editor` `tools`
  `route` `theme`
- **`src/lib/components` / `pages`** — 薄壳，只渲染与转发事件
- **`src/styles/`** — DESIGN.md token + 双主题（亮 Solarized / 暗官方 dark）
  + GitHub 式中性色阶

重型依赖（@imgly、jSquash、pica、Konva、Cropper.js）全部**懒加载 + 路由级
代码分割**，初始包 ~20KB gzip。

## 隐私 / 离线

- 图片仅 `createObjectURL` + Canvas/WASM 本地处理，无任何上传或网络发送
- AI 抠图模型自托管在 `public/imgly/`（gitignore，`bun run sync:imgly`
  重建），运行时零 CDN，完全离线

## 文档

- `docs/DESIGN.md` — 设计系统（getdesign「figma」体系，token / 双主题来源）
- `docs/decisions/` — 选型与架构决策记录（如裁剪库 Cropper.js vs Konva）
- `docs/superpowers/specs/` — 设计规格（spec）
- `design-preview/` — 设计参考站点快照（不参与构建）

详见各目录。
