# stegpack 参考资料索引（Reference）

> 由 3 个并行调研工作流（开源项目 / Rust 库+官方文档 / Tauri+wasm 架构）汇总、去重、排序后整理。
> 已 `git clone --depth 1` 的仓库在本目录；带 `.git`，可 `git pull` 拉更新。
> stegpack 两种模式：**A 格式伪装（套壳，改后缀能开）**、**B 藏进真载体（嵌入内部结构）**；可选 AEAD 加密；栈 = Rust 核心 → wasm(web) + Tauri 2.x(桌面, React/Vite/pnpm)。
>
> ### ⚠️ 抄任何一个之前，先看 [`ASSESSMENT.md`](./ASSESSMENT.md) —— 逐仓库的许可证/能不能抄/有没有 bug 审计。要点：`stegano-rs` 是 **GPL 禁止抄**；`rage`/`abcrypt-core`/`img-parts` 可抄；`PolyZip`(无 Zip64+裸扫签名)、`little_exif`(JPEG u16 溢出)、`tauri-interop`(要 nightly) 有坑，只借概念。

---

## 一、已克隆仓库（本目录，直接读源码）

### ⭐ 核心先例（最贴近 stegpack，优先读）

| 目录 | 语言/许可 | 是什么 | 重点看什么 |
|---|---|---|---|
| **stegano-rs** | Rust / GPL-3.0 | 最近亲：跨平台 stego CLI+core，**同款加密栈 XChaCha20-Poly1305 + Argon2id**；PNG 用 IEND 后追加（非 LSB） | `stegano-core` 的 encrypt-then-embed 管线、workspace 拆分、字节级追加、格式兼容处理 |
| **img-parts** | Rust / MIT+Apache | **改容器不动像素**：JPEG 段 / PNG 块 / RIFF-WebP，基于 `bytes` 零拷贝流式 | `src/jpeg`·`src/png`·`src/riff`：解析成段/块向量 → 插入/追加 → 原样重写。stegpack 容器操作的直接模板 |
| **little_exif** | Rust | 纯 Rust 元数据**读+写**，靠原地拼接元数据段/块（不重编码像素）；支持 PNG/JPEG/WebP/HEIF/TIFF | 每格式 writer（png.rs/jpg.rs/webp.rs）= payload 块插入的近直接模板；有 in-memory Vec API（wasm 友好） |
| **abcrypt** | Rust | **加密文件格式**：Argon2id + XChaCha20-Poly1305，有明确的头/格式定义 | stegpack **footer + 加密容器**设计的直接参照（参数如何随文件持久化、magic/版本/盐/nonce 布局） |
| **rage** | Rust | age 的 Rust 实现；**分块 STREAM ChaCha20-Poly1305** 文件加密 | 流式 AEAD 的正确做法、口令(scrypt)流程；stegpack 分块加密的参照 |
| **tauri-interop** | Rust | **一个公共 crate 同时编 wasm 和 host**，用 cfg 分目标依赖（host 用 tauri、wasm 用 serde-wasm-bindgen） | `[target.'cfg(target_family="wasm")'.dependencies]` 拆分 = stegpack「一核心两目标」的关键技巧 |

### Mode A（格式伪装 / polyglot）

| 目录 | 语言 | 是什么 | 重点 |
|---|---|---|---|
| **mitra** | Python | **polyglot 圣经**（Ange Albertini/corkami）：让文件同时是两种格式 | 各格式 polyglot 策略（PDF/ZIP/MP4 box/PNG/JPEG/GIF/RIFF）= Mode A 知识库 + 反检测意识 |
| **PolyZip** | Python | ZIP polyglot 覆盖 30+ 载体；在各格式结束标记后追加 ZIP 并**重写 EOCD 偏移** | **EOCD 偏移修正**是 ZIP/OOXML 载体的命门；Mode A 与 Mode B(ZIP overlay) 的可读蓝图 |
| **pdvzip** | C++ | 把 ZIP 嵌进 PNG，文件对 PNG 和 ZIP 都合法 | PNG↔ZIP polyglot 具体字节操作 |

### Mode B（藏进真载体）

| 目录 | 语言 | 是什么 | 重点 |
|---|---|---|---|
| **jdvrif** | C++ | 在 JPEG 里藏/取数据 | Mode B 的 JPEG 段嵌入参照 |

### 检测 / 对抗（验证我们的输出合不合规、会不会被抓）

| 目录 | 语言 | 是什么 | 用途 |
|---|---|---|---|
| **zsteg** | Ruby | PNG/BMP 检测器：扫 LSB、zlib blob、**尾部/多余数据**、已知工具签名 | 拿它跑 stegpack 的 PNG 输出，检查私有块/IEND 后追加是否"干净"、会不会被标记 |

### 架构参照（Rust 核心 → 浏览器 wasm）

| 目录 | 语言 | 是什么 | 重点 |
|---|---|---|---|
| **photon** | Rust | 图像库，**同一核心编到 wasm(浏览器)+ 原生** | 如何用 wasm-bindgen 把 Rust 核心送进浏览器、从 JS 调用；stegpack web 路径的参照 |

---

## 二、只依赖不克隆的库（+ 官方文档）

### 图像容器（改容器不重编码）
- `png` — 官方 image-rs；`text_metadata` + `add_itxt_chunk/add_ztxt_chunk`，可读 chunk 结构。<https://docs.rs/png/latest/png/text_metadata/index.html>（注：encoder 会重压 IDAT，纯字节级插块用 img-parts）
- `gif` — 官方；`Extension` 枚举写 Application/Comment 扩展块。<https://docs.rs/gif>
- `image-webp` — 官方；懂 RIFF 简单/扩展(VP8X) 布局，读 ICCP/EXIF/XMP。<https://docs.rs/image-webp>（配 img-parts 做 RIFF 插块）
- `kamadak-exif` — 只读 EXIF 解析器，参照 TIFF/Exif IFD 布局、避免插入冲突。<https://docs.rs/kamadak-exif>

### 加密（RustCrypto，纯 Rust，wasm-clean）
- `chacha20poly1305` / `aes-gcm` / `argon2` / `hkdf` / `sha2` / `zeroize` / `getrandom`(js 特性)
- `aead`（stream 特性，`EncryptorBE32`）— 分块 STREAM。<https://docs.rs/aead/latest/aead/stream/index.html>
- RustCrypto/AEADs 仓库+README（STREAM 说明）：<https://github.com/RustCrypto/AEADs>
- `age` 库：<https://docs.rs/age>

### 归档 / 媒体 / 元数据
- `zip`（zip-rs/zip2）— EOCD/overlay + 传输 zip(STORE)。<https://github.com/zip-rs/zip2>
- `mp4` / `mp4-atom` / `re_mp4` / mozilla `mp4parse` — 读 box 结构、插 free/uuid box
- `id3`（rust-id3）/ `lofty` — 音频标签（MP3 尾/ID3 参照）

### Rust → wasm 构建与 JS 互操作
- `wasm-bindgen`（+ 官方 Book）/ `wasm-pack` / `js-sys` / `web-sys` / `serde-wasm-bindgen` / `gloo`
- `vite-plugin-wasm`（Menci）— Vite+wasm 集成：<https://github.com/Menci/vite-plugin-wasm>
- `wasm-streams` — 浏览器流式：<https://github.com/MattiasBuelens/wasm-streams>

---

## 三、Tauri 2.x 官方文档与示例（脚手架/参照，不克隆）

- **官方文档** <https://v2.tauri.app/>：Project Structure、**Calling Rust（invoke + Channels 流式）** <https://v2.tauri.app/develop/calling-rust/>、Vite 前端、Architecture
- **安全/权限**（能力模型，文件访问必配）：<https://v2.tauri.app/security/capabilities/>
- **官方 examples**（在主仓 `tauri-apps/tauri/examples`）：**`streaming`**（读文件按 4096 字节块 + Channel 推进度 = stegpack 大文件流式的最佳范本）、`drag`、`file-associations`、`commands`、`isolation`：<https://github.com/tauri-apps/tauri/tree/dev/examples>
- **脚手架**（用它生成，不克隆）：`pnpm create tauri-app --template react-ts`（tauri-apps/create-tauri-app）
- 官方插件：`plugin-fs`、`plugin-dialog`(FileDialogBuilder)、`plugin-upload` — <https://github.com/tauri-apps/plugins-workspace>
- ⚠ CSP 坑：wasm 前端需 `script-src 'self' 'wasm-unsafe-eval'`，否则初始化失败

---

## 四、其余值得一看（未克隆，按需）

- **CleasbyCode 套件**：pdvrdt(PNG)、jzp、imgprmt、pdvps、wbpdv —— 更多格式专项 stego：<https://github.com/CleasbyCode>
- **polyglot 相关**：truepolyglot(ansemjo)、tweetable-polyglot-png(DavidBuchanan314)、Polyglot-HTML-ZIP-PNG(gildas-lormeau)、**corkami/pocs + corkami/docs（AbusingFileFormats）**
- **Rust + wasm/crypto 架构**：magic-wormhole.rs、spacedrive、phase-rs/phase、str4d/wage
- **检测/取证**：binwalk v3（ReFirmLabs，Rust 重写）、`infer`(magic-byte 识别)、trailofbits/polyfile、stegseek（steghide 爆破——反面教材：弱 KDF/种子会被 2³² 爆破，佐证我们选 Argon2id）
- **产品 UX 参照**：openstego（双模式：hide/watermark）、cedricbonhomme/Stegano、DominicBreuker/stego-toolkit
- **Tauri 文件处理 App**：hat.sh(浏览器加密)、CompressO、Alic、compressor_tauri、QuietJoon/Tauri_Drag_and_Drop_Example
