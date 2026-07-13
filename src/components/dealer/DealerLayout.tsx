import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, MessageSquare, Package, LogOut } from "lucide-react";
import { Button } from "../ui/button";
import { crm } from "../../lib/crmClient.ts";

const nav = [
  { to: "/dealer", label: "Показатели", icon: LayoutDashboard, end: true },
  { to: "/dealer/customers", label: "Клиенты", icon: Users },
  { to: "/dealer/requests", label: "Заявки", icon: MessageSquare },
  { to: "/dealer/coils", label: "Мотки / QR", icon: Package },
];

export function DealerLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const logout = async () => {
    await crm.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#f4f6f4] text-[#1a1f1c]">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">BTT Nexus</div>
            <div className="font-bold text-lg">Портал дилера</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            <LogOut className="h-4 w-4 mr-1" /> Выйти
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-[220px_1fr] gap-6">
        <nav className="space-y-1">
          {nav.map(({ to, label, icon: Icon, end }) => {
            const active = end ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-emerald-700 text-white" : "bg-white border hover:bg-emerald-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
