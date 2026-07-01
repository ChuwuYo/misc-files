# 参考仓库代码审计（抄之前先看这个）

> 8 个 Opus agent 各读了本地克隆的**真源码**后的评估。核心原则：**许可证决定能不能抄、正确性决定该不该抄**。⚠️ 标记 = 抄进来会踩的坑。

## 速查表

| 仓库 | 许可证 | 能不能抄 | 代码水平 | 一句话 |
|---|---|---|---|---|
| **rage** (age) | MIT/Apache | ✅ 可抄（线性核心） | 优秀 | **分块 STREAM ChaCha20-Poly1305 的最佳参照**，就用它 |
| **abcrypt** | 核心 MIT/Apache（CLI 是 GPL） | ⚠️ 仅核心可抄 | 优秀 | **footer/容器格式的模型**：magic+版本+严格 TryFrom 拒绝未知版本 |
| **img-parts** | MIT/Apache | ✅ 可抄/可依赖 | 良好 | 主模板，但 ⚠️ **PNG 会丢弃 IEND 后的字节** |
| **mitra** | MIT | 仅借鉴知识 | 混杂 | 格式知识金矿，但**可靠性因格式而异**（作者自己都标了 FIXME） |
| **little_exif** | MIT/Apache | 仅借鉴模式 | 混杂 | ⚠️ **JPEG APP1 长度 u16 溢出**（>64KB payload 直接损坏） |
| **tauri-interop** | MIT/Apache | 仅借鉴模式 | 良好 | ⚠️ **要 nightly + 不稳定 Cargo**，别当依赖，只抄 Cargo cfg 布局 |
| **PolyZip** | MIT | 仅借鉴概念 | **差** | ⚠️ **无 Zip64 + 靠裸扫 PK 签名**，大文件必损坏 |
| **stegano-rs** | **GPL-3.0** | ❌ **禁止抄** | 混杂 | GPL 传染；且是一次性 in-memory LSB，不是我们要的东西 |

---

## 逐仓库

### rage（age crate）— ✅ 抄这个做流式加密
- **拿**：`age/src/primitives/stream.rs` 的分块 ChaCha20-Poly1305 STREAM 线性（非 seek）核心——开源里质量最高的一份，MIT/Apache 可合法直接抄。
- **避**：(1) 它用 **scrypt** 做口令 KDF，我们要 **Argon2id**——换掉；只借"解密时给 work factor 设上限"的思路。(2) 别抄 Seek/随机访问那套机器。

### abcrypt — ✅ 抄它的容器格式设计
- **拿**：固定偏移小端布局、**7 字节 magic + 显式 1 字节版本 + 严格 TryFrom 拒绝未知/不支持版本**（`format.rs:85-95,161-164`）；把 KDF 参数存进头部。这是 stegpack footer 的直接模型。
- **避**：`crates/cli` 是 **GPL-3.0-or-later，别碰**（只抄核心 crate，Apache/MIT）。abcrypt 是单次整文件加密，别指望它能套进我们的分块 STREAM。

### img-parts — ✅ 主模板，但记住一个坑
- **拿**：段/块列表 + 惰性 `EncodeAt` 重写架构（JPEG 段 / PNG 块 / RIFF）。mode-A 容器编辑就照它。
- **⚠️ 必知 bug**：**PNG 解析会静默丢弃 IEND 之后的所有字节**（`png/image.rs:44-52` 遇 IEND 就 break）。所以：
  - 我们 PNG 的 mode-B 用**私有辅助块（IEND 之前）**→ img-parts 能正确处理，✅ 没问题。
  - 但若想在 **IEND 之后追加**尾巴 → img-parts 会把它抹掉。那条路要自己记录原长度、重写时把尾巴补回，或加显式 trailer 字段。
  - JPEG 相反：EOI 后的尾部数据会被塞进 `segment.entropy`（`segment.rs:83`）而侥幸保留——是副作用不是设计的 API，**各格式行为不一致**。

### mitra — 借鉴格式知识，别抄代码
- **可信（真·规范机制，mode A 可放心参照）**：**PNG**(cOMM 块 len+type+data+crc32)、**GIF**(0x21 0xFE 注释扩展 + 255 字节子块分块)、**JPG**(FF FE COM 段 + 2 字节大端长度含自身)、**RIFF/WAV/AVI**(JUNK 块 + 字对齐 + 更新 RIFF size；且正确排除了非规范 RIFF 的 WebP)、**MP4**(free atom + **重定位 stco chunk-offset 表**——naive 工具都忘这步)、**TIFF**(走 IFD 链重定位 StripOffsets)。这六个是可信核心。
- **⚠️ 脆弱/别信（作者自己标了 FIXME）**：ZIP(空文件名 parasite，'sometimes hidden by software'，extractor 依赖)、PDF(死绑 PyMuPDF 字节输出，'dumb xref fix')、ELF(程序头修正被注释掉)、PE overlap(BPG/CPIO/WASM 偏移算错)。
- **拿**：四种布局分类学（Stack/Cavity/Parasite/Zipper）+ identify/cut/wrap/relocate 模型 + 上面 6 个格式的字节机制。

### little_exif — 借鉴分块模式，别当嵌入引擎
- **⚠️ 必修 bug**：JPEG APP1 长度按 u16 算且**无溢出保护**（`src/jpg.rs encode_metadata_jpg`），payload > ~65531 字节就静默回绕 → 损坏的 JPEG；**没有多 APP1 段切分**。→ 印证我们 JPEG 路径**必须分段链接（每段 ≤64KB）**。
- **拿**：PNG chunk 模型（`src/png/mod.rs`）的拼接模式（净室重写），不是 EXIF 专用编码器。

### tauri-interop — 只抄 Cargo cfg 布局
- **⚠️ 硬伤**：**依赖 nightly Rust + 不稳定 Cargo**（`trait_alias`、`per-package-target`、`rust-toolchain.toml` 钉 nightly）——直接违背我们"成熟稳定、AI 好写"的原则。**别加为依赖，别抄 trait_alias 的 Listen/Emit 设计。**
- **拿**：`[target.'cfg(not(target_family="wasm"))'.dependencies]`(host 放 tauri) vs wasm-only 依赖表——这个 cfg 分目标的**概念**在 stable Rust 上可复现，抄思路即可。

### PolyZip — 只借"EOCD 偏移修正"这个概念，代码别用
- **⚠️ 两个正确性 bug**：
  1. **无 Zip64 支持**（`fixup_zip` 876-892 只改 32 位 EOCD/CDFH 偏移）。当归档 >4GiB / 单条目 >4GiB / >65535 条目（正是我们分块大文件的场景），真实偏移在 Zip64 记录里，它碰都不碰，还把 0xFFFFFFFF 哨兵值瞎加 → **大文件必损坏**。
  2. **靠裸扫签名定位**（`rindex(b'PK\x05\x06')` / `index(b'PK\x01\x02')`）→ 这些字节可能自然出现在文件数据/文件名/注释里，误匹配就改错 4 字节静默损坏；还假设 EOCD 注释长度为 0。
- **拿**：仅"在偏移 start_offset 追加自包含 ZIP 后，把 EOCD 的 cd-start 和每个 CDFH 的本地头偏移都加上 start_offset"这个**概念**。→ 我们实现 ZIP/OOXML 时**必须**：正确解析 EOCD 注释长度、**支持 Zip64**、按结构而非裸扫定位。

### stegano-rs — ❌ 别抄（GPL + 名不副实）
- **许可证**：**GPL-3.0-only**，抄任何非平凡代码都会把整个 stegpack(核心+wasm+Tauri) 拖成 GPL 并须开放全部源码 → 与商店发布/permissive 目标冲突。
- **且名不副实**：研究阶段说它"PNG IEND 追加 + 分块 STREAM"是**错的**。实读源码：它是**一次性 in-memory** `Aead::encrypt`(`crypted.rs:68-79` read_to_end 后整块加密)，**零 STREAM/分块**；嵌入是 **LSB 像素**并用 image crate `img.save()` 重编码（`media/types.rs:175`）——不是 append/polyglot 载体的参照。还有多处 panic(`crypted.rs:74 .expect("todo")`、`lib.rs:26 assert!`、`codec.rs:104 panic!`)、Argon2 参数硬编码且不存进容器（改参数就解不开旧文件）。
- **只拿**（净室重写）：原语选择(Argon2id + XChaCha20-Poly1305 合理)、正确的 salt/nonce 生成纪律(每次 OsRng 新 32B salt + generate_nonce 24B + 用后 zeroize)。其余全避。

---

## 对 stegpack 的净影响（这些是"对错"，已应反映进计划）

1. **流式加密照 rage（STREAM），不是 stegano-rs**（后者根本没 STREAM，还 GPL）。
2. **footer 格式照 abcrypt**：magic + 显式版本 + 严格 TryFrom 拒绝未知版本 + KDF 参数存进头部（stegano-rs 的反面教材：参数不存 = 改参数即解不开旧文件）。
3. **JPEG 路径必须多段切分（每段 ≤64KB）**——little_exif 的 u16 溢出坐实了这条。
4. **ZIP/OOXML 必须支持 Zip64 + 正确解析 EOCD（含注释长度），不能裸扫 PK 签名**——PolyZip 两个 bug 的教训；大文件尤其。
5. **PNG**：mode-B 用私有辅助块（IEND 之前）✅；若走 IEND 后追加要自己保尾巴（img-parts 会丢）。
6. **tauri-interop 不作依赖**（nightly），只借 Cargo cfg 分目标布局的思路。
7. **mitra 只信 PNG/GIF/JPG/RIFF/MP4/TIFF 的机制**，它的 ZIP/PDF/ELF/PE 别照抄。
8. **许可证红线**：stegano-rs 全 GPL、abcrypt-CLI GPL → 这两处只能净室重写模式；img-parts/rage/little_exif/mitra/PolyZip/abcrypt-core 是 MIT/Apache，可抄（保留署名）。
