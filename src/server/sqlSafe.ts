const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function isSafeIdent(name: string): boolean {
  return IDENT_RE.test(name);
}

export function quoteIdent(name: string): string {
  if (!isSafeIdent(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

export function sanitizeReturning(returning: string | null): string {
  if (!returning || returning.trim() === "" || returning.trim() === "*") {
    return "*";
  }
  const cols = returning
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!cols.length) return "*";
  return cols.map((c) => quoteIdent(c)).join(", ");
}
