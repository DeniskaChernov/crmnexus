/** Убирает невидимые символы и нормализует ввод логина/пароля. */
export function normalizeCredential(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}
