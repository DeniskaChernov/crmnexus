import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  ClipboardList,
  Home,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  Star,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../ui/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

/** Главные разделы портала — всегда на виду */
export const DEALER_PRIMARY_NAV: NavItem[] = [
  { to: "/dealer", label: "Главная", icon: Home, end: true },
  { to: "/dealer/orders", label: "Заказы", icon: ClipboardList },
  { to: "/dealer/customers", label: "Клиенты", icon: Users },
  { to: "/dealer/analytics", label: "Аналитика", icon: BarChart3 },
];

/** Подразделы внутри «Заказы» */
export const DEALER_ORDERS_NAV: NavItem[] = [
  { to: "/dealer/orders", label: "Заказы", icon: ClipboardList, end: true },
  { to: "/dealer/shipments", label: "Отгрузки", icon: Truck },
  { to: "/dealer/coils", label: "Мотки / QR", icon: Package },
];

/** Подразделы внутри «Клиенты» */
export const DEALER_CLIENTS_NAV: NavItem[] = [
  { to: "/dealer/customers", label: "Клиенты", icon: Users, end: true },
  { to: "/dealer/requests", label: "Заявки", icon: MessageSquare },
  { to: "/dealer/reviews", label: "Отзывы", icon: Star },
];

/** Полное меню для бургера */
export const DEALER_ALL_NAV: Array<{ title: string; items: NavItem[] }> = [
  { title: "Обзор", items: [{ to: "/dealer", label: "Главная", icon: LayoutDashboard, end: true }] },
  { title: "Заказы и склад", items: DEALER_ORDERS_NAV },
  { title: "Клиенты и сайт", items: DEALER_CLIENTS_NAV },
  { title: "Отчёты", items: [{ to: "/dealer/analytics", label: "Аналитика", icon: BarChart3 }] },
];

function isActive(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function isOrdersSection(pathname: string) {
  return (
    pathname.startsWith("/dealer/orders") ||
    pathname.startsWith("/dealer/shipments") ||
    pathname.startsWith("/dealer/coils")
  );
}

function isClientsSection(pathname: string) {
  return (
    pathname.startsWith("/dealer/customers") ||
    pathname.startsWith("/dealer/requests") ||
    pathname.startsWith("/dealer/reviews")
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  end,
  compact,
  onClick,
}: NavItem & { compact?: boolean; onClick?: () => void }) {
  const { pathname } = useLocation();
  const active = isActive(pathname, to, end);
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 font-medium transition-colors",
        compact
          ? "flex-col gap-0.5 px-2 py-1.5 text-[10px] rounded-xl min-w-[4.5rem]"
          : "rounded-xl px-3 py-2 text-sm",
        active
          ? compact
            ? "text-emerald-800"
            : "bg-emerald-700 text-white shadow-sm"
          : compact
            ? "text-neutral-500"
            : "text-neutral-700 hover:bg-emerald-50",
      )}
    >
      <Icon className={cn("shrink-0", compact ? "h-5 w-5" : "h-4 w-4")} strokeWidth={active ? 2.5 : 2} />
      <span className={cn(compact && active && "font-semibold")}>{label}</span>
    </Link>
  );
}

function SubNav({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
      {items.map((item) => {
        const active = isActive(pathname, item.to, item.end);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              active
                ? "bg-white border-emerald-300 text-emerald-900 shadow-sm"
                : "bg-transparent border-transparent text-neutral-600 hover:bg-white/80",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function DealerPrimaryNav({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <>
      {DEALER_PRIMARY_NAV.map((item) => (
        <NavLink key={item.to} {...item} compact={compact} onClick={onNavigate} />
      ))}
    </>
  );
}

export function DealerSubNavBar() {
  const { pathname } = useLocation();
  if (isOrdersSection(pathname)) {
    return (
      <div className="bg-emerald-50/80 border-b border-emerald-100">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/70 mb-1.5">
            Заказы
          </div>
          <SubNav items={DEALER_ORDERS_NAV} />
        </div>
      </div>
    );
  }
  if (isClientsSection(pathname)) {
    return (
      <div className="bg-sky-50/80 border-b border-sky-100">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-800/70 mb-1.5">
            Клиенты
          </div>
          <SubNav items={DEALER_CLIENTS_NAV} />
        </div>
      </div>
    );
  }
  return null;
}

export function DealerMobileMenu() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden shrink-0">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetTitle className="sr-only">Меню портала дилера</SheetTitle>
        <SheetDescription className="sr-only">Разделы и подразделы</SheetDescription>
        <div className="p-4 border-b bg-emerald-700 text-white">
          <div className="text-xs font-semibold uppercase opacity-80">BTT Nexus</div>
          <div className="font-bold text-lg">Портал дилера</div>
        </div>
        <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-5rem)]">
          {DEALER_ALL_NAV.map((group) => (
            <div key={group.title}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 px-2 mb-1">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    {...item}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function DealerBottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-stretch px-1 pt-1">
        {DEALER_PRIMARY_NAV.map((item) => {
          const active =
            item.end
              ? pathname === item.to
              : item.to === "/dealer/orders"
                ? isOrdersSection(pathname)
                : item.to === "/dealer/customers"
                  ? isClientsSection(pathname)
                  : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[4rem] rounded-xl",
                active ? "text-emerald-800" : "text-neutral-400",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className={cn("text-[10px] font-medium", active && "font-semibold")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
