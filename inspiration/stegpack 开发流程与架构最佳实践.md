# stegpack 规划文档（WebAssembly + 桌面双端）

> 本版本基于对原计划的技术审查重写：修正了若干不成立的格式嵌入假设、明确了不可靠的传输场景、收敛了加密与内存方案、并重排了执行顺序。修订要点见文末「附录 A：相对原计划的变更与依据」。

## 一、项目目标

- 构建「加壳 / 去壳」（inject / extract）工具，支持一组经对抗式评审筛选的载体格式（约 10 种，归为 3 个代码族；详见第二节），**不为凑数保留弱格式**。
- **单一技术栈、三端覆盖**：用同一套 Rust 核心 + 同一套前端，同时产出 **Web（wasm）+ Windows/桌面（Tauri）+ 移动 App（Tauri 2.x 的 iOS/Android）**。移动端**本期不做、但架构原生支持，后续接入无需引入第二套技术栈**。
- 提供一致的核心能力（inject / extract / verify）、可选加密、自动/手动格式识别、进度与错误可视化。
- 保持低依赖、轻量打包、可扩展。
- **务实定位**：本工具的嵌入手段属于「容器级冗余数据 / 合法元数据段」注入，**只在文件按原样（无损）传输时可靠**。对会被平台二次编码的通道（社交平台「以图片/视频形式」发送），图片/音视频嵌入基本无法存活，必须在 UI 与文档中如实标注，不作为承诺能力。

---

## 二、格式支持：经对抗式评审后的决策

> 本节结论来自一轮多 Agent 对抗式评审（独立评估 + 对抗式复核 + 来源核查），并按**「大众熟悉度优先」**做最终取舍。第一原则：**载体首先要常见、不起眼、用户手上就有**——技术上更"干净"但普通人不认识的格式（FLAC/WAV 之类）不做，因为没人认识的载体本身就显眼，而且用户根本没有这种文件。冗余、易被检测、依赖专有格式、像恶意软件的，一律删除。最终从原 13 种收敛为「约 10 种主流格式 / 3 个代码族」。

### 支持的格式（大众主流，归 3 大代码族）

| 格式 | 类别 | 嵌入点 | 代码族 |
|---|---|---|---|
| PNG | 图片 | zTXt 辅助块（IEND 前插入，IDAT 一字节不动） | 块/段/尾插入 |
| JPEG | 图片 | COM/APPn 段（每段 ≤64KB，需分段链接） | 块/段/尾插入 |
| GIF | 图片/动图 | 注释扩展块（`0x21 0xFE`），或 `0x3B` 尾标后追加（主流解码器都容忍） | 块/段/尾插入 |
| WebP | 图片 | RIFF 自定义 chunk（未知 FOURCC + 更新顶层 RIFF size） | RIFF 容器 |
| MP3 | 音频 | **最后一帧之后尾部追加** + 磁标/长度（向后扫描定位）；不走 ID3 重写，保持 O(块) 流式 | 块/段/尾插入 |
| MP4 | 视频 | `free`/`uuid` box（顶层 box 扁平扫描；同一扫描器兼顾 MOV/M4A/HEIF） | 块/段/尾插入 |
| docx/xlsx/pptx | 文档 | ZIP/OPC 容器，EOCD 后 overlay（三者同一路径） | ZIP/OPC 容器 |

**支持但默认警告：**

| 格式 | 嵌入点 | 为何要警告 |
|---|---|---|
| PDF | 末个 `%%EOF` 之后追加 | PDF 极常见、人人都认，但 post-EOF 字节是取证/杀软首查项，且会使数字签名 / PDF-A 失效。保留，但 UI 默认警告，并建议优先用 Office/图片 |

> 所有图片/音频/视频载体都只在「按文件发送」时可靠；「按社交媒体发送（图片/视频/语音）」会被平台二次编码摧毁——这是统一的媒体提示，与具体格式无关。GIF/MP3 同理：当对方按文件接收、或平台不自动转码时有效，被转成视频/语音时失效。

### 删除的格式（及依据）

| 格式 | 删除原因 |
|---|---|
| ZIP（裸追加） | post-EOCD 追加是 2026 年杀软/EDR 重点查杀特征（Zombie ZIP / GootLoader），主流解压器对超出 ~64KB 回扫窗的真 EOCD 直接报「损坏」；且「直接往 zip 里塞个加密文件」全面更优。合法 ZIP 容器用途已由 Office 覆盖 |
| 7z | 打开/列举时 7-Zip 直接打印 `Tail Size = N`，向最爱深究的技术用户**同时暴露秘密的存在与大小**；且 7z 本就不是大众格式 |
| RAR | 专有格式，无纯 Rust 写库（unrar 是 C-FFI、非 wasm-clean）；创建 .rar 还需付费 WinRAR |
| exe（PE） | 本身就「像恶意软件」：邮件直接拦截、杀软专扫 overlay、未签名触发 SmartScreen、追加破坏 Authenticode 签名 |
| FLAC / WAV | **大众根本不认识、手上也基本没有**——载体首要是「常见、不起眼」，这两个都不满足；音频用 MP3 即可 |

### 备选（仅在被明确要求时再做）

- MKV/Matroska（Attachments 元素专为内嵌文件设计，但需完整 EBML 解析，成本高；MP4 已覆盖视频场景）。
- SVG（XML 注释，但 base64 膨胀 ~33%、文本编辑器直接可见、优化器会清除注释）。
- BMP/TIFF（嵌入点干净但几乎无人以文件形式传输，真实价值低）。
- RIFF 代码族目前只服务 WebP；若日后真要音频，可在同一代码族上低成本加 WAV。

### 传输通道才是决定一切的轴（不是格式本身）

- **按「文件 / 原始文件」发送（无损）**：上述全部格式都可靠。这是本工具唯一能承诺的通道。
- **以「图片 / 视频 / 语音」在社交平台发送（二次编码）**：**所有媒体载体一律失效**——平台必然重编码并剥离元数据，与具体格式无关。因此 PNG/JPEG/GIF/WebP/MP3/MP4（及任何图像/音视频）统一标注「仅按文件发送可靠」。
- 文档 / 容器类（Office）只走文件通道，本就没有「按媒体发送」一说。
- 一句话：**「按文件发」=全部可用；「按媒体发」=全军覆没**。UI 必须把这条讲清楚，不做无法兑现的承诺。

### 压缩包传输壳：用一个正常 zip 强制走文件通道

媒体载体怕「被当成图片/视频去重编码」。最简单的对策：**把改好的载体文件放进一个正常 `.zip` 再发**——压缩包永远以「文件」形式传输，里面的载体原样到达，二次编码问题直接消失。是否这样用由**用户自行决定**（要隐蔽的原始观感就发源文件，要保命就发压缩包）。

- 这是**传输壳，不是隐写载体**——和第二节删掉的「ZIP 裸追加」完全两码事：这里是一个结构完全合法的标准 zip，载体作为普通条目存放，**不耍 post-EOCD 尾部追加那套，零告警、不触发杀软特征**。
- 压缩方式用 **STORE（不压缩）**即可：载体本身已是压缩/加密的高熵数据，再 deflate 一遍既无收益又费 CPU；STORE 更快、体积一样。
- 可一次打包多个载体。
- 对应导出/导入双向：导出可选「源文件 / 压缩包」；去壳时若输入是 `.zip`，自动解包找出载体再提取（见第九节）。

---

## 三、选型与总体架构

**一套技术栈打三端（Rust + Tauri 2.x + wasm + 单一前端）：**

| 端 | 形态 | 后端路径 | 本期 |
|---|---|---|---|
| Web | wasm 模块 + 静态前端 | wasm-bindgen 调核心 | ✅ 做 |
| Windows / macOS / Linux 桌面 | Tauri 2.x 桌面 | 原生 Rust 核心（IPC） | ✅ 做（Windows 优先） |
| CLI | 单二进制 | 直接链接核心 crate | ✅ 做（测试 / 脚本 / CI 入口，近乎白送，也是无损文件通道的利器） |
| iOS / Android 移动 App | Tauri 2.x 移动 | 原生 Rust 核心（IPC） | ⏸ Phase 2，架构已就绪 |

> Tauri 2.x 自 2024-10 起在桌面与移动用**同一 Rust 核心 + 同一前端 WebView**，因此「Web + Windows + App」三端不需要第二套技术栈——移动端只是后期补一个构建目标和适配层，UI 与核心逻辑零重写。
>
> **移动端为何明确放到 Phase 2（评审复核结论）**：Tauri 移动 API 已稳定，但官方自承「v2 还不是移动一等公民」——插件平台尚未全部移植；`tauri-action` 暂不自动化 iOS/Android 商店构建（签名 / TestFlight / Play 需自写 CI）；Android 分区存储返回 `content://`，要拿到可流式的文件句柄通常得用社区插件（如 tauri-plugin-android-fs）。而本工具的主战场（IM/邮件/网盘 = 无损文件传输）本就以桌面/Web 为主，手机沙盒恰是字节级文件封装最不友好的环境。故先桌面+Web，移动延后，决策反而更稳。
>
> **为什么 Tauri 而非 Flutter / KMP / MAUI（评审结论）**：本项目价值全在那个「重字节处理的 Rust 核心」。决定性问题不是 UI 框架谁漂亮，而是哪套栈能让**同一份 Rust 核心在 Web+Windows+移动上以最少翻译跑起来**。Tauri 独一份：桌面/移动**直接链接** crate（核心零 FFI 编组），Web 把**同一 crate** 编译成 wasm——一份源码、两个编译目标、行为逐字节一致。Flutter（最强对手）能出三端且 flutter_rust_bridge 有 web/wasm 支持，但核心每端都要过生成的 Dart↔Rust 桥、线程化 web wasm 需 COOP/COEP 头、还拖着 CanvasKit 图形引擎（本工具几乎不画图）；KMP 原生强但 Compose for Web(Kotlin/Wasm) 仍 Beta、无干净的「浏览器内调 Rust 核心」路径——恰好卡在最看重的 Web 端；MAUI+Blazor 实为两套栈、无一等 Rust-wasm 互操作。包体上 Tauri ~数 MB vs Electron 方案 80–150MB。**唯一会翻盘的前提**：若这是图形/动画密集的消费级 App，Flutter/Compose 会更好——但它不是。

- 核心语言：Rust（stable，单一 Cargo workspace）
- 桌面/移动端：**Tauri 2.x**（能力/权限模型 capability-based；wasm 前端需在 CSP 放开 `wasm-unsafe-eval`）
- Web 端：WebAssembly（`wasm-bindgen` 工具链），同一 Rust 核心编译为 wasm
- 前端：**单一前端代码库（固定 Svelte 或 React 其一）**——三端共享 UI 的前提；不可「任选其一」
- 加密：默认 **ChaCha20-Poly1305**（软件/wasm 无 AES-NI 时显著快于 AES-GCM），可选 AES-256-GCM；KDF 默认 **Argon2id**

### 关键架构决策：桌面走原生、Web 走 wasm、共享同一前端

```
            ┌─────────────────────────────────────────┐
            │   前端 UI（单一代码库，TS）                 │
            │   依赖抽象接口 StegBackend                  │
            └───────────────┬─────────────┬─────────────┘
                            │             │
              桌面：Tauri IPC            Web：wasm-bindgen
                            │             │
            ┌───────────────▼──┐   ┌──────▼───────────────┐
            │ 原生 core（多线程、 │   │ wasm core（单线程、   │
            │ 无内存上限、流式落盘）│   │ 2–4GB 内存、流式 Blob）│
            └───────────────┬──┘   └──────┬───────────────┘
                            └──────┬───────┘
                         同一 stegpack-core crate
```

- **桌面端调用原生 Rust 核心（IPC 命令），不在 WebView 里跑 wasm**——大文件可多线程、不受 wasm 内存上限、可直接流式落盘。
- **移动端（后期）走与桌面相同的原生 IPC 路径**（Tauri 2.x 移动同样是 WebView + 原生 Rust 核心），只需补移动适配层（沙盒文件、分享面板等）。
- **Web 端调用 wasm**。前端通过统一的 `StegBackend` 接口屏蔽这两条后端路径（IPC / wasm），UI 与业务逻辑 100% 复用。
- 核心库无平台耦合、不做文件 IO，只处理「字节流 in → 字节流 out」。

### 分层

- 核心库（`stegpack-core`）：格式协议 + 容器封装 + 加密；**面向 native 与 wasm 双目标，从第一天起就保证 wasm 可编译**。
- 适配层：桌面（FS、系统 RNG、并发）／Web（File/Blob、`getrandom` 的 js 特性、wasm 内存）。
- 界面层：文件选择/拖放、选项面板、进度与日志、结果下载/保存。

---

## 四、核心数据流：流式 Read → Write（贯穿全部设计）

所有嵌入手段本质都是「在已知偏移处插入/追加」，因此核心应设计为**流式转换**，而非「整文件读入内存」：

- 加壳：将壳文件按块（如 1 MiB）从输入流读出 → 写入输出流 → 在正确位置插入/追加 payload（含加密与 trailer）。内存占用 O(块大小)，与文件大小无关。
- 去壳：从尾部回扫 trailer magic → 读 trailer → 定位并流式读出 payload → 解密 → 写出。
- 落盘：
  - 桌面：直接写文件流。
  - Web：**Chromium** 用 File System Access API（`showSaveFilePicker` + `FileSystemWritableFileStream`）流式写盘；**Firefox/Safari 不支持该 API**，回退为内存内 Blob 拼装（受 RAM 限制）→ 超大文件应引导用户改用桌面端。

> 这一条把「大文件内存压力」从风险变为设计前提：append 类格式天然可纯流式处理。

---

## 五、容器封装格式（trailer）规范

无论追加到尾部还是放进结构段，payload 都包成统一的自描述容器，便于校验、加密参数携带与可靠提取：

```
[payload 字节（可能已压缩、已加密、已分块）]
[trailer]：
  magic        "STGP"        (4B)
  version      u8
  flags        u8            // bit0 加密  bit1 压缩  bit2 含原始文件名
  kdf_id       u8            // 0=none 1=argon2id 2=scrypt
  aead_id      u8            // 0=none 1=chacha20poly1305 2=aes256gcm
  kdf_params   (m,t,p) + salt        // 仅加密时
  chunk_size   u32                   // 分块 AEAD 的块大小
  base_nonce   12B                   // 仅加密时
  orig_name    (len + bytes，可选)
  payload_len  u64                    // 密文/数据长度
  plain_sha256 32B                    // 明文 SHA-256（完整性）
  trailer_len  u32                    // 便于从尾部回扫定位
  magic_end    "STGP"        (4B)
```

提取流程：seek 到文件尾 → 读末 4B 校验 magic_end → 回读 `trailer_len` → 解析 trailer → 读取 payload → 校验 SHA-256（解密后）。

---

## 六、加密方案

- AEAD：默认 **ChaCha20-Poly1305**（纯软件/wasm 无 AES 硬件加速时快 ~50–300%），可选 **AES-256-GCM**。两者均用 RustCrypto 纯 Rust 实现，**置于核心库**，native 与 wasm 走同一代码路径——**不再为 wasm 单独引入 WebCrypto 适配**（避免逻辑分叉与 async 传染）。
- **分块 AEAD（STREAM 式）**：大文件不可一次性 GCM/Poly1305。按 `chunk_size` 分块，每块独立 nonce = `base_nonce || counter`，末块做域分离标记，防止截断/重排。这与第四节的流式处理天然契合。
- KDF：**Argon2id**（OWASP 推荐）。浏览器内存预算敏感，默认参数取中等（如 m≈19–64 MiB、t=2–3、p=1），桌面可上调；参数随 trailer 持久化以便解密。scrypt 仅作兼容选项（OWASP 参数约 128 MB，对浏览器偏重）。
- 随机源：浏览器 `crypto.getRandomValues`（经 `getrandom` 的 js 特性），桌面系统级 RNG。由适配层注入核心。
- 生命周期：密钥与明文最小驻留，可行范围内显式清零（如 `zeroize`）。

---

## 七、WebAssembly 技术要点

- 目标：现代浏览器（Chromium/Firefox/Safari 当前稳定版），产物为一个 wasm 模块 + 前端静态资源（可被 Tauri 复用）。
- **wasm 约束（必须在 M1 验证，而非拖到后期）**：
  - wasm32 为 32 位线性内存，实际可用约 2 GB、上限 4 GB；**整文件入内存不可行**，依赖第四节流式处理。
  - 默认单线程（线程需 `SharedArrayBuffer` + COOP/COEP 跨源隔离，复杂度高，初期不启用）。
  - 库选型必须纯 Rust、可编译到 `wasm32-unknown-unknown`：DEFLATE/ZIP 用 `miniz_oxide`/`flate2`（rust backend），避免任何 C FFI。
  - `getrandom` 需启用 js 特性；时间/随机相关 API 注意 wasm 差异。
- 超大文件：Firefox/Safari（无流式落盘、无线程、内存受限）应引导改用桌面端；Chromium 借 File System Access API 流式写盘可处理较大文件。

---

## 八、桌面客户端（Tauri 2.x）方案

- 权限：能力（capability）模型，最小化 FS 权限，仅允许用户选择的路径，关闭无关 API。
- IPC：注入/提取/校验、加密开关、格式自动识别、进度订阅、错误上报。大文件用流式/分块命令 + 进度事件。
- 打包：小体积；Windows/macOS/Linux 构建；签名与自动更新（updater 插件）**可选**——签名需付费证书，按需启用。
- 与 Web 一致性：同一前端代码、同一核心 crate，仅后端绑定方式不同。

---

## 九、UI 交互设计

核心流程：

- 加壳：选壳文件 → 选 payload → 选输出 → 可选（加密、密码、KDF 档位、嵌入策略）→ 执行 → **选导出方式（源文件 / 压缩包 .zip）** → 下载/保存。
- 去壳：选已加壳文件**或一个 .zip**（自动解包找出里面的载体）→ 选输出 → 可选输入密码 → 执行 → 下载/保存 payload。

主要模块：

- 文件区：拖放/选择；历史记录默认**关闭**（隐私，stego 工具尤甚），开启也只存路径不存内容。
- 选项区：自动/手动识别、加密开关、密码强度提示、KDF 档位（简单/高级）。
- 状态区：实时进度、可折叠日志、兼容性提示（社交平台「按媒体发送会失效」、PDF 检测风险、文档被重存会丢 payload 等）。
- 结果区：**两种导出方式**——①导出源文件（带载荷的载体本体）；②导出压缩包（把载体放进一个正常 `.zip`，纯传输壳）。用户按需自选（默认记住上次选择）。另含复制校验和；复制 CLI 参数（**仅桌面端**，Web 无 CLI）。
- 完整性检查：选文件做结构校验 + trailer/marker 验证，提示是否可安全提取。
- 设置：国际化、主题、内存策略、隐私与安全说明。

可用性/可访问性：键盘操作、屏幕阅读器标签、对比度主题；大文件非阻塞 UI 与可取消。

---

## 十、一致性与扩展性

- 核心 API 一致：统一输入输出约定（字节流、嵌入点、校验、错误）。
- 格式扩展：**编译期注册表**——每种格式实现 `Format` trait 并注册到表中；UI 自动生成支持列表。**不是运行时动态加载插件**（wasm 无法 dlopen，「动态扩展」不成立）。新增格式需附：嵌入点规范、传输可靠性结论、失败回退策略。
- 国际化：中英双语起步，文案字典化，避免硬编码。

---

## 十一、测试与验证

- 单元测试：各格式注入/提取/校验/加密/错误路径。
- **属性/往返测试**：随机 payload + 随机参数，inject→extract 必须 bit 级还原。
- **模糊测试**：对每个格式解析器跑 `cargo-fuzz`，防止恶意/损坏文件导致 panic 或越界。
- 真实语料：收集各格式真实样本（含边界：超小、超大、已含 trailer、损坏）。
- 兼容性测试：多 OS、多浏览器、目标阅读器/查看器（Office: Word/LibreOffice/Google Docs；图片/音视频: 主流查看器与播放器）；记录哪些会在重存时丢 overlay。
- 性能与内存：小/中/大三档，记录耗时与峰值内存，验证 O(块) 内存。
- 安全测试：KDF 参数正确性、RNG 可用性、AEAD 完整性与篡改检测、截断/重排攻击。
- **社交平台矩阵作为「活文档」**，按「传输方式」分列：

| 平台 | 通道 | png | jpeg | gif | webp | mp3 | mp4 | pdf | office |
|---|---|---|---|---|---|---|---|---|---|
| 微信 | 以文件发送 | 待测 | 待测 | 待测 | 待测 | … | | | |
| 微信 | 以图片/视频/语音发送 | 预期失效 | 预期失效 | 预期失效 | 预期失效 | 预期失效 | 预期失效 | N/A（仅文件） | N/A（仅文件） |
| 微博 / QQ | … | | | | | | | | |

---

## 十二、风险与对策

- 平台重编码（图片/视频）：如实标注「以图片/视频发送将失效」，引导「以文件发送」；不提供无法兑现的「稳健模式」承诺。
- PDF（默认警告）检测风险：post-EOF 字节是取证/杀软首查项，且破坏签名 / PDF-A——UI 默认警告，建议优先用 Office/PNG/WebP。
- 接收方二次保存：Office 文档被 Word/LibreOffice 重存、或被邮件网关 CDR「消毒」会重建 ZIP 丢掉 overlay——文档与 UI 注明。
- wasm 内存/无线程：流式处理 + 进度回调；**wasm32 ~2GB 上限是正确性约束**（web 胶水层绝不可把整文件读进线性内存）；超大文件引导桌面端。
- 库兼容（wasm）：纯 Rust、隔离封装、可替换；删除任何需要 C-FFI 的载体（这是删 RAR 的原因之一）。
- 合规与滥用：标注用途边界与法律风险；默认开启完整性校验，加密可选。

---

## 十三、项目结构

```
stegpack/                      # Cargo workspace
├── Cargo.toml                 # [workspace]
├── crates/
│   ├── core/                  # stegpack-core：无 IO、native+wasm 双目标
│   │   ├── src/lib.rs         # Format trait、inject/extract/verify
│   │   ├── src/registry.rs    # 编译期格式注册表
│   │   ├── src/container.rs   # trailer 容器编解码
│   │   ├── src/crypto.rs      # ChaCha20-Poly1305 / AES-GCM + Argon2id + 分块 AEAD
│   │   ├── src/stream.rs      # 流式 Read→Write 抽象
│   │   ├── src/families/      # 按 3 大代码族组织（不是一格式一文件）：
│   │   │   ├── chunk_box.rs   #   块/段/尾插入：png(zTXt)·jpeg(COM/APPn)·gif(注释块/尾追加)·mp3(尾追加)·mp4(free/uuid box)·pdf(尾追加)
│   │   │   ├── riff.rs        #   RIFF 容器：webp（如需可低成本加 wav）
│   │   │   └── zip_opc.rs     #   ZIP/OPC 容器：docx·xlsx·pptx
│   │   ├── src/transport.rs   # 传输壳：把载体打成正常 zip(STORE) / 从 zip 解出载体（与隐写无关）
│   │   └── src/error.rs
│   ├── cli/                   # 验证用 CLI（早期主要测试入口）
│   └── wasm/                  # wasm-bindgen 绑定 + JS 数据转换 + 平台 RNG 注入
├── src-tauri/                 # 桌面端
│   ├── src/main.rs
│   ├── src/commands.rs        # IPC 绑定 inject/extract/verify（流式）
│   └── tauri.conf.json        # 能力/权限、CSP（wasm-unsafe-eval）
└── ui/                        # 单一前端（Svelte/React 固定其一）
    ├── src/backend/           # StegBackend 抽象 + tauri/wasm 两实现
    ├── src/components/
    ├── src/store/
    ├── src/i18n/  (zh / en)
    └── src/theme/ (dark / light)
```

---

# stegpack 开发流程（优化后的执行顺序）

> 原计划为「需求→架构→核心→适配→UI→测试→发布」的线性瀑布，把 wasm 验证、加密容器、社交可靠性测试都压到后期，**高风险项暴露太晚**。下面改为「先打通最薄竖切（含 wasm + 加密），再横向铺格式，最后硬化」，关键风险前置。

## 阶段 0：地基（先把风险前置）

- 建 Cargo workspace + CI（fmt/clippy/test + **`wasm32-unknown-unknown` 构建检查**，从第一天就跑）。
- 定义 `Format` trait、错误模型、流式 `Read→Write` 抽象、trailer 容器格式。
- 立刻验证「一个最小核心」能同时编译为 native 与 wasm（证明工具链与库选型 wasm-clean）。

## 阶段 1：最薄竖切（端到端走通一遍）

- 选 **docx（ZIP 容器族代表）+ PNG（块/段插入族代表）** 两种格式，打通 inject/extract/verify。
- 集成加密容器：Argon2id + 分块 ChaCha20-Poly1305 + SHA-256，随 trailer 持久化。
- CLI 作为测试入口（也是正式交付物之一）；同一核心同时跑通 native 与 **wasm（浏览器内冒烟测试）**。
- 顺带做 `transport.rs`（zip 传输壳：打包/解包），导出/导入即可二选一——逻辑简单，早做早用。
- 产出：一个能加密、能往返、native+wasm 都验证过的最小可用核心。**此处验证完所有架构性风险。**

## 阶段 2：横向铺格式（按 3 大代码族复用）

- ZIP/OPC 容器族：补全 docx/xlsx/pptx（M1 已起步）。
- RIFF 容器族：WebP。
- 块/段/尾插入族：MP4（free/uuid box，兼顾 BMFF 家族）、JPEG（COM/APPn）、GIF（注释块或尾追加）、MP3（最后一帧后尾追加）、PDF（尾追加）。
- PDF 接入「默认警告」UI；所有媒体格式接入统一的「按社交媒体发会失效」提示。
- 每格式补：往返（bit 级还原）测试、模糊测试、真实样本、可靠性结论。
- 尽早做**社交平台可靠性测试**（哪怕只有 2–3 种格式），尽快用证据钉死「按媒体发=失效」这条边界。

## 阶段 3：桌面端 GUI（Tauri 2.x）

- IPC 流式命令、文件访问、进度/取消、错误与加密 UI。
- 因 wasm 已在阶段 1 验证，前端 `StegBackend` 接口此时定稿。

## 阶段 4：Web 应用（wasm）—— 可与阶段 3 部分并行

- 复用同一前端；接 wasm 后端；File System Access 流式落盘 + Blob 回退。
- 浏览器兼容矩阵、内存压测、超大文件引导桌面端。

## 阶段 5：硬化与交付

- 完成社交平台矩阵（活文档）、模糊与安全测试、性能/内存基线。
- 安全审查（加密、依赖更新）、i18n、主题、文档（格式白皮书、可靠性与风险指引）。
- 打包/签名（按需）、Web 部署、用户指南。

## 阶段 6：移动端（后期，可选）

- 加 Tauri 2.x 的 iOS/Android 构建目标 + 移动适配层（沙盒文件选择、分享面板、权限）。
- UI 与核心 crate **零重写**，仅适配触屏交互与移动 FS 限制。本期不做，但 M0–M5 的所有抽象已为此预留。

## 阶段 7：维护与扩展

- 新格式经编译期注册表接入；社区反馈；定期依赖与安全审计。

---

# 里程碑（对应执行顺序）

- **M0** 地基：workspace + CI + wasm 构建检查 + trait/容器/流式抽象。
- **M1** 竖切：zip + png 端到端 + 加密 + native/wasm 双验证（**架构风险清零**）。
- **M2** 横铺：约 10 种主流格式（图片 PNG·JPEG·GIF·WebP，音频 MP3，视频 MP4，文档 Office·PDF）完成 + 往返/模糊/可靠性测试。
- **M3** 桌面 GUI（Tauri 2.x，流式 IPC、加密、打包）。
- **M4** Web 应用（wasm、流式落盘/Blob 回退、浏览器兼容）。
- **M5** 硬化与文档：社交矩阵、安全审查、i18n、白皮书、签名/部署。
- **M6（可选/后期）** 移动 App：Tauri 2.x iOS/Android 目标 + 移动适配层，UI/核心零重写。

---

# 保障机制与风险控制（要点）

- 仅用规范允许的嵌入点，保证结构无损。
- trailer = magic + 版本 + 长度 + 校验 + 加密参数，保障提取准确与可恢复。
- 默认完整性校验（SHA-256），可选 AEAD 加密（默认 ChaCha20-Poly1305）。
- UI 完整性检查辅助验证可提取性。
- 社交平台行为以「活文档矩阵」如实呈现，按传输方式区分可靠/失效。
- 所有媒体格式统一「按社交媒体发会失效」提示；PDF 额外默认警告检测风险与签名失效。

---

# 附录 A：相对原计划的变更与依据

> 注：本附录记录的是对**原始计划**的第一轮技术纠正。其后又经一轮评审 + 按「大众熟悉度」的人工取舍对**格式集合**做了进一步调整（见第二节与附录 C）——本表中 exe、7z/rar 最终**整体删除**；MP3 则保留，并恰好采用其中「最后一帧后追加」这一改法。以附录 C 为准。

| 原计划 | 问题 | 修订 | 依据 |
|---|---|---|---|
| MP3「ID3v2 尾部填充」 | ID3v2 padding 在文件**头部**，非尾部 | 改为「最后一帧后追加 / ID3v2 footer」 | MP3 对尾部冗余数据宽容，追加是标准稳健做法 |
| exe「覆盖 DOS Stub 或 .rsrc 节末尾」 | 覆盖 DOS Stub 破坏 0x3C 偏移，危险 | 改为 overlay（最后一节后追加） | overlay 被 loader 忽略，是 SFX/安装包惯用且安全做法 |
| 7z/rar 尾部追加（与 zip 并列） | 会触发「data after end of payload」告警，非无声成功 | 降级为 C 组、UI 告警、建议 zip | 7-Zip/RAR 可打开但告警 |
| 验证矩阵列「微信 PNG/JPEG/GIF/MP4」为目标 | 社交平台二次编码会摧毁这些嵌入 | 改为「按文件发送可靠 / 按图片视频发送失效」分列 | 微信/微博对上传图片强制重编码 + 清元数据 |
| 加密「scrypt 或 Argon2」+ wasm 用 WebCrypto | 选择含糊；WebCrypto 与 Rust 双路径分叉、async 传染 | 默认 Argon2id；AEAD 用 RustCrypto 纯 Rust 置于核心，默认 ChaCha20-Poly1305 | Argon2id 为 OWASP 推荐；ChaCha 在无 AES-NI（wasm）更快 |
| 大文件「分块读写」泛泛而谈 | 未触及 wasm 内存上限与单次 AEAD 限制 | 核心改为流式 Read→Write + 分块 AEAD（STREAM 式） | wasm32 ~2–4GB 上限；GCM/Poly1305 不能单次跑多 GB |
| wasm 放在 M4 | 兼容性风险暴露太晚 | wasm 构建检查进 M0、wasm 冒烟测试进 M1 | 工具链/库 wasm 兼容是架构性风险，须前置 |
| 「插件化动态扩展」 | wasm 无法运行时动态加载 | 改为编译期格式注册表 | wasm 无 dlopen |
| Web 端「复制 CLI 参数」 | Web 无 CLI | 该功能仅桌面端 | — |
| 前端「React/Vue/Svelte 任一」 | 任选导致组件无法复用 | 固定单一框架（Svelte/React 二选一） | 双端共享 UI 的前提 |
| 浏览器大文件落盘 | 未区分浏览器能力 | Chromium 用 File System Access 流式落盘；FF/Safari 回退 Blob 并引导桌面端 | FF/Safari 不支持 showSaveFilePicker |

---

# 附录 B：参考来源

- Tauri 2.x 稳定版与安全模型：<https://v2.tauri.app/blog/tauri-20/>、<https://v2.tauri.app/security/>
- PE overlay 与 DOS stub：<https://learn.microsoft.com/en-us/windows/win32/debug/pe-format>、<https://isc.sans.edu/diary/31268>
- MP3 数据隐藏（追加/填充）：<http://justsolve.archiveteam.org/wiki/Data_Hiding/Embedding>
- 7z 尾部数据告警：<https://sourceforge.net/p/sevenzip/bugs/2025/>
- Argon2id / scrypt 选型与参数：<https://datatracker.ietf.org/doc/rfc9106/>、<https://multifactor.com/blog/kdf-parameter-selection-part-1>
- ChaCha20-Poly1305 vs AES-GCM（无 AES-NI）：<https://en.wikipedia.org/wiki/ChaCha20-Poly1305>、<https://soatok.blog/2020/07/12/comparison-of-symmetric-encryption-methods/>
- File System Access API 浏览器支持：<https://developer.mozilla.org/en-US/docs/Web/API/File_System_API>、<https://developer.chrome.com/docs/capabilities/web-apis/file-system-access>

---

# 附录 C：格式评审结论（方法与速查）

**方法**：对 11 组格式各跑「独立评估 → 对抗式复核（专门唱反调、找事实错误）」，再加一轮「完整性批判」找应当新增的更优载体，全程联网核查。下面是收敛结果。

| 决策 | 格式 | 一句话依据 |
|---|---|---|
| 支持 | PNG | 主流图片，zTXt 块合规、低检测、纯字节级 |
| 支持 | JPEG | 最自然的「照片」载体，人人都发 |
| 支持 | GIF | 大众熟悉的动图；按文件 / 不转码时有效（不算冗余） |
| 支持 | WebP | 现代主流图片，RIFF chunk 干净 |
| 支持 | MP3 | 大众音频格式；用「最后一帧后尾追加」避开 ID3 流式问题 |
| 支持 | MP4 | free/uuid box 规范支持，扫描器兼顾 MOV/M4A/HEIF |
| 支持 | Office(docx/xlsx/pptx) | ZIP/OPC overlay，文档最不起眼，三件套一套代码 |
| 支持⚠ | PDF | 极常见但检测风险最高、破坏签名 → 默认警告 |
| DROP | ZIP(裸) | 2026 杀软重点特征 + 报损坏；Office 已覆盖合法用途 |
| DROP | 7z | 打开即打印 `Tail Size=N` 暴露秘密大小；非大众格式 |
| DROP | RAR | 专有、无纯 Rust 写库(C-FFI)、需付费 |
| DROP | exe(PE) | 像恶意软件：被拦截 / 杀软扫 overlay / 破坏签名 |
| DROP | FLAC / WAV | 大众不认识、手上没有；音频用 MP3 即可 |
| 备选 | MKV·SVG·BMP·TIFF | 价值低或成本高，仅按需 |

**最终人工取舍（大众熟悉度优先，覆盖了纯技术评分）**：删除 FLAC/WAV（普通人不认识、手上没有这种文件），恢复 GIF/MP3（大众常用、非冗余，按文件发或平台不转码时有效），WebP 保留。载体首要属性是「常见、不起眼」，不是技术上最干净。

**复核揪出的几处关键事实纠正（已纳入正文）**：
- PNG：`png` crate 的 `add_ztxt_chunk` 仅在 `Encoder` 上、会重压 IDAT——必须手写 chunk 拼接，crate 只用于解析。
- MP3：正因 ID3v2 tag 写入需 Seek、破坏流式，最终 MP3 改用**最后一帧后尾部追加**（完全不碰 ID3）——既保留这个大众音频格式，又不破坏 O(块) 流式。
- GIF：多数解码器（gifsicle/Firefox/Chrome/ImageMagick/GIMP）容忍 `0x3B` 尾标后追加的字节，故 GIF 也能复用通用尾追加，成本低。
- ZIP：「Zombie ZIP」真实机制是 STORED 声明 + DEFLATE 数据的 size/CRC 不一致（CVE-2026-0866），检测靠比对 compressed/uncompressed size——但 post-EOCD 追加同样落在主流工具「报损坏」与取证回扫窗问题上，结论仍是删。
- 7z：尾追加 .7z 的真实告警是「There are data after the end of archive」并显示精确 `Tail Size`，比原描述更暴露。
- 三大代码族复用：Office(ZIP/OPC) / WebP(RIFF) / PNG·JPEG·GIF·MP3·MP4·PDF(块·段·尾插入)，UI 仍按单个格式列出，但代码与用户心智都按「载体族」组织。
