/** Core domain types. Single source of truth for shapes shared across modules. */

export type Unit = "mm" | "px" | "inch";

/** A target output specification for an ID photo. */
export interface PhotoSpec {
  /** Stable id, e.g. "cn-1cun". */
  id: string;
  /** Display name, e.g. "一寸". */
  name: string;
  /** Grouping for the size library UI. */
  category: SizeCategory;
  /** Physical size in millimetres. */
  widthMm: number;
  heightMm: number;
  /** Pixel size at the spec's print DPI. */
  widthPx: number;
  heightPx: number;
  /** Print resolution the px values assume. */
  dpi: number;
  /** Recommended background per the issuing standard. */
  recommendedBg?: BackgroundPreset;
  note?: string;
}

export type SizeCategory =
  | "common" /* 一寸/二寸等 */
  | "id" /* 身份证/社保/驾照 */
  | "passport-visa" /* 护照/签证 */
  | "certificate" /* 证书/考试 */
  | "photo-paper"; /* 相纸排版 */

export type BackgroundPreset = "white" | "blue" | "red" | "transparent";

export interface BackgroundColor {
  preset: BackgroundPreset | "custom";
  /** Resolved CSS color used for compositing. */
  hex: string;
}

/** A six-inch print sheet tiling job. */
export interface SheetLayout {
  sheet: PhotoSpec /* the paper, e.g. 六寸 */;
  cell: PhotoSpec /* the photo repeated on it */;
  gapMm: number;
  cols: number;
  rows: number;
}
