# 决策记录：以 MediaPipe Tasks 重启「换底」能力

日期：2026-06-02
状态：**已规划（待用户授权 Phase 0）**

相关：
- [`2026-05-17-remove-ai-cutout.md`](./2026-05-17-remove-ai-cutout.md) — 移除 @imgly
- [`2026-05-17-i18n-plan.md`](./2026-05-17-i18n-plan.md) — i18n 主 ADR（本文件追加 §6 hook）
- [`../superpowers/specs/2026-05-16-id-photo-maker-design.md`](../superpowers/specs/2026-05-16-id-photo-maker-design.md) — 原设计快照（部分废止）

## 1. 背景

2026-05-17 完整移除 @imgly/background-removal（详见上链 ADR），保留了
SidePanel 的「白 / 蓝 / 红 / 自定义」**色板 UI**。当前色板**仅作为视觉信号
存在**——没有任何路径让所选色真正影响导出，UX 与代码语义不一致。

两种解法：① 把色板降级为「相纸底色 / 边距 mat」，弱化它；② 重新接入一条
**更轻、更专、更隐私安全**的换底实现，让色板恢复完整语义。

## 2. 决定

**重新接入换底，采用 MediaPipe Tasks Vision 的 `ImageSegmenter` +
`selfie_segmenter.tflite`，全量 self-host，按需懒加载，失败优雅降级。**

色板的新语义（三合一）：

1. **替换原底色**（核心；MediaPipe 成功时）
2. **裁剪框外边距 / 相纸 mat**（永远成立的兜底）
3. **导出文件背景声明**（命名 / metadata 用）

## 3. 为什么 MediaPipe Tasks

对照 2026-05-17 ADR 的「后续评估清单」：

| 评估项 | @imgly（已移除） | MediaPipe Tasks（本提案） |
|---|---|---|
| 模型质量基线 | ISNet 通用分割，证件照场景不达标 | **Selfie Segmenter 专为人像 / 证件照设计**，Google 持续维护 |
| 离线包体积 | ~76 MB | **~11 MB**（WASM 10.6 MB + 模型 244 KB）≈ 减 86% |
| 是否需 SharedArrayBuffer | 是（COOP/COEP 污染全站） | **不需要**（IMAGE 模式无多线程依赖）— Phase 0 必须实测确认 |
| 同源策略影响 | 严重（限制第三方嵌入） | **无**（待 Phase 0 验证） |
| 维护成本 | 自写 sync 脚本 + 版本对齐 | npm 标准依赖 + 一次性 self-host 拷贝脚本 |
| 失败模式 | 模型大、加载慢、推理重 | 模型小、加载快；失败可降级 chroma-key + mat |

**核心判断**：上次错在选了「通用分割」赛道。证件照只需要**人像 vs 背景**
二分类，MediaPipe Selfie Segmenter 正是该任务的**官方专用模型**。

## 4. Bundle 实测账本（2026-06-02 探包）

| 资源 | 大小 | 来源 |
|---|---|---|
| `@mediapipe/tasks-vision@0.10.35` JS bundle | ~11 MB 未压缩（gz 估 1-2 MB） | npm |
| `vision_wasm_internal.wasm` | 10.6 MB | jsDelivr / 自托管 |
| `selfie_segmenter.tflite`（方形，person/bg） | **244 KB** | `storage.googleapis.com/mediapipe-models/...` |
| `selfie_segmenter_landscape.tflite` | 244 KB | 备用横向变体 |
| ~~`selfie_multiclass_256x256.tflite`~~ | 16 MB | **不采用**（多类分割，超出需求） |

**全部 self-host 到 `public/mediapipe/`**：

- `public/mediapipe/wasm/vision_wasm_internal.{js,wasm}` ≈ 10.6 MB
- `public/mediapipe/wasm/vision_wasm_nosimd_internal.{js,wasm}` ≈ 10.6 MB（旧浏览器兜底）
- `public/mediapipe/models/selfie_segmenter.tflite` ≈ 244 KB
- **总计 ~22 MB on disk**（双 WASM 变体），首次实际加载只下载其中一个 WASM

> 二次访问命中浏览器缓存 = 0 下载。仓库体积可接受（远小于 @imgly 时代的 76 MB）。

## 5. 架构契约（`core/background.ts` 重生）

边界规则不变：核心层无 Svelte 依赖，纯输入输出。

```ts
// src/lib/core/background.ts
export type BgReplaceInput = {
  source: HTMLImageElement | HTMLCanvasElement
  targetColor: string  // CSS color
}

export type BgReplaceResult =
  | { kind: 'replaced'; canvas: HTMLCanvasElement; method: 'mediapipe' | 'chromakey' }
  | { kind: 'matOnly'; reason: 'init-failed' | 'low-confidence' | 'user-disabled' }

// 主入口；懒加载 MediaPipe，失败降级
export async function replaceBackground(input: BgReplaceInput): Promise<BgReplaceResult>

// 显式预热（用户进入「换底」面板时调用，避免点按时再等加载）
export function prewarmSegmenter(): Promise<void>
```

懒加载分层：

```
点「替换底色」按钮
  → dynamic import('./background')        ← 切出 chunk，主 bundle 不含
  → ImageSegmenter.createFromOptions(...)  ← 首次触发 WASM + tflite fetch
  → segment(source) → categoryMask         ← uint8 mask, 0=bg 1=person
  → 合成新底色到 canvas
  → 返回 { kind: 'replaced', method: 'mediapipe' }
```

降级链：

```
MediaPipe 初始化失败 / 模型加载失败 / 浏览器不支持 WASM
  → 尝试 chromakey（角点采样阈值替换）
  → 若 mask 覆盖率 <5% 或 >95% → matOnly（仅作为排版 mat）
  → 始终返回有效结果，永不抛错
```

## 6. UI / 状态影响

### SidePanel 色板

视觉**不变**。色板下方新增**一行隐式开关**（默认 ON）：

```
☑ 替换照片背景  ⓘ 适合干净背景的人像照片
```

关闭后，色板仅作为「排版底色 / 边距 mat」。

### `state/editor.svelte.ts` 字段新增

```ts
bgMode: 'replace' | 'matOnly'           // 默认 'replace'
bgStatus: 'idle' | 'loading' | 'ready' | 'error'
bgMethod: 'mediapipe' | 'chromakey' | null  // 上次成功的路径
```

不保留 cutoutResult / model version 等历史字段（彻底新生）。

## 7. 隐私不变

- **100% 本地推理**，无任何外发
- WASM + 模型全部 self-host（`/public/mediapipe/`），无 CDN 运行时依赖
- 不需要 COOP/COEP（Phase 0 必须验证）→ 不污染全站同源策略
- README「隐私零外联」声明继续成立

## 8. i18n 接口（hook 进主 plan）

新增字符串键（追加到 i18n plan §X）：

```
bg.replace.action            // "替换底色"
bg.replace.toggle            // "替换照片背景"
bg.replace.hint              // "适合干净背景的人像照片"
bg.replace.loading           // "加载分割模型…"
bg.replace.method.mediapipe  // "AI 智能识别"
bg.replace.method.chromakey  // "色域替换"
bg.replace.method.matOnly    // "仅设为相纸底色"
bg.replace.error.init        // "模型加载失败，已切换为相纸底色"
bg.replace.error.lowConfidence // "无法识别背景，仅作为相纸底色"
```

**9 键 × 5 locale = 45 译条**。i18n plan 总数从 ~230-270 修订到 **~240-280**。
术语对齐 [`../i18n/terminology.md`](../i18n/terminology.md) D 区域（颜色 / 状态）。

## 9. 与 i18n plan 的协同

无冲突。新增字符串走 plan §2.6 的 ICU MessageFormat 通道；错误抛出走
plan §2.8 `AppError({key, params})` 模式（无裸字符串）。

`PhotoSpec.bgAllowList?: string[]`（i18n plan §2.10 已规划）此时**真正激活**：
若 spec 限定背景色（如「白色 / 浅蓝」），色板自动高亮允许集，禁用非法选项。

## 10. 实施分期（Phase）

**Phase 0 — Gate（必须先验证）**

1. 装 `@mediapipe/tasks-vision`，写最小 PoC：image → mask → 合成
2. **验证 COOP/COEP 是否真的不需要**（如果需要，本 ADR 重审）
3. 实测：证件照尺寸耗时、mask 边缘质量、头发场景
4. 验证全 self-host 后**完全离网**仍可工作

**Gate 通过条件**：① 不需 COOP/COEP；② 推理 <500ms；③ 头发边缘可接受；
④ 离网验证通过。任一失败 → 退回纯 chroma-key + mat。

**Phase 1 — 数据 + 核心**

- `core/background.ts` 重写按 §5 契约
- `state/editor` 增 `bgMode/bgStatus/bgMethod`
- self-host 拷贝脚本 `scripts/sync-mediapipe.mjs`（简单 curl，无版本对齐复杂度）

**Phase 2 — UI**

- SidePanel 色板下方加 toggle + 状态文案
- 错误/降级状态可见
- `bgAllowList` 高亮逻辑

**Phase 3 — 收尾**

- README 更新（撤销「无 AI」声明，补「轻量本地分割」说明）
- 隐私声明措辞调整
- i18n plan 同步 §X 字符串

## 11. 不做（Non-goals）

- 不做多类分割（头发/衣服/皮肤分离）
- 不做实时视频流（IMAGE mode 足够）
- 不做手动笔刷修正（超范围；如需要走 Phase 4+）
- 不重新接入 @imgly 任何代码
- 不引入 COOP/COEP 头（如 Phase 0 发现确实需要 → 重审本 ADR）

## 12. 失败回滚

若 Phase 0 Gate 不通过：

- 删除 `@mediapipe/tasks-vision` 依赖
- `public/mediapipe/` 清空
- 走原 [§2 选项 C](#2-决定) 的备用方案 = **B「仅 mat」**：色板改名「相纸底色 / 边距」，关闭"替换"语义

回滚成本可控（~1 commit）。

---

## 附录 0：Phase 0 Gate 实测结果（2026-06-02）

PoC：[`mediapipe-poc.html`](../../mediapipe-poc.html)（独立页，零 app 依赖）。
经一次对抗式审计（3 agent 并行）发现并修正了 v1 的两处错误，详见下方「v1 教训」。

| Gate 标准 | 阈值 | 实测 | 结论 |
|---|---|---|---|
| ① 无 COOP/COEP | 头缺席 **且** 真实出 mask | `SAB=absent` `COI=false`，`segment()` 正常返回有效 mask | **PASS（结果验证，非仅看 flag）** |
| WASM 变体 | 单线程 | `vision_wasm_internal.wasm` = simd single-thread（非 threaded，故无需 SAB） | ✅ |
| ② 推理 <500ms | 暖机中位 | **16–19ms**（420×540，暖机 + 20 次中位/p95） | **PASS（巨大余量）** |
| 初始化 | — | 90–140ms（暖缓存） | ✅ |
| ④ 离线 | 零外部请求 | 网络审计 0 外部请求（全 `localhost`/node_modules）；DevTools-Offline 待真机复核 | **PASS（自托管路径成立）** |
| ③ 头发边缘 | 人工逐图 | **需真人照片**，合成图无法判 | 待用户语料 |

**关键实测修正**：`confidenceMasks` 长度实际为 **1**（前景概率单通道），
**不是**调研所称的 2（[bg, person]）。模型构建相关。PoC 已做防御：
1 或 2 mask 都支持，且**经验标定朝向**（中心 vs 四角），不硬编码 person 索引。

### v1 教训（已修）

1. **硬切 `categoryMask` + 最近邻上采样** → 对任何模型都呈锯齿，是「头发可接受」
   判据的**假阴性陷阱**。改用 confidence 软 alpha + 双线性 + smoothstep 羽化。
2. **人/背景索引写反**（v1 注释「0=person」实为 0=bg/1=person）→ 会把人物涂成底色。
   改为**不信任任何文档索引**，用中心-四角经验标定 + 自动取反。
3. **单次冷启计时** → 改暖机 + N 次中位/p95。
4. **`COI=no` 当作"不需要头"的证明** → 改为合取：头缺席 ∧ 真实出 mask ∧ 单线程 WASM。

## 附录 A：API 形状（参考实现，已按 Phase 0 实测修正）

```ts
import { ImageSegmenter, FilesetResolver } from "@mediapipe/tasks-vision"

let segmenter: ImageSegmenter | null = null

async function ensureSegmenter() {
  if (segmenter) return segmenter
  const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm")
  segmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "/mediapipe/models/selfie_segmenter.tflite" },
    runningMode: "IMAGE",
    outputConfidenceMasks: true,   // ← FLOAT32 软 matte，软发丝的唯一来源
    outputCategoryMask: false,     // 硬 argmax，只在需要廉价 coverage 时才开
  })
  return segmenter
}

// 不硬编码 person 索引：ID 照主体居中，取「中心 > 四角」的通道，
// 若为背景概率（四角 > 中心）则取反。对 1 或 2 个 confidence mask 都成立。
function resolvePersonAlpha(masks: MPMask[]): { alpha: Float32Array; w: number; h: number } {
  const m = masks.length >= 2 ? masks[pickByCenterVsCorner(masks)] : masks[0]
  const alpha = m.getAsFloat32Array()
  if (cornerMean(alpha, m.width, m.height) > centerMean(alpha, m.width, m.height))
    for (let i = 0; i < alpha.length; i++) alpha[i] = 1 - alpha[i]
  return { alpha, w: m.width, h: m.height }
}

export async function replaceBackground(input: BgReplaceInput): Promise<BgReplaceResult> {
  try {
    const seg = await ensureSegmenter()
    const result = seg.segment(input.source)
    if (!result.confidenceMasks?.length) return { kind: 'matOnly', reason: 'init-failed' }
    const { alpha, w, h } = resolvePersonAlpha(result.confidenceMasks)
    const canvas = composite(input.source, alpha, w, h, input.targetColor)
    result.confidenceMasks.forEach((m) => m.close())  // 释放 WASM 堆
    return { kind: 'replaced', canvas, method: 'mediapipe' }
  } catch {
    return chromakeyFallback(input)
  }
}
```

`composite()` 关键步骤（`core/compose.ts`）：
1. confidence → 小 alpha canvas（写 alpha 通道，RGB 忽略）
2. **双线性**上采样到原图分辨率（`drawImage` + `imageSmoothingEnabled`，**非**手写最近邻）
3. 可选 smoothstep（lo~0.35 / hi~0.65）控制过渡带宽 + alpha 通道 1–2px 高斯
4. 合成 `out = src*α + target*(1-α)`，matte 单独存数组，最终只写不透明 RGBA
   （避开 canvas 预乘 alpha 回读对低 α 像素 RGB 的破坏）

**despill 去边缘白边（已在 PoC 实现，默认开）**：真照片实测发现白底→彩底时
发丝有明显白晕——半透明边缘像素烤进了原白底色。直接 alpha 混合
`src·α+target·(1-α)` 会把这层污染白当前景留下。改用**背景换色公式**：

```
out = src + (1-α)·(target - bg_orig)
```

`bg_orig` 从原图四角采样（证件照底匀色，成立）。语义：只替换像素里的
**背景成分**——α=1 纯人物原样不动，α=0 纯背景变 target，边缘按比例把旧底色
换成新底色，**白晕消除**。代价：需原底匀色（非匀色时退回直接混合，PoC 有开关）。

> 注意：此式只修**颜色污染**，不修 mask 边界**毛糙**（后者是模型分辨率固有，
> 翻拍打印件/低质源更明显，直拍证件照可接受）。

## 附录 B：自托管脚本草案

```mjs
// scripts/sync-mediapipe.mjs
import { mkdir, writeFile } from 'node:fs/promises'

const VERSION = '0.10.35'
const TARGETS = [
  [`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm/vision_wasm_internal.js`,
   'public/mediapipe/wasm/vision_wasm_internal.js'],
  [`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm/vision_wasm_internal.wasm`,
   'public/mediapipe/wasm/vision_wasm_internal.wasm'],
  // ... nosimd 变体 + selfie_segmenter.tflite
]

for (const [url, dest] of TARGETS) {
  await mkdir(dirname(dest), { recursive: true })
  const buf = await (await fetch(url)).arrayBuffer()
  await writeFile(dest, Buffer.from(buf))
}
```

**远比 @imgly 的 sync-imgly.mjs 简单**——不需要追模型版本号与主包耦合。
