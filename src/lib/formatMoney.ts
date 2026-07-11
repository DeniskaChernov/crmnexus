/** Безопасный парсинг суммы из API/БД (строка, число, null). */
export function parseAmount(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/\s/g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const uzsFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const uzsCompactFormatter = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Формат суммы в UZS: `12 500 000 UZS` */
export function formatUZS(amount: unknown, compact = false): string {
  const n = parseAmount(amount);
  const formatted = compact ? uzsCompactFormatter.format(n) : uzsFormatter.format(n);
  return `${formatted} UZS`;
}

/** Инициалы для аватара (кириллица/латиница). */
export function clientInitials(name?: string | null): string {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
