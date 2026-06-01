# 决策记录：移除 AI 抠图换底功能

日期：2026-05-17
状态：已决（完全移除）

## 背景

证件照页此前在「白/蓝/红/自定义底色」之后接入了一条 **AI 抠图换底**
流水线，依赖 `@imgly/background-removal`：

- 自托管模型与运行时资源在 `public/imgly/`，约 **76MB** 离线包
- 构建期通过 `scripts/sync-imgly.mjs` 从 CDN 同步并做版本对齐
- 模型推理需要 **SharedArrayBuffer**，因此 dev/preview/prod 全链路注入
  COOP/COEP 头以启用 WASM 多线程
- 默认模型为 `isnet_quint8`（量化版，体积最小）

## 决定

**完全移除 AI 抠图换底功能**。证件照换底回退到「纯本地、纯手动」
路径：直接用所选底色填充裁剪后图像背景，不再做人像分割。

## 原因

1. **模型质量不达标**——维护者实测当前 `isnet_quint8` 在常见证件照
   场景（头发边缘、深色衣物贴近背景等）的抠图质量不足以达到
   「可直接产出」的标准，仍需人工修补，违背「一键出图」初衷。
2. **维护成本与收益不匹配**——为支撑该单一功能引入的负担：
   - 模型版本对齐脚本（与 `@imgly` 主包版本耦合，升级需联动）
   - 构建期 CDN 同步（脱机首跑/CI 依赖网络）
   - ~76MB 离线资源（仓库体积、缓存、首次拉取时间）
   - SharedArrayBuffer 头要求（COOP/COEP 污染整站，限制第三方嵌入与
     某些预览场景）
3. **替代路径已足够**——纯色填充 + 裁剪边界夹取的手动换底，覆盖了
   绝大多数证件照刚性需求；用户若需高质量抠图，外部专业工具更稳。

## 影响

需要删除/清理的范围：

- `src/lib/core/background.ts`——AI 抠图能力模块（懒加载 @imgly）
- `scripts/sync-imgly.mjs`——构建期模型同步脚本
- `public/imgly/`——自托管模型与运行时资源（约 76MB）
- 证件照 SidePanel 内的 AI 抠图 UI 块（开关、进度、模型说明等）
- `src/lib/state/editor` 内与 AI 抠图相关的状态字段（任务状态、产出
  缓存等）
- `package.json` 中 `@imgly/background-removal` 依赖与 `sync:imgly` 脚本
- `vite.config.ts` / dev 服务器中为 SharedArrayBuffer 注入的
  COOP/COEP 头（若仅为该功能服务则一并回退）
- README / 文档中对 AI 抠图的所有描述

## 后续

若未来重启此功能（例如更换为质量更高的模型，或社区出现轻量级
开源替代），请回溯本文件了解上次接入的完整代价与移除原因，并优先
评估：模型质量基线、离线包体积、是否仍需 SharedArrayBuffer、是否
影响站点同源策略。

相关历史：见 commit `de555ac`（添加 COOP/COEP 头以支持 WASM 多线程）、
`cbdb657`（改用 CDN 同步 imgly 数据）。
