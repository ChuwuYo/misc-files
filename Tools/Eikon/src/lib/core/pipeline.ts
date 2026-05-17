/**
 * Export orchestration. Keeps multi-step sequencing (render → compose →
 * encode) out of components. Components call one function.
 */
import type { CropperHandle } from "./cropper";
import type { BackgroundColor, PhotoSpec } from "../domain/types";
import { DEFAULT_SHEET, isSheetEligible } from "../domain/sizes";
import { composeSheet, planSheet } from "./compose";
import { type ExportFormat, exportCanvas } from "./export";
import { EXPORT_JPEG_QUALITY, JPEG_FALLBACK_BG, SHEET_GAP_MM } from "../domain/constants";

function fileBase(spec: PhotoSpec): string {
  return `证件照-${spec.name}-${spec.widthPx}x${spec.heightPx}`;
}

/** Render the current crop at spec size and download a single photo. */
export async function exportPhoto(
  cropper: CropperHandle,
  spec: PhotoSpec,
  bg: BackgroundColor,
  format: ExportFormat,
): Promise<void> {
  const canvas = await cropper.renderTo(spec, bg);
  const ext = format === "image/png" ? "png" : "jpg";
  await exportCanvas(
    canvas,
    `${fileBase(spec)}.${ext}`,
    format,
    EXPORT_JPEG_QUALITY,
    JPEG_FALLBACK_BG,
  );
}

/** Render the current crop and tile it onto the default print sheet. */
export async function exportSheet(
  cropper: CropperHandle,
  spec: PhotoSpec,
  bg: BackgroundColor,
): Promise<void> {
  if (!isSheetEligible(spec)) {
    throw new Error("相纸尺寸不能作为排版单元。");
  }
  const photo = await cropper.renderTo(spec, bg);
  const layout = planSheet(spec, DEFAULT_SHEET, SHEET_GAP_MM);
  const sheet = composeSheet(photo, layout);
  await exportCanvas(sheet, `证件照-六寸排版-${spec.name}.jpg`, "image/jpeg", EXPORT_JPEG_QUALITY);
}
