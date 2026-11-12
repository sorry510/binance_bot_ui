// Display original SQL DECIMAL strings: never round PnL or quantities through
// JS Number, which cannot preserve 18-decimal-place accounting precision.
export function formatSpotDecimal(value?: string | null): string {
  if (value === undefined || value === null || value === "") return "-";
  const raw = String(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return "-";
  if (!raw.includes(".")) return raw;
  return raw.replace(/0+$/, "").replace(/\.$/, "");
}
export function formatSpotTime(value?: number | string): string {
  if (!value) return "-";
  const number = Number(value);
  const milliseconds = number < 100000000000 ? number * 1000 : number;
  const parsed = new Date(milliseconds);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString();
}
export function hasPreciseSpotPnL(value: {
  total_pnl?: string;
  has_mark_price: boolean;
  fully_priced: boolean;
  needs_review?: boolean;
  position: { status: string };
}): boolean {
  return (
    !value.needs_review &&
    value.fully_priced &&
    (value.has_mark_price || value.position.status === "CLOSED") &&
    value.total_pnl !== undefined &&
    value.total_pnl !== ""
  );
}
