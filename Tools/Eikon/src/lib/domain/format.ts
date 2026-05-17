/** Presentation-domain formatting helpers (pure, no side effects). */

/** Human-readable byte size, e.g. 1280 → "1.3 KB". */
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
