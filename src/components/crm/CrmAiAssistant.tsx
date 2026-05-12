import React, { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { CrmAiChatPanel } from "./CrmAiChatPanel.tsx";
import { Sparkles } from "lucide-react";

const OPEN_EVENT = "crm-open-ai-assistant";

export function CrmAiAssistant() {
  const [open, setOpen] = useState(false);

  const openSheet = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const handler = () => openSheet();
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, [openSheet]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg md:max-w-xl p-0 flex flex-col gap-0 border-l-4 border-violet-500/75 border-slate-200/90 shadow-2xl shadow-violet-950/15 sheet-content-smooth data-[state=open]:duration-500 data-[state=closed]:duration-300 overflow-hidden bg-gradient-to-b from-white via-slate-50/30 to-white"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Nexus CRM Intelligence</SheetTitle>
          <SheetDescription>Встроенный аналитик с доступом к данным CRM</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-violet-100/80 bg-gradient-to-r from-violet-600/8 via-indigo-600/5 to-transparent">
            <motion.div
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm"
              animate={open ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.6, times: [0, 0.5, 1] }}
            >
              <Sparkles className="h-4 w-4" />
            </motion.div>
            <div className="min-w-0 flex-1 pr-8">
              <p className="text-xs font-semibold text-slate-900 leading-tight">Панель аналитики</p>
              <p className="text-[10px] text-slate-500 truncate">Контекст экрана и CRM подставляются автоматически</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <CrmAiChatPanel variant="sheet" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function openCrmAiAssistant() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}
