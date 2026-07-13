import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { crm } from '@/lib/crmClient.ts';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from './ui/sheet';
import { Button } from './ui/button';
import { Menu } from 'lucide-react';
import { CrmAiAssistant, openCrmAiAssistant } from './crm/CrmAiAssistant.tsx';
import { CrmAiClientProvider, CrmAiFocusResetOnRoute } from '../context/CrmAiClientContext.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { LogOut, Home, ClipboardList, Warehouse, Users, BarChart3, PieChart, Calendar, Settings, Phone, CheckSquare, Building2, QrCode } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
};

const REF_NAV: NavItem[] = [
  { name: 'Главная', href: '/', icon: Home, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
  { name: 'Заказы', href: '/deals', icon: ClipboardList, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
  { name: 'Склад', href: '/warehouse', icon: Warehouse, roles: ['admin', 'director', 'manager', 'owner'] },
  { name: 'Команда', href: '/employees', icon: Users, roles: ['admin', 'director', 'manager', 'owner'] },
  { name: 'Графики', href: '/sales-analytics', icon: BarChart3, roles: ['admin', 'director', 'manager', 'owner'] },
  { name: 'Аналитика', href: '/marketing', icon: PieChart, roles: ['admin', 'director', 'manager', 'owner'] },
  { name: 'Календарь', href: '/production-calendar', icon: Calendar, roles: ['admin', 'director', 'manager', 'owner'] },
  { name: 'Настройки', href: '/settings', icon: Settings, roles: ['admin', 'director', 'owner'] },
];

const EXTRA_NAV: NavItem[] = [
  { name: 'QR-коды', href: '/qr', icon: QrCode, roles: ['admin', 'director', 'manager', 'owner'] },
  { name: 'Лиды', href: '/leads', icon: Phone, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
  { name: 'Задачи', href: '/tasks', icon: CheckSquare, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
  { name: 'Клиенты', href: '/database', icon: Building2, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session }, error } = await crm.auth.getSession();
        if (error) throw error;
        if (!session) navigate('/login');
        else setUser(session.user);
      } catch (e) {
        console.error('Auth check failed:', e);
      }
    };
    checkUser();
    const { data: { subscription } } = crm.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        navigate('/login');
        setUser(null);
      } else if (session) setUser(session.user);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const userRole =
    typeof user?.user_metadata?.role === 'string' && user.user_metadata.role
      ? user.user_metadata.role
      : 'manager';

  const sidebarNav = [
    ...REF_NAV.filter((item) => item.roles.includes(userRole)),
    ...EXTRA_NAV.filter((item) => item.roles.includes(userRole)),
  ];

  const isNavActive = (href: string) =>
    href === '/'
      ? location.pathname === '/'
      : location.pathname === href || location.pathname.startsWith(`${href}/`);

  const handleSignOut = async () => {
    await crm.auth.signOut();
    navigate('/login');
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {sidebarNav.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onClick}
            className={isNavActive(item.href) ? 'active' : ''}
          >
            <span className="btt-nav-icon">
              <Icon strokeWidth={2} aria-hidden />
            </span>
            <span className="btt-nav-label">{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  const ChatBlock = () => (
    <button type="button" className="btt-crm-chat w-full text-left" onClick={() => openCrmAiAssistant()}>
      <b>● CRM ИИ</b>
      <small>Помощник по заказам и складу</small>
      <p className="lime">Задайте вопрос по сделкам или остаткам</p>
      <input placeholder="Сообщение..." readOnly onClick={(e) => e.stopPropagation()} />
    </button>
  );

  return (
    <CrmAiClientProvider>
      <CrmAiFocusResetOnRoute>
        <div className="btt-crm-body">
          <main className="btt-crm-shell">
            <aside className="btt-crm-rail flex flex-col">
              <Link to="/" className="btt-crm-logo">
                <i>◩</i>
                <b className="hidden lg:inline">BTT CRM</b>
                <b className="lg:hidden">BTT</b>
              </Link>
              <nav className="flex-1">
                <NavLinks />
              </nav>
              <div className="hidden lg:flex flex-col mt-auto">
                <ChatBlock />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="nav-btn mt-3 text-left w-full rounded-[24px] px-3 py-2 text-[10px] text-[#959b94]"
                    >
                      {user?.email || 'Аккаунт'} ▾
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="rounded-2xl">
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Выйти
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden mt-2 shrink-0">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px]">
                  <SheetTitle className="sr-only">Меню</SheetTitle>
                  <SheetDescription className="sr-only">Навигация и аккаунт</SheetDescription>
                  <nav className="grid gap-2 mt-6">
                    <NavLinks onClick={() => setSidebarOpen(false)} />
                  </nav>
                  <button
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false);
                      handleSignOut();
                    }}
                    className="mt-6 flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Выйти
                  </button>
                </SheetContent>
              </Sheet>
            </aside>

            <section className="btt-crm-main">
              <Outlet />
            </section>
          </main>
          <CrmAiAssistant />
        </div>
      </CrmAiFocusResetOnRoute>
    </CrmAiClientProvider>
  );
}
