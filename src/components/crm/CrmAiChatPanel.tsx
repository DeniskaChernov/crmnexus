import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { crmUrl, authHeaders } from "../../lib/crmApi.ts";
import type { AiChatClientPayload } from "../../lib/aiChatClientPayload.ts";
import { useCrmAiClientOptional } from "../../context/CrmAiClientContext.tsx";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Sparkles, Send, Loader2, User, Bot, Trash2, Paperclip, X, Zap, Target } from "lucide-react";
import { crm } from "@/lib/crmClient.ts";
import { toast } from "sonner@2.0.3";

const newMsgId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const CRM_AI_WELCOME =
  "👋 Я встроенный CRM-аналитик BTT NEXUS: продажи, маркетинг, задачи и производство на основе живых данных.\n\n" +
  "Учитываю текущий раздел и открытую сделку/контакт/задачу (если вы их открыли в CRM) — можно спросить «что с этой сделкой?».\n\n" +
  "Могу: разобрать воронку и сделки, расставить приоритеты по задачам, подсказать работу с лидами и клиентами, оценить риски и следующий шаг.\n\n" +
  "С чего начнём?";

const PAGE_LABELS: Record<string, string> = {
  "/": "Дашборд",
  "/database": "База данных",
  "/deals": "Сделки",
  "/deals/archive": "Архив сделок",
  "/tasks": "Задачи",
  "/marketing": "Маркетинг",
  "/warehouse": "Склад",
  "/employees": "Сотрудники",
  "/settings": "Настройки",
  "/import": "Импорт",
  "/ai-chat": "ИИ-чат",
  "/recipes": "Рецепты",
  "/production-calendar": "Календарь производства",
  "/sales-analytics": "Аналитика продаж",
  "/leads": "Лиды",
};

const QUICK_PROMPTS: { label: string; text: string; icon?: "zap" | "target" }[] = [
  { label: "Воронка", text: "Кратко: что сейчас узкое место в воронке и 3 приоритетных действия?", icon: "target" },
  { label: "Просрочки", text: "Какие просроченные задачи критичны и что сделать сегодня?", icon: "zap" },
  { label: "План месяца", text: "Как идём к плану продаж месяца и что дожать?", icon: "target" },
  { label: "Лиды", text: "Как обработать холодную базу лидов приоритетно?", icon: "zap" },
  { label: "Производство", text: "Как связать открытые сделки с загрузкой производства?", icon: "target" },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  timestamp: Date;
}

export type CrmAiChatVariant = "page" | "sheet";

interface CrmAiChatPanelProps {
  variant?: CrmAiChatVariant;
}

export function CrmAiChatPanel({ variant = "page" }: CrmAiChatPanelProps) {
  const location = useLocation();
  const aiClient = useCrmAiClientOptional();
  const pageLabel = PAGE_LABELS[location.pathname] ?? location.pathname;

  const [messages, setMessages] = useState<Message[]>(() => [
    { id: newMsgId(), role: "assistant", content: CRM_AI_WELCOME, timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadUserAndHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);

      const {
        data: { session },
      } = await crm.auth.getSession();
      if (!session?.user) {
        setHistoryLoading(false);
        return;
      }

      const currentUserId = session.user.id;
      setUserId(currentUserId);

      const response = await fetch(`${crmUrl(`/ai-chat-history?userId=${currentUserId}`)}`, {
        method: "GET",
        headers: { ...authHeaders(false) },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const loadedMessages = data.messages.map((msg: any) => {
            let content = msg.content;
            let imageUrl = msg.imageUrl;

            if (Array.isArray(content)) {
              const textPart = content.find((c: any) => c.type === "text");
              const imagePart = content.find((c: any) => c.type === "image_url");

              content = textPart ? textPart.text : "";
              if (imagePart) {
                imageUrl = imagePart.image_url.url;
              }
            }

            return {
              id: typeof msg.id === "string" ? msg.id : newMsgId(),
              role: msg.role,
              content,
              imageUrl,
              timestamp: new Date(msg.timestamp),
            };
          });
          setMessages(loadedMessages);
        }
      }
    } catch (error) {
      console.warn("Error loading chat history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUserAndHistory();
  }, [loadUserAndHistory]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Размер файла не должен превышать 5МБ");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadImage = async (base64Image: string): Promise<string | null> => {
    try {
      const res = await fetch(base64Image);
      const blob = await res.blob();
      const file = new File([blob], "image.png", { type: "image/png" });

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${crmUrl("/upload")}`, {
        method: "POST",
        headers: { ...authHeaders(false) },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Ошибка загрузки изображения");
      return null;
    }
  };

  const sendMessage = async (presetText?: string) => {
    const textBody = (presetText !== undefined ? presetText : input).trim();
    if ((!textBody && !selectedImage) || loading || !userId) return;

    let imageUrl: string | undefined;

    if (selectedImage) {
      setLoading(true);
      const uploadedUrl = await uploadImage(selectedImage);
      if (!uploadedUrl) {
        setLoading(false);
        return;
      }
      imageUrl = uploadedUrl;
    }

    const userMessage: Message = {
      id: newMsgId(),
      role: "user",
      content: textBody,
      imageUrl,
      timestamp: new Date(),
    };

    const priorMessages = messages;
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(true);

    try {
      let apiContent: any = userMessage.content;

      if (userMessage.imageUrl) {
        apiContent = [
          { type: "text", text: userMessage.content || "Проанализируй это изображение" },
          { type: "image_url", image_url: { url: userMessage.imageUrl } },
        ];
      }

      const payloadMessages = [...priorMessages, { ...userMessage, content: apiContent }].map((m) => {
        if (m.imageUrl && typeof m.content === "string") {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content || "Image" },
              { type: "image_url", image_url: { url: m.imageUrl } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      const clientContext: AiChatClientPayload = {
        pathname: location.pathname,
        search: location.search || undefined,
        pageLabel,
        sentAt: new Date().toISOString(),
        ...(aiClient?.focus ? { focus: aiClient.focus } : {}),
      };

      const response = await fetch(`${crmUrl("/ai-chat")}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(false),
        },
        body: JSON.stringify({
          messages: payloadMessages,
          userId,
          clientContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: newMsgId(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      const errorMessage: Message = {
        id: newMsgId(),
        role: "assistant",
        content: `❌ Ошибка: ${error.message}\n\nПопробуйте перефразировать вопрос или проверьте настройки API.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`${crmUrl(`/ai-chat-history?userId=${userId}`)}`, {
        method: "DELETE",
        headers: { ...authHeaders(false) },
      });

      if (response.ok) {
        setMessages([{ id: newMsgId(), role: "assistant", content: CRM_AI_WELCOME, timestamp: new Date() }]);
        toast.success("История чата очищена");
      } else {
        throw new Error("Failed to clear history");
      }
    } catch (error: any) {
      console.error("Clear history error:", error);
      toast.error("Не удалось очистить историю");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const outerClass =
    variant === "page"
      ? "flex flex-col h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-md shadow-slate-900/5 border border-slate-200/90 ring-1 ring-slate-100 overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-indigo-900/5"
      : "flex flex-col h-full min-h-0 bg-white overflow-hidden";

  const bubbleSpring = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.85 };

  return (
    <div className={outerClass}>
      <div
        className={`border-b crm-ai-header-glow flex items-center justify-between gap-2 shrink-0 transition-colors duration-300 ${
          variant === "sheet" ? "px-3 py-2 sm:px-4" : "px-4 py-3 sm:px-6 sm:py-4"
        }`}
      >
        <div className={`flex items-center min-w-0 ${variant === "sheet" ? "gap-2" : "gap-3"}`}>
          <motion.div
            className={`flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md shrink-0 ring-2 ring-violet-200/60 ${
              variant === "sheet" ? "w-8 h-8" : "w-10 h-10"
            }`}
            animate={loading ? { scale: [1, 1.06, 1], rotate: [0, 4, -4, 0] } : { scale: 1, rotate: 0 }}
            transition={{ duration: 1.6, repeat: loading ? Infinity : 0, ease: "easeInOut" }}
          >
            <Sparkles className={variant === "sheet" ? "h-4 w-4 text-white" : "h-5 w-5 text-white"} />
          </motion.div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className={`font-semibold text-slate-900 truncate ${
                  variant === "sheet" ? "text-sm" : "text-base sm:text-lg"
                }`}
              >
                {variant === "sheet" ? "Диалог" : "Nexus CRM Intelligence"}
              </h1>
              {aiClient?.focus && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 rounded-full bg-violet-600/10 text-violet-800 border border-violet-200/80 text-[10px] sm:text-[11px] font-medium px-2 py-0.5"
                >
                  <Target className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[9rem] sm:max-w-[12rem]">
                    {aiClient.focus.kind}: {aiClient.focus.label || aiClient.focus.id.slice(0, 8)}
                  </span>
                </motion.span>
              )}
            </div>
            {variant !== "sheet" && (
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Данные CRM в контексте каждого ответа · {pageLabel}
              </p>
            )}
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => void clearHistory()}
              disabled={historyLoading}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Очистить</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-xs">
            Сбросить историю диалога на этом устройстве
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 bg-slate-50/30 scroll-smooth custom-scrollbar transition-opacity duration-300 ${historyLoading ? "opacity-40 pointer-events-none" : "opacity-100"}`}
          ref={scrollRef}
        >
          <div className={`space-y-5 sm:space-y-6 mx-auto ${variant === "page" ? "max-w-4xl" : "max-w-full"}`}>
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 18, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: bubbleSpring }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                  className={`flex gap-3 sm:gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="flex items-start shrink-0 pt-0.5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md ring-1 ring-white/40">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}

                  <motion.div
                    layout
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 sm:px-5 sm:py-4 shadow-sm transition-shadow duration-200 hover:shadow-md ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white ring-1 ring-blue-500/30"
                        : "bg-white border border-slate-100/90 text-slate-800"
                    }`}
                  >
                    {message.imageUrl && (
                      <div className="mb-3 rounded-xl overflow-hidden border border-white/20 shadow-inner">
                        <img
                          src={message.imageUrl}
                          alt=""
                          className="max-w-full h-auto max-h-60 object-contain bg-black/5 transition-transform duration-300 hover:scale-[1.02]"
                        />
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    <p
                      className={`text-xs mt-2 tabular-nums ${
                        message.role === "user" ? "text-blue-100/90" : "text-slate-400"
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </motion.div>

                  {message.role === "user" && (
                    <div className="flex items-start shrink-0 pt-0.5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 shadow-md ring-1 ring-white/30">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-4 justify-start"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-sm min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-500 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <span className="text-sm text-slate-600 block">Сверяю ответ с данными CRM…</span>
                      <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                        <motion.div
                          className="h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                          animate={{ x: ["-100%", "280%"] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {historyLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-white/55 backdrop-blur-[2px]"
            >
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-8 py-6 shadow-lg">
                <Loader2 className="h-9 w-9 animate-spin text-violet-600" />
                <p className="text-sm font-medium text-slate-700">Загружаю историю…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 sm:p-6 bg-gradient-to-t from-slate-50/80 to-white border-t border-slate-100/80 shrink-0 transition-colors duration-300">
        <div className={`mx-auto space-y-3 ${variant === "page" ? "max-w-4xl" : "max-w-full"}`}>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 custom-scrollbar sm:flex-wrap sm:overflow-visible">
            {QUICK_PROMPTS.map((q) => (
              <motion.button
                key={q.label}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                disabled={loading || historyLoading || !userId}
                onClick={() => void sendMessage(q.text)}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-violet-200/80 bg-white px-3 py-1.5 text-xs font-medium text-violet-900 shadow-sm hover:bg-violet-50 hover:border-violet-300 disabled:opacity-40 disabled:pointer-events-none transition-colors duration-200"
              >
                {q.icon === "zap" ? (
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Target className="h-3.5 w-3.5 text-violet-600" />
                )}
                {q.label}
              </motion.button>
            ))}
          </div>

          {selectedImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative inline-block"
            >
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-md w-32 h-32 bg-slate-50 flex items-center justify-center relative ring-2 ring-violet-100">
                <img src={selectedImage} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="absolute top-1.5 right-1.5 p-1.5 bg-black/55 hover:bg-black/75 rounded-full text-white transition-transform duration-200 hover:scale-110 active:scale-95"
                  aria-label="Убрать изображение"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          <div className="flex gap-2 sm:gap-3 items-stretch sm:items-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="icon"
                  disabled={loading}
                  className="h-11 w-11 sm:h-12 sm:w-12 border-slate-200 hover:bg-violet-50/80 hover:border-violet-200 text-slate-600 shrink-0 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Прикрепить скрин или фото (до 5 МБ)</TooltipContent>
            </Tooltip>

            <Input
              placeholder="Вопрос по сделкам, лидам, задачам, плану…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1 bg-slate-50/90 border-slate-200 focus:bg-white focus-visible:ring-violet-200/80 transition-all duration-200 h-11 sm:h-12 text-sm sm:text-base shadow-sm rounded-xl"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={loading || (!input.trim() && !selectedImage)}
                  size="icon"
                  className={`h-11 w-11 sm:h-12 sm:w-12 rounded-xl text-white shadow-md shrink-0 transition-all duration-200 bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg disabled:opacity-45 hover:scale-[1.03] active:scale-95 ${loading ? "crm-ai-send-pulse" : ""}`}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Отправить · Enter без Shift</TooltipContent>
            </Tooltip>
          </div>
          <p className="text-[11px] sm:text-xs text-center text-slate-400 mt-1 sm:mt-2 leading-snug">
            Ответы по снимку CRM на момент запроса. Рыночные данные вне системы уточняйте отдельно.
          </p>
        </div>
      </div>
    </div>
  );
}
