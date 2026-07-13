import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { crmFetch } from "../../lib/crmApi.ts";
import { Bell, Check } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";

type DealerNotification = {
  id: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
};

export function DealerNotifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DealerNotification[]>([]);
  const navigate = useNavigate();

  const load = async () => {
    const res = await crmFetch("/dealer/notifications");
    if (res.ok) setItems(await res.json());
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const unread = items.filter((n) => !n.isRead).length;

  const markRead = async (id: string) => {
    await crmFetch(`/dealer/notifications/${encodeURIComponent(id)}/read`, { method: "PUT" });
    void load();
  };

  const markAllRead = async () => {
    await crmFetch("/dealer/notifications/read-all", { method: "PUT" });
    void load();
  };

  const openItem = (n: DealerNotification) => {
    if (!n.isRead) void markRead(n.id);
    if (n.actionUrl) {
      setOpen(false);
      navigate(n.actionUrl);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[360px] sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between gap-2">
          <SheetTitle>Уведомления</SheetTitle>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
              <Check className="h-4 w-4 mr-1" /> Прочитать все
            </Button>
          )}
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          {items.length === 0 ? (
            <p className="text-sm text-neutral-500 p-4">Новых уведомлений нет</p>
          ) : (
            <ul className="space-y-2 pr-4">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`w-full text-left rounded-xl border p-3 text-sm transition-colors hover:bg-emerald-50 ${
                      n.isRead ? "opacity-70" : "bg-white border-emerald-200"
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{n.title}</span>
                      {!n.isRead && <Badge className="text-[10px]">новое</Badge>}
                    </div>
                    <p className="text-neutral-600 mt-1">{n.message}</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {new Date(n.createdAt).toLocaleString("ru")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="pt-3 border-t mt-2">
          <Link to="/dealer" className="text-sm text-emerald-700 hover:underline" onClick={() => setOpen(false)}>
            Вся активность на дашборде →
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
