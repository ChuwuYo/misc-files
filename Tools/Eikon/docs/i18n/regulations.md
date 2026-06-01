# 各国证件照官方规范（i18n 调研）

日期：2026-06-01 调研
作用：[i18n 规划](../decisions/2026-05-17-i18n-plan.md) §2.10 区域尺寸包扩展
的数据底座。所有尺寸、px、底色要求、规则均引自官方/政府来源。

> 标 `[unverified — needs native review]` = 二手/侧引来源，需原生使用者
> 拉取原文 PDF 确认。

## 1. 中国 PRC（与现有 `domain/sizes.ts` 比对）

| 文件 / EN | mm | px @ DPI | 底 | 头/面规则 | 来源 |
|---|---|---|---|---|---|
| 居民身份证（二代）/ Resident Identity Card | 26×32 | **358×441 @ 350 dpi** | white 纯白 | 面宽 207±14 px；头顶留白 7-21 px；下颌至底≥207 px | GA/T 461-2019（替代 GA 461-2004），公安部 — [SAMR](https://std.samr.gov.cn/hb/search/stdHBDetailed?id=92D0FC9FDA76A030E05397BE0A0A408C) |
| 普通护照 / PRC Ordinary Passport | 33×48 | 390×567 @ 300 | white | 头 28-33mm，面宽 15-22mm，上留白 3-5mm，下留白 ≥7mm；JPEG 30-80 KB | [中国领事服务网](https://cs.mfa.gov.cn/zlbg/bgzl/hzlxz/202204/t20220408_10665772.shtml) |
| 出入境证件（含港澳通行证/台湾通行证）| 33×48 | 354–480 × 472–640 (3:4) | white / 浅灰 / 浅蓝 | 正面、免冠、表情自然、不修饰 | [国家移民管理局](https://www.nia.gov.cn/n741445/n741619/n894511/c896346/content.html) `[unverified canonical ZIP — needs native review]` |
| 社会保障卡 / Social Security Card | 26×32 | 358×441 @ 350 | white | 沿用 GA/T 461 公安标准 | 公安/人社部（事实采用居民身份证规格）|
| 驾驶证 / Driver's License | 22×32 | 260×378 @ 300 | white（部分省份蓝底）| 公安部交管局规范 | 公安部 |
| NCRE / PSC | 12×16 NCRE / 33×48 PSC | 144×192 NCRE / 390×567 PSC | white | NCRE @ 305dpi（已对齐内部一致性）| 教育部考试中心 |
| 结婚证 / Marriage Certificate | 53×35 横版 | 626×413 | **红或蓝**（地方差异）| 民政部，民政各地可受蓝底 | 民政部 + [门头沟区民政局公告](https://www.bjmtg.gov.cn/bjmtg/c102956/202211/2f944659b8634e96981976eeabddeca4.shtml) |

**比对结论**：现有 PRC 条目全部对齐官方。两点微调建议：
- `cn-marriage` 当前只标 `red`，可在 `note` 中注明 "亦可蓝底（地方差异）"
- `cn-idcard` / `cn-social` 已正确使用 350dpi

## 2. 台湾 (zh-Hant)

| 文件 / EN | mm | px @ 300 | 底 | 头规则 | 来源 |
|---|---|---|---|---|---|
| 國民身分證 / National ID (R.O.C.) | 35×45 (橫3.5×直4.5公分) | 413×531 min | white | 頂至下巴 **3.2–3.6cm** | [內政部戶政司](https://www.ris.gov.tw/app/portal/187) |
| 中華民國護照（晶片）/ R.O.C. Passport | 35×45 | 413×531 min | white | 3.2–3.6cm；70-80% 画面 | [外交部領事事務局](https://www.boca.gov.tw/np-16-1.html) |
| 入出境許可證（臺灣地區無戶籍國民）| 35×45 | 413×531 | white | 同護照 | [內政部移民署](https://www.immigration.gov.tw/) |
| 自然人憑證 IC 卡 / MOICA Citizen Digital Cert | 戶政事務所现场拍 | — | — | — | [MOICA](https://moica.nat.gov.tw/) `[unverified — 不清楚是否支持外部上传]` |
| 國內駕駛執照 / Domestic Driving Licence | 28×35 (1吋光面彩色) | 331×413 | white/plain | 半身正面、近2年內 | [交通部公路局](https://www.mvdis.gov.tw/m3-emv/mustknow/car) |
| 國際駕照 / International Driving Permit | 42×47 (2吋) | 496×555 | white/plain | 半身、近2年內 | [公路局](https://www.thb.gov.tw/cp.aspx?n=96) |

## 3. 香港 SAR

| 文件 / EN | mm | px | 底 | 头规则 | 来源 |
|---|---|---|---|---|---|
| 香港特區護照（BN(O) 同样）| **40×50** | **≥1200×1600** | white | 下巴至頭頂 **32–36mm** | [入境事務處](https://www.immd.gov.hk/hkt/residents/immigration/traveldoc/photorequirements.html) |
| 簽證身份書 / Document of Identity | 40×50 | ≥1200×1600 | white | 32–36mm | 入境處（同護照页面）|
| 智能身份證 / Smart HKID | 40×50（如自带）| ≥1200×1600 | white | 32–36mm | [smartid.gov.hk](https://www.smartid.gov.hk/Photo-requirements-of-smart-identity-card/index.html) — 多数申请人在登记中心现场拍 |
| 駕駛執照 / HK Driving Licence | `[unverified — 运输署未公布 mm 规格]` | — | — | — | [td.gov.hk](https://www.td.gov.hk/tc/public_services/licences_and_permits/driving_licences/) |

## 4. 日本

| 文件 / EN | mm | px @ 300 | 底 | 头规则 | 来源 |
|---|---|---|---|---|---|
| 一般旅券 / Ordinary Passport | **35×45** | 413×531 | plain white/淡色 | 头顶至下巴 34±2mm，上留 4±2mm | [外務省](https://www.mofa.go.jp/mofaj/toko/passport/ic_photo.html) (ICAO 9303 兼容) |
| マイナンバーカード | 35×45 (mail-in) | digital 480–6000px | plain，无影/无图案 | 34±2mm，上留 4±2mm | [kojinbango-card.go.jp](https://www.kojinbango-card.go.jp/apprec/apply/facephoto/); 平成26年総務省令第85号 第22条 |
| 運転免許証 / Driver's License | **24×30** | 283×354 | plain（无背景） | 正面、免冠、上三分身 | [警視庁](https://www.keishicho.metro.tokyo.lg.jp/menkyo/koshin/koshin/koshin02_2.html) |
| 在留カード / Residence Card | **30×40** | 354×472 | plain，无影 | 免冠、正面、3 月内 | [moj.go.jp/isa](https://www.moj.go.jp/isa/applications/procedures/photo_info_00002.html) |
| ビザ申請（外国人）| **45×45** | 531×531 | plain white | 面高 27±2mm | 外務省（与现 `jp-visa` 一致）|
| 履歴書写真 / Resume Photo | **30×40** (de-facto) | 354×472 | plain 淡色 / 白 / 蓝 | 上半身 | 旧 JIS Z 8303 附属書 A（2020-07 已删除），现 [厚生労働省 履歴書样式例](https://jsite.mhlw.go.jp/shimane-roudoukyoku/content/contents/000874355.pdf) — 已非严格"规范" |
| 大学入学共通テスト | **40×30** (4×3cm, 4:3) | digital ≥600×450（推荐） | plain | 上半身 | 大学入試センター（令和 8 年 Web 出願）`[unverified — 受験案内 PDF needs native review]` |

## 5. 韩国

| 文件 / EN | mm | px | 底 | 头规则 | 来源 |
|---|---|---|---|---|---|
| 여권 / Passport | **35×45** | 推荐 **413×531** | uniform white，无边框 | 头顶至下巴 **32–36mm** (70–80%) | [외교부 여권안내](https://www.passport.go.kr/home/kor/contents.do?menuPos=32) (ICAO 9303 / 2022.10 개정) |
| 주민등록증 / Resident Registration Card | 35×45 | ≈413×531 | plain or white preferred | 上半身、正面、免冠 | [행정안전부](https://www.mois.go.kr/frt/sub/a06/b06/IDCard_5/screen.do); 주민등록법 시행규칙 제9조 |
| 운전면허증 / Driver's License | 35×45 (≈350×450) | ≥200, ≤500 (online) | white | 32–36mm | [도로교통공단](https://www.safedriving.or.kr/guide/larGuide10.do?menuCode=MN-PO-12111) |
| 비자（赴韩签证）| 35×45 | （未发布固定 px）| plain white/light | 面 25–35mm | [LA총영사관 통지](https://overseas.mofa.go.kr/us-losangeles-en/brd/m_4394/view.do?seq=725383) |

## 6. 国际

| 文件 / EN | mm | px @ 300 | 底 | 头规则 | 来源 |
|---|---|---|---|---|---|
| ICAO Doc 9303（基准）| **35×45** | ≥413×531 | uniform light | 头/下巴 70–80% 画面；ISO/IEC 19794-5 | [ICAO Doc 9303](https://www.icao.int/publications/doc-series/doc-9303) |
| Schengen Visa（EU 810/2009）| 35×45 | 413×531 | plain white/light | 32–36mm (70–80%) | EU Visa Code + ICAO — [schengenvisainfo.com](https://schengenvisainfo.com/photo/) |
| US Visa (DS-160) / Passport | **51×51 (2"×2")** | 600×600 至 1200×1200，JPEG ≤240 KB | white/off-white | 头部 50–69% 画幅；不戴眼镜（2016 起）| [travel.state.gov](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html) |
| UK Passport / Visa (HMPO) | 35×45 (印刷)；digital 600×750 至 1200×1500 | — | **plain 浅灰或米色**（首选）；纯白可受 | 头顶至下巴 **29–34mm**（比 ICAO 紧 1mm）| [HMPO Photoguidance v7 PDF](https://assets.publishing.service.gov.uk/media/5a7e2f0140f0b62302689b37/Photoguidance_v7.pdf) |

---

## 与现有 `domain/sizes.ts` 比对

### 重复（不新增条目，仅加多语 nameKey）

| 现有条目 | 同尺寸的外国文档 | 动作 |
|---|---|---|
| `cn-2cun-s` 35×45 | TW 身分證/護照、JP passport/マイナンバー、KR 여권/주민/운전、Schengen、UK passport、ICAO | 加多语 nameKey；如需"区域选择"再做汇总标签 |
| `cn-1cun-s` 22×32 | （同 cn-driver）| 已分两条 — OK |
| `jp-visa` 45×45 | （仅 JP 签证）| — |
| `us-visa` 51×51 | (US passport 同) | 可加 alias `us-passport` |
| `schengen-visa` 35×45 | 同上 | — |
| `uk-visa` 35×45 | (UK passport 同) | 可加 alias `uk-passport` |

### 同尺寸不同用途（独立条目，区分 nameKey）

- JP 履歴書写真 (30×40) — 与 JP 在留カード同尺寸但不同用途，**NEW**
- JP 運転免許 (24×30) — 最小标准之一，**NEW**
- JP 共通テスト (30×40) — 与 履歴書 同尺寸但语义独立，可共享 `jp-rireki` + note 备注，或独立
- HK 護照/HKID (40×50) — HK 独有尺寸，不在现有目录，**NEW**
- TW 駕照 (28×35) — **NEW**
- TW 國際駕照 (42×47) — **NEW**

### 推荐新增（按优先级排序）

| 优先级 | id | 文档 | mm | px @300 | category | 底 | 来源 |
|---|---|---|---|---|---|---|---|
| **P0** | `jp-rireki` | 履歴書写真 | 30×40 | 354×472 | common | white | [mhlw 岛根 PDF](https://jsite.mhlw.go.jp/shimane-roudoukyoku/content/contents/000874355.pdf) |
| **P0** | `jp-passport` | 日本旅券 | 35×45 | 413×531 | passport-visa | white | [mofa.go.jp](https://www.mofa.go.jp/mofaj/toko/passport/ic_photo.html) |
| **P0** | `jp-mynumber` | マイナンバーカード | 35×45 | 413×531 | id | white | [kojinbango-card.go.jp](https://www.kojinbango-card.go.jp/apprec/apply/facephoto/) |
| **P0** | `jp-driver` | 運転免許証 | 24×30 | 283×354 | id | plain | [keishicho](https://www.keishicho.metro.tokyo.lg.jp/menkyo/koshin/koshin/koshin02_2.html) |
| **P0** | `jp-zairyu` | 在留カード | 30×40 | 354×472 | id | plain | [moj.go.jp/isa](https://www.moj.go.jp/isa/applications/procedures/photo_info_00002.html) |
| **P0** | `kr-passport` | 韩国 여권 | 35×45 | 413×531 | passport-visa | white | [passport.go.kr](https://www.passport.go.kr/home/kor/contents.do?menuPos=32) |
| **P0** | `kr-id` | 주민등록증 | 35×45 | 413×531 | id | white | [mois.go.kr](https://www.mois.go.kr/frt/sub/a06/b06/IDCard_5/screen.do) |
| **P0** | `kr-driver` | 운전면허증 | 35×45 | 413×531 (或 350×450) | id | white | [safedriving.or.kr](https://www.safedriving.or.kr/guide/larGuide10.do?menuCode=MN-PO-12111) |
| **P0** | `tw-id` | 國民身分證 | 35×45 | 413×531 | id | white | [ris.gov.tw](https://www.ris.gov.tw/app/portal/187) |
| **P0** | `tw-passport` | 中華民國護照 | 35×45 | 413×531 | passport-visa | white | [boca.gov.tw](https://www.boca.gov.tw/np-16-1.html) |
| **P0** | `hk-passport` | 香港特區護照 | 40×50 | 472×591 @300（规格强制 ≥1200×1600，相当于 ~750dpi）| passport-visa | white | [immd.gov.hk](https://www.immd.gov.hk/hkt/residents/immigration/traveldoc/photorequirements.html) |
| **P0** | `hk-id` | 香港智能身份證 | 40×50 | 同上 | id | white | [smartid.gov.hk](https://www.smartid.gov.hk/Photo-requirements-of-smart-identity-card/index.html) |
| P1 | `tw-driver` | 中華民國駕照 | 28×35 | 331×413 | id | plain | [mvdis.gov.tw](https://www.mvdis.gov.tw/m3-emv/mustknow/car) |
| P1 | `tw-idp` | 中華民國國際駕照 | 42×47 | 496×555 | id | plain | [thb.gov.tw](https://www.thb.gov.tw/cp.aspx?n=96) |
| P1 | `jp-kyotsu` | 大学入学共通テスト | 30×40 | 354×472 | certificate | plain | DNC `[unverified]` |
| P2 | `us-passport` (alias) | US Passport | 51×51 | 600×600 | passport-visa | white | travel.state.gov |
| P2 | `uk-passport` (alias) | UK Passport | 35×45 | 413×531 | passport-visa | **浅灰/米色** | HMPO |

### `PhotoSpec` 推荐扩展字段（可选，向后兼容）

```ts
sourceUrl?: string                            // 监管 URL
regulationCode?: string                       // 如 "GA/T 461-2019"
headHeightMm?: { min: number; max: number }   // 头部高度范围
topMarginMm?: { min: number; max: number }    // 上留白范围
bgAllowList?: BackgroundPreset[]              // 多底色允许，如 cn-marriage 红/蓝
notes?: string[]                              // 杂项备注（多条 i18n）
```

---

## 待原生复核项

1. **PRC 出入境证件相片照相指引 ZIP** — 33×48mm / 354–480px range / 3:4
   均自侧引；NIA ZIP 内 PDF 未直接解析。请熟悉中国本地者下载
   [nia.gov.cn ZIP](https://www.nia.gov.cn/n741445/n741619/n894511/c896346/content.html)
   核对精确容差
2. **TW 自然人憑證 IC 卡** — MOICA 申请页主要描述现场拍；是否支持外部上传
   及对应规格未在网站公开，请确认
3. **HK 駕駛執照** — 运输署公开页面未发布 mm 规格，请依申请表 TD557 / TD63
   说明确认；事实上沿用 HKSAR 护照 40×50mm
4. **JP 共通テスト** — 数值 4×3cm / ≥450×600px / ≤5MB / JPEG·PNG 来自摄影店
   解释。需在 2026 版令和 8 年度大学入学共通テスト受験案内 PDF 出版后
   复核
5. **JP 履歴書 JIS 依据** — JIS Z 8303 附属書 A 2020-07 已被删除。
   30×40mm 现在事实依据为 厚労省 履歴書样式例 + 商业模板。`note` 内应注明
   "不再严格属于规范"
6. **PRC 结婚证 蓝底变体** — 各地民政差异，是否强制红底或允许蓝底。
   现 catalog 只标 `red`，建议 note 中注明地方差异

## 完整来源清单

- [GA/T 461-2019 居民身份证制证用数字相片技术要求](https://std.samr.gov.cn/hb/search/stdHBDetailed?id=92D0FC9FDA76A030E05397BE0A0A408C)
- [中国领事服务网 电子护照人像照片规格要求](https://cs.mfa.gov.cn/zlbg/bgzl/hzlxz/202204/t20220408_10665772.shtml)
- [国家移民管理局 出入境证件相片照相指引](https://www.nia.gov.cn/n741445/n741619/n894511/c896346/content.html)
- [民政部 / 北京门头沟区 结婚登记照片规格](https://www.bjmtg.gov.cn/bjmtg/c102956/202211/2f944659b8634e96981976eeabddeca4.shtml)
- [內政部戶政司 國民身分證相片規格](https://www.ris.gov.tw/app/portal/187)
- [外交部領事事務局 晶片護照照片規格](https://www.boca.gov.tw/np-16-1.html)
- [內政部移民署](https://www.immigration.gov.tw/)
- [MOICA 內政部憑證管理中心](https://moica.nat.gov.tw/)
- [交通部公路局 監理服務網 駕照考試須知](https://www.mvdis.gov.tw/m3-emv/mustknow/car)
- [公路局 申領國際駕照](https://www.thb.gov.tw/cp.aspx?n=96)
- [入境事務處 香港特區旅行證件相片規格](https://www.immd.gov.hk/hkt/residents/immigration/traveldoc/photorequirements.html)
- [smartid.gov.hk 智能身份證相片規格](https://www.smartid.gov.hk/Photo-requirements-of-smart-identity-card/index.html)
- [外務省 パスポート申請用写真の規格](https://www.mofa.go.jp/mofaj/toko/passport/ic_photo.html)
- [個人番号カード総合サイト 顔写真のチェックポイント](https://www.kojinbango-card.go.jp/apprec/apply/facephoto/)
- [警視庁 申請用写真及び持参写真のご案内](https://www.keishicho.metro.tokyo.lg.jp/menkyo/koshin/koshin/koshin02_2.html)
- [出入国在留管理庁 提出写真の規格](https://www.moj.go.jp/isa/applications/procedures/photo_info_00002.html)
- [厚生労働省 履歴書様式例（島根労働局 PDF）](https://jsite.mhlw.go.jp/shimane-roudoukyoku/content/contents/000874355.pdf)
- [외교부 여권안내 여권 사진](https://www.passport.go.kr/home/kor/contents.do?menuPos=32)
- [행정안전부 주민등록증](https://www.mois.go.kr/frt/sub/a06/b06/IDCard_5/screen.do)
- [도로교통공단 safedriving 운전면허](https://www.safedriving.or.kr/guide/larGuide10.do?menuCode=MN-PO-12111)
- [ICAO Doc 9303](https://www.icao.int/publications/doc-series/doc-9303)
- [Schengen Visa Info](https://schengenvisainfo.com/photo/)
- [US Dept. of State Photo Requirements](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html)
- [HMPO Photo Guidance PDF v7](https://assets.publishing.service.gov.uk/media/5a7e2f0140f0b62302689b37/Photoguidance_v7.pdf)
