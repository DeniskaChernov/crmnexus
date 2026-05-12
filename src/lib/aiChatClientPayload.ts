export type CrmAiFocusKind = "deal" | "task" | "lead" | "company" | "contact";

export type CrmAiFocusPayload = {
  kind: CrmAiFocusKind;
  id: string;
  label?: string;
};

/** То, что фронт шлёт в POST /ai-chat для привязки ответа к экрану и выбранной сущности. */
export type AiChatClientPayload = {
  pathname: string;
  search?: string;
  pageLabel?: string;
  focus?: CrmAiFocusPayload | null;
  sentAt?: string;
};

const FOCUS_KINDS = new Set<CrmAiFocusKind>(["deal", "task", "lead", "company", "contact"]);

function safeId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().slice(0, 80);
  if (s.length < 1) return null;
  if (!/^[\w.-]+$/.test(s)) return null;
  return s;
}

/** Ограничиваем доверенный ввод с клиента (только метаданные UI). */
export function sanitizeAiChatClientPayload(raw: unknown): AiChatClientPayload | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pathname =
    typeof o.pathname === "string" ? o.pathname.trim().slice(0, 512) : "";
  if (!pathname.startsWith("/")) return null;

  const search = typeof o.search === "string" ? o.search.trim().slice(0, 400) : "";
  const pageLabel = typeof o.pageLabel === "string" ? o.pageLabel.trim().slice(0, 160) : "";
  const sentAt = typeof o.sentAt === "string" ? o.sentAt.trim().slice(0, 40) : "";

  let focus: CrmAiFocusPayload | null | undefined;
  if (o.focus != null) {
    if (typeof o.focus !== "object") {
      focus = null;
    } else {
      const f = o.focus as Record<string, unknown>;
      const kind = f.kind;
      const id = safeId(f.id);
      const label = typeof f.label === "string" ? f.label.trim().slice(0, 200) : undefined;
      if (typeof kind === "string" && FOCUS_KINDS.has(kind as CrmAiFocusKind) && id) {
        focus = { kind: kind as CrmAiFocusKind, id, label };
      } else {
        focus = null;
      }
    }
  }

  return {
    pathname,
    search: search || undefined,
    pageLabel: pageLabel || undefined,
    focus: focus === undefined ? undefined : focus,
    sentAt: sentAt || undefined,
  };
}
