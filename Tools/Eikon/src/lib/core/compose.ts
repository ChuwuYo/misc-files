/**
 * Six-inch print-sheet tiling. Given a single rendered photo and a paper
 * spec, computes the grid and draws repeated cells with a cut gap.
 *
 * STUB: signature stable; body filled during implementation plan.
 */
import type { PhotoSpec, SheetLayout } from "../domain/types";
import { PAPER_BG, CUT_GUIDE } from "../domain/constants";

export function planSheet(cell: PhotoSpec, sheet: PhotoSpec, gapMm = 2): SheetLayout {
  const usableW = sheet.widthMm;
  const usableH = sheet.heightMm;
  const cols = Math.max(1, Math.floor((usableW + gapMm) / (cell.widthMm + gapMm)));
  const rows = Math.max(1, Math.floor((usableH + gapMm) / (cell.heightMm + gapMm)));
  return { sheet, cell, gapMm, cols, rows };
}

export function composeSheet(photo: HTMLCanvasElement, layout: SheetLayout): HTMLCanvasElement {
  const { sheet, cell, gapMm, cols, rows } = layout;

  const canvas = document.createElement("canvas");
  canvas.width = sheet.widthPx;
  canvas.height = sheet.heightPx;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("composeSheet: failed to acquire 2D context");

  // Paper background.
  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Convert physical mm to sheet pixels so the print size is correct
  // regardless of the cell canvas's own resolution.
  const cellPxW = Math.round((cell.widthMm / sheet.widthMm) * sheet.widthPx);
  const cellPxH = Math.round((cell.heightMm / sheet.heightMm) * sheet.heightPx);
  const gapPxX = Math.round((gapMm / sheet.widthMm) * sheet.widthPx);
  const gapPxY = Math.round((gapMm / sheet.heightMm) * sheet.heightPx);

  // Center the grid: equal outer margins from leftover space.
  const gridW = cols * cellPxW + (cols - 1) * gapPxX;
  const gridH = rows * cellPxH + (rows - 1) * gapPxY;
  const originX = Math.round((canvas.width - gridW) / 2);
  const originY = Math.round((canvas.height - gridH) / 2);

  ctx.strokeStyle = CUT_GUIDE;
  ctx.lineWidth = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = originX + c * (cellPxW + gapPxX);
      const y = originY + r * (cellPxH + gapPxY);
      ctx.drawImage(photo, 0, 0, photo.width, photo.height, x, y, cellPxW, cellPxH);
      // 1px crisp cut guide around the cell.
      ctx.strokeRect(x + 0.5, y + 0.5, cellPxW - 1, cellPxH - 1);
    }
  }

  return canvas;
}
