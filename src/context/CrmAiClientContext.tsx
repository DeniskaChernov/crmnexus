import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { CrmAiFocusPayload } from "../lib/aiChatClientPayload.ts";

type Ctx = {
  focus: CrmAiFocusPayload | null;
  setFocus: (f: CrmAiFocusPayload | null) => void;
  clearFocus: () => void;
};

const CrmAiClientContext = createContext<Ctx | undefined>(undefined);

export function CrmAiClientProvider({ children }: { children: React.ReactNode }) {
  const [focus, setFocusState] = useState<CrmAiFocusPayload | null>(null);
  const setFocus = useCallback((f: CrmAiFocusPayload | null) => {
    setFocusState(f);
  }, []);
  const clearFocus = useCallback(() => setFocusState(null), []);
  const value = useMemo(() => ({ focus, setFocus, clearFocus }), [focus, setFocus, clearFocus]);
  return <CrmAiClientContext.Provider value={value}>{children}</CrmAiClientContext.Provider>;
}

export function useCrmAiClient() {
  const v = useContext(CrmAiClientContext);
  if (!v) {
    throw new Error("useCrmAiClient: оберните приложение в CrmAiClientProvider");
  }
  return v;
}

/** Для компонентов вне провайдера (не используется в CRM Layout). */
export function useCrmAiClientOptional(): Ctx | null {
  return useContext(CrmAiClientContext) ?? null;
}

/** Сбрасывает фокус ИИ при смене маршрута (чтобы не «прилипала» старая сделка). */
export function CrmAiFocusResetOnRoute({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { clearFocus } = useCrmAiClient();
  useEffect(() => {
    clearFocus();
  }, [pathname, clearFocus]);
  return <>{children}</>;
}
