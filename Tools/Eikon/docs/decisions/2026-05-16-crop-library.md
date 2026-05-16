# 决策记录：裁剪库选型（Cropper.js v2 vs 自建 Konva）

日期：2026-05-16
状态：待定（暂维持 Cropper.js v2，后续按需重估）

## 背景

证件照页的裁剪当前用 **Cropper.js v2**（薄封装于 `src/lib/core/cropper.ts`）。
使用中发现：库**无内置裁剪框边界钳制**，官方文档唯一方案是在 `change`
事件里 `preventDefault`——该方案的固有副作用是裁剪框拖到边界后与指针
"较劲"，表现为图像容器卡死/拖动顿挫。

已采用的缓解：取消越界变更后立即用 `selection.$change()` 应用夹取到边界
（并保持锁定比例）的修正矩形，使裁剪框沿边界平滑滑动而非冻结。问题已
缓解，但本质是对库能力缺口的补丁。

## 选型调研（2026-05-16 实测最新维护状态）

| 方案 | 版本/最近更新 | 评估 |
|---|---|---|
| Cropper.js v2（现状） | 2.1.1 / 2026-04 | 活跃维护；免费 OSS vanilla 裁剪库里功能最全之一。缺口：无内置边界钳制 |
| react-easy-crop | 5.5.7 / 2026-03 | 现代、维护良好，但仅 React，与本项目 Svelte 栈不兼容 |
| croppie / smartcrop | 2022 起停滞 | 淘汰 |
| Pintura (@pqina) | 8.97 / 2026-04 | 业界最强裁剪编辑器，体验最佳——但商业付费授权，非开源 |

结论：在「免费 + 开源 + vanilla + 持续维护」约束下，Cropper.js v2 已是
最优档，无明显更好的免费替代；更精致者为付费 Pintura。

## 备选方案：基于 Konva 自建裁剪

本项目图片工具页已依赖 **Konva**（10.3，活跃维护）。Konva 的
`Transformer.boundBoxFunc` 与节点 `dragBoundFunc` 提供**框架原生、平滑、
内置**的边界约束，从根本上不存在 Cropper.js 的 change 取消式卡死类问题。

优点：
- 边界约束为框架原生能力，平滑无卡死，彻底消除该类 bug
- 与图片工具页同一技术栈，可移除 `cropperjs` 依赖，依赖更少
- 缩放/旋转/比例锁/导出完全自控，契合第一性原理

代价：
- 旋转/缩放/比例锁/按目标 px 导出等逻辑需自行实现并长期维护，
  工作量明显大于当前薄封装
- 需自测覆盖各比例/大图/旋转后导出的像素正确性

## 迁移可行性

`src/lib/core/cropper.ts` 对外接口为 `CropperHandle`
（`mount/setAspectRatio/rotate/zoom/recenter/reset/renderTo/destroy`）。
若重写，保持该接口不变即可平滑替换，`CropCanvas.svelte` 等消费方零改动。

## 建议

- 维持现状：Cropper.js v2 在维护、够用，钳制补丁已解决卡死——**默认不换**。
- 触发重估的条件：裁剪体验被列为核心、或再次出现库能力缺口导致的
  补丁累积时，按本文件「备选方案」用 Konva 重写。

## 待决

由维护者后续评估是否启动 Konva 重写；如启动，新建实施计划并保持
`CropperHandle` 接口契约不变。
