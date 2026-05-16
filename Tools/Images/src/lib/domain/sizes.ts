import type { BackgroundColor, BackgroundPreset, PhotoSpec } from "./types";

/** Standard background colors used by Chinese/international ID photo standards. */
export const BACKGROUNDS: Record<BackgroundPreset, BackgroundColor> = {
  white: { preset: "white", hex: "#ffffff" },
  blue: { preset: "blue", hex: "#438edb" }, // 标准证件照蓝
  red: { preset: "red", hex: "#ff0000" },
  transparent: { preset: "transparent", hex: "transparent" },
};

/**
 * Standard ID-photo size catalog. Pixel sizes are the officially cited values
 * (≈300 dpi). `widthMm/heightMm` drive print sizing and sheet tiling.
 */
export const PHOTO_SPECS: PhotoSpec[] = [
  // —— 常用证件照 ——
  {
    id: "cn-1cun",
    name: "一寸",
    category: "common",
    widthMm: 25,
    heightMm: 35,
    widthPx: 295,
    heightPx: 413,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "cn-1cun-s",
    name: "小一寸",
    category: "common",
    widthMm: 22,
    heightMm: 32,
    widthPx: 260,
    heightPx: 378,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "cn-1cun-l",
    name: "大一寸",
    category: "common",
    widthMm: 33,
    heightMm: 48,
    widthPx: 390,
    heightPx: 567,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "cn-2cun",
    name: "二寸",
    category: "common",
    widthMm: 35,
    heightMm: 49,
    widthPx: 413,
    heightPx: 579,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "cn-2cun-s",
    name: "小二寸",
    category: "common",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "cn-2cun-l",
    name: "大二寸",
    category: "common",
    widthMm: 35,
    heightMm: 53,
    widthPx: 413,
    heightPx: 626,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "cn-resume",
    name: "简历照",
    category: "common",
    widthMm: 25,
    heightMm: 35,
    widthPx: 295,
    heightPx: 413,
    dpi: 300,
    recommendedBg: "white",
  },

  // —— 身份/社保/驾照 ——
  {
    id: "cn-idcard",
    name: "二代身份证",
    category: "id",
    widthMm: 26,
    heightMm: 32,
    widthPx: 358,
    heightPx: 441,
    dpi: 350,
    recommendedBg: "white",
    note: "公安标准",
  },
  {
    id: "cn-social",
    name: "社保卡",
    category: "id",
    widthMm: 26,
    heightMm: 32,
    widthPx: 358,
    heightPx: 441,
    dpi: 350,
    recommendedBg: "white",
  },
  {
    id: "cn-driver",
    name: "驾驶证",
    category: "id",
    widthMm: 22,
    heightMm: 32,
    widthPx: 260,
    heightPx: 378,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "cn-marriage",
    name: "结婚证",
    category: "id",
    widthMm: 53,
    heightMm: 35,
    widthPx: 626,
    heightPx: 413,
    dpi: 300,
    recommendedBg: "red",
    note: "红底横版",
  },

  // —— 护照/签证 ——
  {
    id: "cn-passport",
    name: "护照",
    category: "passport-visa",
    widthMm: 33,
    heightMm: 48,
    widthPx: 390,
    heightPx: 567,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "cn-ehk",
    name: "港澳通行证",
    category: "passport-visa",
    widthMm: 33,
    heightMm: 48,
    widthPx: 390,
    heightPx: 567,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "us-visa",
    name: "美国签证",
    category: "passport-visa",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    recommendedBg: "white",
    note: "2×2 inch",
  },
  {
    id: "jp-visa",
    name: "日本签证",
    category: "passport-visa",
    widthMm: 45,
    heightMm: 45,
    widthPx: 531,
    heightPx: 531,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "schengen-visa",
    name: "申根签证",
    category: "passport-visa",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "uk-visa",
    name: "英国签证",
    category: "passport-visa",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    dpi: 300,
    recommendedBg: "white",
  },

  // —— 证书/考试 ——
  {
    id: "cn-degree",
    name: "毕业证/学位证",
    category: "certificate",
    widthMm: 33,
    heightMm: 48,
    widthPx: 390,
    heightPx: 567,
    dpi: 300,
    recommendedBg: "blue",
  },
  {
    id: "cn-teacher",
    name: "教师资格证",
    category: "certificate",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "cn-ncre",
    name: "计算机等级考试",
    category: "certificate",
    widthMm: 12,
    heightMm: 16,
    widthPx: 144,
    heightPx: 192,
    dpi: 300,
    recommendedBg: "white",
  },
  {
    id: "cn-psc",
    name: "普通话水平测试",
    category: "certificate",
    widthMm: 33,
    heightMm: 48,
    widthPx: 390,
    heightPx: 567,
    dpi: 300,
    recommendedBg: "white",
  },

  // —— 相纸（排版用） ——
  {
    id: "paper-5",
    name: "五寸相纸",
    category: "photo-paper",
    widthMm: 89,
    heightMm: 127,
    widthPx: 1051,
    heightPx: 1500,
    dpi: 300,
  },
  {
    id: "paper-6",
    name: "六寸相纸",
    category: "photo-paper",
    widthMm: 102,
    heightMm: 152,
    widthPx: 1205,
    heightPx: 1795,
    dpi: 300,
    note: "默认排版纸",
  },
];

export const SPEC_BY_ID = new Map(PHOTO_SPECS.map((s) => [s.id, s]));

/** Default print sheet for tiling (六寸相纸). */
export const DEFAULT_SHEET = SPEC_BY_ID.get("paper-6") as PhotoSpec;

/** A spec can be a sheet *cell* only if it is not itself photo paper. */
export function isSheetEligible(spec: PhotoSpec): boolean {
  return spec.category !== "photo-paper";
}

/** Build a custom spec from user input; px derived from mm at given dpi. */
export function customSpec(widthMm: number, heightMm: number, dpi = 300): PhotoSpec {
  const toPx = (mm: number) => Math.round((mm / 25.4) * dpi);
  return {
    id: `custom-${widthMm}x${heightMm}-${dpi}`,
    name: `自定义 ${widthMm}×${heightMm}mm`,
    category: "common",
    widthMm,
    heightMm,
    widthPx: toPx(widthMm),
    heightPx: toPx(heightMm),
    dpi,
  };
}
