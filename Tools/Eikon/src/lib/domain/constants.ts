/** Render-time constants — single source of truth for non-themeable,
 *  print-domain colors used by Canvas code (cannot read CSS vars). */
export const PAPER_BG = "#ffffff"; // print sheet paper
export const CUT_GUIDE = "#cccccc"; // cut-line guide around tiled cells
export const JPEG_FALLBACK_BG = "#ffffff"; // fill for alpha when encoding JPEG

/** Output policy — single source of truth for export encoding/layout. */
export const EXPORT_JPEG_QUALITY = 0.95;
export const SHEET_GAP_MM = 2;
