import React from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "../ui/button";
import { crm } from "../../lib/crmClient.ts";
import { DealerNotifications } from "./DealerNotifications.tsx";
import {
  DealerBottomNav,
  DealerMobileMenu,
  DealerPrimaryNav,
  DealerSubNavBar,
} from "./DealerNav.tsx";

export function DealerLayout() {
  const navigate = useNavigate();

  const logout = async () => {
    await crm.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#f4f6f4] text-[#1a1f1c] pb-20 lg:pb-0">
      <header className="sticky top-0 z-30 border-b bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <DealerMobileMenu />
            <Link to="/dealer" className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">BTT Nexus</div>
              <div className="font-bold text-base leading-tight truncate">Портал дилера</div>
            </Link>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DealerNotifications />
            <Button variant="outline" size="sm" onClick={() => void logout()} className="hidden sm:flex">
              <LogOut className="h-4 w-4 mr-1" /> Выйти
            </Button>
            <Button variant="outline" size="icon" onClick={() => void logout()} className="sm:hidden shrink-0">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Главная навигация — десктоп */}
        <div className="hidden lg:block border-t bg-neutral-50/80">
          <div className="max-w-6xl mx-auto px-4 py-2 flex gap-1">
            <DealerPrimaryNav />
          </div>
        </div>
      </header>

      <DealerSubNavBar />

      <div className="max-w-6xl mx-auto px-4 py-5">
        <main>
          <Outlet />
        </main>
      </div>

      <DealerBottomNav />
    </div>
  );
}
