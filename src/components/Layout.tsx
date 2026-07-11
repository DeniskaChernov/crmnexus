import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  BarChart3,
  Briefcase,
  Users,
  CheckSquare,
  Package,
  Settings,
  Menu,
  Search,
  Plus,
  Trash2,
  Bot,
  ChefHat,
  Calendar,
  UserPlus,
  Phone,
  TrendingUp,
  UserCog,
} from 'lucide-react';
import { ImageWithFallback } from "./ImageWithFallback";
import { crm } from "@/lib/crmClient.ts";
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from './ui/sheet';
import Notifications from './Notifications';
import { CrmAiAssistant, openCrmAiAssistant } from './crm/CrmAiAssistant.tsx';
import { CrmAiClientProvider, CrmAiFocusResetOnRoute } from '../context/CrmAiClientContext.tsx';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const bttLogo = "/btt-logo.svg";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
};

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
        if (!session) {
          navigate('/login');
        } else {
          setUser(session.user);
        }
      } catch (e) {
        console.error("Auth check failed:", e);
      }
    };
    checkUser();

    const { data: { subscription } } = crm.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        navigate('/login');
        setUser(null);
      } else if (session) {
        setUser(session.user);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const userRole =
    typeof user?.user_metadata?.role === 'string' && user.user_metadata.role
      ? user.user_metadata.role
      : 'manager';
  const isAdmin = userRole === 'admin' || userRole === 'director' || userRole === 'owner';
  const userInitial = (user?.email?.trim()?.[0] || user?.user_metadata?.name?.trim?.()?.[0] || 'U').toUpperCase();

  const handleSignOut = async () => {
    await crm.auth.signOut();
    navigate('/login');
  };

  const mainNavigation: NavItem[] = [
    { name: 'Главная', href: '/', icon: LayoutDashboard, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
    { name: 'Лиды', href: '/leads', icon: Phone, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
    { name: 'Сделки', href: '/deals', icon: Briefcase, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
    { name: 'Задачи', href: '/tasks', icon: CheckSquare, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
    { name: 'Календарь', href: '/production-calendar', icon: Calendar, roles: ['admin', 'director', 'manager', 'owner'] },
    { name: 'Клиенты', href: '/database', icon: Users, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
    { name: 'Аналитика', href: '/sales-analytics', icon: TrendingUp, roles: ['admin', 'director', 'manager', 'owner'] },
    { name: 'Склад', href: '/warehouse', icon: Package, roles: ['admin', 'director', 'manager', 'owner'] },
    { name: 'Сотрудники', href: '/employees', icon: UserCog, roles: ['admin', 'director', 'manager', 'owner'] },
    { name: 'Маркетинг', href: '/marketing', icon: BarChart3, roles: ['admin', 'director', 'manager', 'owner'] },
  ];

  const extraNavigation: NavItem[] = [
    { name: 'Рецепты', href: '/recipes', icon: ChefHat, roles: ['admin', 'director', 'manager', 'owner'] },
  ];

  const sidebarNav = [
    ...mainNavigation.filter((item) => item.roles.includes(userRole)),
    ...extraNavigation.filter((item) => item.roles.includes(userRole)),
  ];

  const isNavActive = (href: string) =>
    href === '/'
      ? location.pathname === '/'
      : location.pathname === href || location.pathname.startsWith(`${href}/`);

  const NavLinkItem = ({ item, onClick }: { item: NavItem; onClick?: () => void }) => {
    const active = isNavActive(item.href);
    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={active ? 'tasklab-nav-item tasklab-nav-item-active' : 'tasklab-nav-item'}
      >
        <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <CrmAiClientProvider>
    <CrmAiFocusResetOnRoute>
    <div className="min-h-screen flex font-sans text-neutral-600 tasklab-app overflow-hidden">

      {/* Sidebar — TaskLab */}
      <aside className="hidden lg:flex flex-col w-[260px] shrink-0 tasklab-sidebar py-6 px-4 z-50">
        <Link to="/" className="flex items-center gap-3 px-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-neutral-900 flex items-center justify-center overflow-hidden shrink-0">
            <ImageWithFallback src={bttLogo} alt="BTT" className="h-6 w-auto object-contain invert" />
          </div>
          <div>
            <p className="font-bold text-neutral-900 text-lg leading-tight">BTT Nexus</p>
            <p className="text-[11px] text-neutral-400 font-medium">CRM System</p>
          </div>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
          {sidebarNav.map((item) => (
            <NavLinkItem key={item.href} item={item} />
          ))}
          <button
            type="button"
            onClick={() => openCrmAiAssistant()}
            className="tasklab-nav-item w-full text-left"
          >
            <Bot className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            <span>CRM ИИ</span>
          </button>
          {isAdmin && (
            <NavLinkItem item={{ name: 'Настройки', href: '/settings', icon: Settings, roles: ['admin'] }} />
          )}
        </nav>

        <div className="mt-4 pt-4 border-t border-neutral-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="tasklab-card w-full p-3 flex items-center gap-3 text-left hover:opacity-90 transition-opacity">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-[var(--tasklab-lime)] text-neutral-900 font-bold text-sm">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900 truncate">
                    {typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : 'Пользователь'}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-2xl p-2">
              <DropdownMenuItem onClick={handleSignOut} className="rounded-xl text-red-600 cursor-pointer">
                <Trash2 className="mr-2 h-4 w-4" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <header className="shrink-0 z-40 px-3 pt-3 pb-2 md:px-5 md:pt-4">
          <div className="tasklab-topbar flex min-h-[3.25rem] items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-3 min-w-0 lg:hidden">
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-4">
                  <SheetTitle className="sr-only">Меню</SheetTitle>
                  <SheetDescription className="sr-only">Навигация</SheetDescription>
                  <div className="flex items-center gap-3 mb-6 mt-2">
                    <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center">
                      <ImageWithFallback src={bttLogo} alt="BTT" className="h-5 w-auto invert" />
                    </div>
                    <span className="font-bold text-neutral-900">BTT Nexus</span>
                  </div>
                  <div className="space-y-1">
                    {sidebarNav.map((item) => (
                      <NavLinkItem key={item.href} item={item} onClick={() => setSidebarOpen(false)} />
                    ))}
                    <button
                      type="button"
                      onClick={() => { openCrmAiAssistant(); setSidebarOpen(false); }}
                      className="tasklab-nav-item w-full text-left"
                    >
                      <Bot className="h-5 w-5" />
                      <span>CRM ИИ</span>
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
              <span className="font-bold text-neutral-900 truncate">BTT Nexus</span>
            </div>

            <div className="hidden lg:flex items-center bg-neutral-100/80 rounded-full px-4 py-2 flex-1 max-w-md border border-neutral-200/50">
              <Search className="h-4 w-4 text-neutral-400 mr-2 shrink-0" />
              <input
                type="text"
                readOnly
                placeholder="Поиск…"
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-neutral-400 cursor-pointer"
                onFocus={() => window.dispatchEvent(new Event('crm-open-global-search'))}
                onClick={() => window.dispatchEvent(new Event('crm-open-global-search'))}
              />
              <span className="text-[10px] text-neutral-400 ml-2 hidden xl:inline">Ctrl+K</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full bg-[var(--tasklab-lime)] text-neutral-900 hover:bg-[var(--tasklab-lime-soft)] hidden sm:flex">
                    <Plus className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2">
                  <DropdownMenuLabel>Создать</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/leads')} className="cursor-pointer rounded-xl">
                    <UserPlus className="mr-2 h-4 w-4" /> Лид
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/deals')} className="cursor-pointer rounded-xl">
                    <Briefcase className="mr-2 h-4 w-4" /> Сделка
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/tasks')} className="cursor-pointer rounded-xl">
                    <CheckSquare className="mr-2 h-4 w-4" /> Задача
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Notifications />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 w-10 rounded-full p-0 lg:hidden">
                    <Avatar className="h-full w-full">
                      <AvatarFallback className="bg-[var(--tasklab-lime)] text-neutral-900 font-bold">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl p-2">
                  <DropdownMenuItem onClick={handleSignOut} className="rounded-xl text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" /> Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-6 md:px-6 md:pb-8 custom-scrollbar">
          <div
            key={location.pathname}
            className="max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            <Outlet />
          </div>
        </main>
      </div>

      <CrmAiAssistant />
    </div>
    </CrmAiFocusResetOnRoute>
    </CrmAiClientProvider>
  );
}
