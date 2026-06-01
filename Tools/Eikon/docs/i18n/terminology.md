# i18n 术语对照表（5-locale）

来源策略表：[i18n 规划 ADR](../decisions/2026-05-17-i18n-plan.md)
区域规范来源：[regulations.md](./regulations.md)

**Locale 集**：`zh-Hans`（源）· `zh-Hant` · `en` · `ja` · `ko`

**ja 风格**：丁寧体（〜です/ます）或名词句；按钮/标签优先 sahen-noun 词干。
**避免敬語**。
**ko 风格**：명사구（按钮/标签）；正文允许 합쇼체（〜습니다）。**避免 해요体**。

`[best practice]` = 综合 MS Style Guide / Apple HIG / 政府文档 / 同业惯例
`[native review]` = 高不确定，需要原生使用者复核

---

## A. 寸尺寸（hybrid 政策 §2.8）

ja/ko 统一用 Pinyin 转写 `1cun`，不用 `寸`（避免与日韩本地"寸"语义冲突）。

| zh-Hans | zh-Hant | en | ja | ko | 来源 |
|---|---|---|---|---|---|
| 一寸 | 一寸 | `1-cun (25×35mm)` | `1cun (25×35mm)` | `1cun (25×35mm)` | [best practice] §2.8 |
| 小一寸 | 小一寸 | `Small 1-cun (22×32mm)` | `小1cun (22×32mm)` | `소1cun (22×32mm)` | [best practice] |
| 大一寸 | 大一寸 | `Large 1-cun (33×48mm)` | `大1cun (33×48mm)` | `대1cun (33×48mm)` | [best practice] |
| 二寸 | 二寸 | `2-cun (35×49mm)` | `2cun (35×49mm)` | `2cun (35×49mm)` | [best practice] |
| 小二寸 | 小二寸 | `Small 2-cun (35×45mm)` | `小2cun (35×45mm)` | `소2cun (35×45mm)` | [best practice] 同 Schengen 35×45，独立 nameKey |
| 大二寸 | 大二寸 | `Large 2-cun (35×53mm)` | `大2cun (35×53mm)` | `대2cun (35×53mm)` | [best practice] |

`[native review]` — 寸-cluster 在 ja/ko 用 Pinyin `1cun` 形式有否阅读障碍

## B. PRC 证件名

| zh-Hans | zh-Hant | en | ja | ko | 来源 |
|---|---|---|---|---|---|
| 二代身份证 | 國民身分證（TW 平行）| Chinese ID Card (2nd-gen) | 中国身分証（第2世代）| 중국 신분증（2세대）| Wikipedia/PRC State Council EN = "Resident Identity Card"，plan §2.8 选 layperson 友好 |
| 社保卡 | 社會保險卡 | Social Security Card | 社会保障カード | 사회보장카드 | [native review JP] |
| 驾驶证 | 駕駛執照/駕照 | Driver's License | 運転免許証 | 운전면허증 | PRC EN: "Driving License of the PRC" |
| 结婚证 | 結婚證書 | Marriage Certificate | 結婚証明書 | 혼인증명서 | Wikipedia / MoCA |
| 港澳通行证 | 港澳通行證 | Mainland Travel Permit (HK/Macao) | 中国本土通行証（香港・マカオ住民用）| 중국 본토 통행증（홍콩·마카오 주민용）| HK Immigration Dept |
| 毕业证/学位证 | 畢業證書/學位證書 | Graduation / Degree Certificate | 卒業証書 / 学位記 | 졸업증서 / 학위증서 | CHSI/MOE |
| 教师资格证 | 教師證（TW: 教師證書）| Teacher Qualification Certificate | 教員資格証 `[native review]` | 교원자격증 | MOE |
| 计算机等级考试 | 計算機等級考試（脚本转）| National Computer Rank Examination (NCRE) | 全国コンピュータ等級試験 (NCRE) | 전국 컴퓨터 등급시험 (NCRE) | NEEA |
| 普通话水平测试 | 普通話水平測試（脚本转）| Putonghua Proficiency Test (PSC) | 普通話水平測試 (PSC) | 보통화 수평 시험 (PSC) | PSC Wikipedia |
| 护照 | 護照 | Passport | パスポート | 여권 | universal |

## C. 国际签证

| zh-Hans | zh-Hant | en | ja | ko | 来源 |
|---|---|---|---|---|---|
| 美国签证 | 美國簽證 | US Visa | アメリカビザ | 미국 비자 | plan §2.8；ja 米国查证 = formal |
| 日本签证 | 日本簽證 | Japan Visa | 日本ビザ | 일본 비자 | MoFA Japan |
| 申根签证 | 申根簽證 | Schengen Visa | シェンゲンビザ | 솅겐 비자 | TW MoFA / German Embassy |
| 英国签证 | 英國簽證 | UK Visa | イギリスビザ `[native review]` | 영국 비자 | [best practice] |

## D. 相纸（真英寸）

| zh-Hans | zh-Hant | en | ja | ko | 来源 |
|---|---|---|---|---|---|
| 五寸相纸 | 五吋相紙 | 5-inch Paper (89×127mm) | 5インチ印画紙 (89×127mm) | 5인치 인화지 (89×127mm) | plan §2.8 — zh-Hant 用 `吋`（英寸）区别 `寸` |
| 六寸相纸 | 六吋相紙 | 6-inch Paper (102×152mm) | 6インチ印画紙 (102×152mm) | 6인치 인화지 (102×152mm) | 默认排版 |

## E. 底色

| zh-Hans 短 | zh-Hant | en 短 | en 长 | ja 短/长 | ko 短/长 |
|---|---|---|---|---|---|
| 白底 | 白底 | White | White background | 白 / 白背景 | 흰색 / 흰색 배경 |
| 蓝底 | 藍底 | Blue | Blue background | 青 / 青背景 | 파란색 / 파란색 배경 |
| 红底 | 紅底 | Red | Red background | 赤 / 赤背景 | 빨간색 / 빨간색 배경 |
| 透明 | 透明 | Transparent | Transparent background | 透明 / 透明背景 | 투명 / 투명 배경 |
| 自定义 | 自訂（TW）| Custom | Custom color | カスタム / カスタムカラー | 사용자 지정 / 사용자 지정 색상 |

## F. 分类

| zh-Hans | zh-Hant | en | ja | ko |
|---|---|---|---|---|
| 常用 | 常用 | Common | よく使う | 자주 사용 |
| 证件 | 證件 | ID Documents | 身分証 | 신분증 |
| 护照签证 | 護照簽證 | Passport & Visa | パスポート・ビザ | 여권·비자 |
| 证书考试 | 證書考試 | Certificates & Exams | 証明書・試験 | 자격증·시험 |
| 相纸 | 相紙 | Photo Paper | 印画紙 | 인화지 |

## G. UI 动词/动作

| zh-Hans | zh-Hant | en | ja | ko | 来源 |
|---|---|---|---|---|---|
| 上传 | 上傳 | Upload | アップロード | 업로드 | MS JP/KR SG |
| 下载 | 下載 | Download | ダウンロード | 다운로드 | MS JP/KR SG |
| 导出 | 匯出 | Export | エクスポート | 내보내기 | TW SG 用 匯出；ko 用 내보내기（汉字 익스포트） |
| 重置 | 重設 | Reset | リセット | 초기화 | MS SG 全栈 |
| 取消 | 取消 | Cancel | キャンセル | 취소 | universal |
| 应用 | 套用（TW）| Apply | 適用 | 적용 | TW SG |
| 确定 | 確定 | OK | OK | 확인 | MS SG |
| 清除 | 清除 | Clear | クリア | 지우기 | [best practice] |
| 拖拽 | 拖曳（TW）| Drag | ドラッグ | 드래그 | TW SG |
| 点击 | 點擊 | Click | クリック | 클릭 | universal |
| 重新选择 | 重新選擇 | Reselect | 選び直す | 다시 선택 | [best practice] |
| 切换主题 | 切換主題 | Toggle theme | テーマ切り替え | 테마 전환 | [best practice] |
| 切换语言 | 切換語言 | Switch language | 言語切り替え | 언어 전환 | [best practice] aria-label |
| 压缩 | 壓縮 | Compress | 圧縮 | 압축 | universal |
| 压缩并下载 | 壓縮並下載 | Compress & download | 圧縮してダウンロード | 압축 후 다운로드 | [best practice] |
| 处理中 | 處理中 | Processing… | 処理中… | 처리 중… | [best practice] U+2026 |
| 压缩中 | 壓縮中 | Compressing… | 圧縮中… | 압축 중… | [best practice] |
| 加载中 | 載入中 | Loading… | 読み込み中… | 불러오는 중… | TW: 載入 |

## H. 调节项（图片工具）

| zh-Hans | zh-Hant | en | ja | ko | 来源 |
|---|---|---|---|---|---|
| 亮度 | 亮度 | Brightness | 明るさ | 밝기 | Adobe JP / Apple JP |
| 对比度 | 對比度 | Contrast | コントラスト | 대비 | Photoshop KR |
| 饱和度 | 飽和度 | Saturation | 彩度 | 채도 | Adobe JP |
| 色相 | 色相 | Hue | 色相 | 색조 | shared CJK 词 |
| 色温 | 色溫 | Color temperature | 色温度 | 색온도 | ja 完整形 色温度 |
| 黑白 | 黑白 | Black & white | モノクロ | 흑백 | ja モノクロ（非 白黒）|
| 锐化 | 銳化 | Sharpen | シャープ | 선명하게 | Adobe JP / Photoshop KR |
| 模式 | 模式 | Mode | モード | 모드 | universal |
| 实时调整 | 即時調整 | Live adjust | リアルタイム調整 | 실시간 조정 | TW: 即時 |
| 重置全部 | 全部重設 | Reset all | すべてリセット | 모두 초기화 | [best practice] |
| 暖 | 暖 | Warm | 暖 / 暖色 | 따뜻하게 | slider 端 |
| 冷 | 冷 | Cool | 寒色 `[native review]` | 차갑게 | ja: 冷色 不通用 |
| 中性 | 中性 | Neutral | 中間 | 중간 | ja 中性 = 化学语义 |
| 已节省 | 已節省 | Saved | 削減 | 절약됨 | [best practice] |
| 压缩前 | 壓縮前 | Before | 圧縮前 | 압축 전 | |
| 压缩后 | 壓縮後 | After | 圧縮後 | 압축 후 | |

## I. 裁剪

| zh-Hans | zh-Hant | en | ja | ko |
|---|---|---|---|---|
| 裁剪 | 裁剪 | Crop | トリミング | 자르기 |
| 旋转 | 旋轉 | Rotate | 回転 | 회전 |
| 放大 | 放大 | Zoom in | 拡大 | 확대 |
| 缩小 | 縮小 | Zoom out | 縮小 | 축소 |
| 居中 | 置中（TW）| Center | 中央揃え | 가운데 정렬 |
| 重置 | 重設 | Reset | リセット | 초기화 |
| 适应 | 適應 | Fit | フィット | 맞춤 |
| 1:1 | 1:1 | 1:1 | 1:1 | 1:1 |
| 适合屏幕 | 符合螢幕 | Fit screen | 画面に合わせる | 화면 맞춤 |

## J. 错误/状态（UX-grade）

| zh-Hans | zh-Hant | en | ja | ko |
|---|---|---|---|---|
| 图片加载失败 | 圖片載入失敗 | Failed to load image | 画像の読み込みに失敗しました | 이미지를 불러오지 못했습니다 |
| 导出失败 | 匯出失敗 | Export failed | エクスポートに失敗しました | 내보내기에 실패했습니다 |
| 排版生成失败 | 排版生成失敗 | Layout generation failed | レイアウトの生成に失敗しました | 레이아웃 생성에 실패했습니다 |
| 图片压缩失败 | 圖片壓縮失敗 | Image compression failed | 画像の圧縮に失敗しました | 이미지 압축에 실패했습니다 |
| 未选择文件 | 未選擇檔案（TW）| No file selected | ファイルが選択されていません | 선택된 파일이 없습니다 |
| 不支持的格式 | 不支援的格式（TW）| Unsupported format | サポートされていない形式です | 지원되지 않는 형식입니다 |
| 图片不能超过 `{X}` MB | 圖片不可超過 `{X}` MB | Image must not exceed `{X}` MB | 画像は `{X}` MB を超えることはできません | 이미지는 `{X}` MB를 초과할 수 없습니다 |
| 预览未就绪 | 預覽尚未就緒 | Preview not ready | プレビューの準備ができていません | 미리보기가 준비되지 않았습니다 |
| 请先加载图片 | 請先載入圖片 | Load an image first | 先に画像を読み込んでください | 먼저 이미지를 불러오세요 |
| 页面加载失败 | 頁面載入失敗 | Page failed to load | ページの読み込みに失敗しました | 페이지를 불러오지 못했습니다 |

## K. 品牌（plan §2.4 — never translate）

5 locale 顶栏 wordmark 全部为 `方寸 Eikon`。document.title 模式：

| Locale | wordmark | document.title | 示例 |
|---|---|---|---|
| zh-Hans | `方寸 Eikon` | `${routeTitle} · 方寸 Eikon` | `证件照 · 方寸 Eikon` |
| zh-Hant | `方寸 Eikon` | `${routeTitle} · 方寸 Eikon` | `證件照 · 方寸 Eikon` |
| en | `方寸 Eikon` | `${routeTitle} · 方寸 Eikon` | `ID Photo · 方寸 Eikon` |
| ja | `方寸 Eikon` | `${routeTitle}・方寸 Eikon` | `証明写真・方寸 Eikon`（无空格）|
| ko | `方寸 Eikon` | `${routeTitle} · 方寸 Eikon` | `증명사진 · 方寸 Eikon` |

## L. 单位 / 格式（不翻译）

| Token | 全 locale |
|---|---|
| mm | mm |
| px | px |
| DPI | DPI |
| MB / KB | MB / KB（数字走 `Intl.NumberFormat`）|
| % | % |
| × | × (U+00D7，非 ASCII x) |
| 2×2 inch | en: `2×2 inch` / ja: `2×2インチ` / ko: `2×2인치` / zh: `2×2英寸` |

## M. 切换器菜单 — 本地显示名

| BCP47 | 显示 | `lang` 属性 |
|---|---|---|
| zh-Hans | 简体中文 | `lang="zh-Hans"` |
| zh-Hant | 繁體中文 | `lang="zh-Hant"` |
| en | English | `lang="en"` |
| ja | 日本語 | `lang="ja"` |
| ko | 한국어 | `lang="ko"` |

## N. CJK 标点本地化（关键）

| Locale | 分隔符 | Unicode | 来源 |
|---|---|---|---|
| zh-Hans | `·` MIDDLE DOT | U+00B7 | GB/T 15834-2011 |
| zh-Hant | `·` MIDDLE DOT | U+00B7 | TW MoE 标点；亦有用 `・` 的，统一 U+00B7 |
| en | `·` MIDDLE DOT | U+00B7 | conventional |
| **ja** | **`・` KATAKANA MIDDLE DOT** | **U+30FB** | JIS X 4051 / MS JP SG —— **JP 专用且无空格** |
| ko | `·` MIDDLE DOT | U+00B7 | National Institute of Korean Language |

**实现规则**：分隔符走 `common_separator` 消息键；模板用
`{routeTitle}{separator}{brand}` 拼接。**禁止硬编码 `·` 或 `・`**。

ja 习惯 `・` 两侧**无空格**；其他 locale 保留**两侧单空格**。

应用范围：

- `无损 · oxipng` → ja: `ロスレス・oxipng`，其他: `Lossless · oxipng` 等
- `${routeTitle} · 方寸 Eikon` → ja 无空格，其他有空格

---

## 标记总览

### 与 plan 政策的冲突
**无硬冲突**。PRC 自有 EN 名 "Resident Identity Card" 与 plan 的
"Chinese ID Card (2nd-gen)" 不同，但 plan 选了对普通用户更友好的措辞。
若日后偏好严格官方命名，开新 ADR。

### 高不确定项（需原生复核）
1. (A) 寸-cluster 在 ja/ko 用 Pinyin `1cun` — 技术上工作，但 JP/KR
   原生读起来是否如"中国文化规格"清晰？
2. (B) `教师资格证` ja `教員資格証` — JP 自有 `教員免許状`；现 calque 可能
   读成 "credential card"，非 "license"
3. (B) `港澳通行证` ja/ko 功能化翻译过长，UI 中可能需要简化
4. (B) `计算机等级考试` zh-Hant — 是用脚本转 `計算機等級考試`（PRC 测试不
   翻译）还是替换 TW 的 `電腦能力檢定`？plan §2.10 表明它是 12×16mm PRC-only
   尺寸，无 TW 平行——保留 PRC 名，仅复核语气
5. (C) `UK Visa` ja: `イギリスビザ` vs `英国ビザ` — 取决于品牌语气
6. (H) 锐化/色温：ja 滑块端标签往往单汉字（`暖`/`冷`），但 `冷` 在
   摄影编辑器里偏好 `寒色` — 上下文决定
7. (G) ja `エクスポート` (片假名) vs `書き出し` (汉字) — Adobe JP 用 `書き出し`
   而 MS 用 `エクスポート`，需统一品牌语气
