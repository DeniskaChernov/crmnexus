import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Users,
  CheckSquare,
  Package,
  Settings,
  Menu,
  Search,
  ChevronLeft,
  Plus,
  Trash2,
  Calendar,
  UserPlus,
  TrendingUp,
  BarChart3,
  Share2,
  Upload,
  Star,
  Phone,
  Database,
  Send,
  AlertTriangle,
  Mail,
  Moon,
  Sun,
} from 'lucide-react';
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

/** Верхнее меню — как в SugarCRM (Relationship, Opportunities, …) */
const TOP_NAV: { name: string; href: string }[] = [
  { name: 'Клиенты', href: '/database' },
  { name: 'Сделки', href: '/deals' },
  { name: 'Лиды', href: '/leads' },
  { name: 'Календарь', href: '/production-calendar' },
  { name: 'Задачи', href: '/tasks' },
  { name: 'Аналитика', href: '/sales-analytics' },
  { name: 'Маркетинг', href: '/marketing' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeDark, setThemeDark] = useState(false);
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

  const isNavActive = (href: string) =>
    href === '/'
      ? location.pathname === '/'
      : location.pathname === href || location.pathname.startsWith(`${href}/`);

  type SideItem = { icon: LucideIcon; title: string; onClick: () => void; active?: boolean };

  const sideItems: SideItem[] = [
    { icon: Share2, title: 'Поделиться', onClick: () => navigate('/import') },
    { icon: Upload, title: 'Импорт', onClick: () => navigate('/import') },
    { icon: Star, title: 'Избранное', onClick: () => navigate('/deals') },
    {
      icon: Plus,
      title: 'Создать',
      onClick: () => navigate('/deals'),
    },
    { icon: Phone, title: 'Лиды', onClick: () => navigate('/leads'), active: location.pathname.startsWith('/leads') },
    { icon: Database, title: 'База', onClick: () => navigate('/database'), active: location.pathname.startsWith('/database') },
    { icon: Calendar, title: 'Календарь', onClick: () => navigate('/production-calendar'), active: location.pathname.startsWith('/production-calendar') },
    { icon: Send, title: 'Маркетинг', onClick: () => navigate('/marketing'), active: location.pathname.startsWith('/marketing') },
  ];

  return (
    <CrmAiClientProvider>
      <CrmAiFocusResetOnRoute>
        <div className={`min-h-screen flex font-sans text-slate-600 nexus-app overflow-hidden ${themeDark ? 'dark' : ''}`}>

          {/* Левая панель — узкая, как в SugarCRM */}
          <aside className="hidden md:flex flex-col items-center py-5 w-[72px] z-50 sugar-sidebar">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="sugar-sidebar-btn mb-6"
              title="Назад"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="flex flex-col gap-2 w-full items-center px-2">
              {sideItems.map((item) => (
                <Button
                  key={item.title}
                  variant="ghost"
                  size="icon"
                  onClick={item.onClick}
                  className={item.active ? 'sugar-sidebar-btn sugar-sidebar-btn-active' : 'sugar-sidebar-btn'}
                  title={item.title}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                </Button>
              ))}
            </div>

            <div className="mt-auto flex flex-col items-center gap-3 pb-2">
              <Button
                variant="ghost"
                size="icon"
                className="sugar-sidebar-btn text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                onClick={() => openCrmAiAssistant()}
                title="Предупреждения"
              >
                <AlertTriangle className="h-[18px] w-[18px]" />
              </Button>

              <div className="flex items-center bg-slate-100 rounded-full p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => setThemeDark(true)}
                  className={`p-2 rounded-full transition-all ${themeDark ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400'}`}
                  aria-label="Тёмная тема"
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setThemeDark(false)}
                  className={`p-2 rounded-full transition-all ${!themeDark ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400'}`}
                  aria-label="Светлая тема"
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </aside>

          <div className="flex-1 flex flex-col h-screen overflow-hidden relative">

            {/* Верхняя панель */}
            <header className="shrink-0 z-40 px-4 pt-4 pb-2 md:px-6">
              <div className="nexus-header-surface flex min-h-[3.75rem] items-center justify-between gap-3 px-4 py-2.5 md:px-6">

                <Link to="/" className="shrink-0 mr-2">
                  <span className="text-xl font-bold text-slate-900 tracking-tight lowercase">
                    btt<span className="text-slate-400 font-semibold">nexus</span>
                  </span>
                </Link>

                <nav className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto custom-scrollbar justify-center">
                  <Link
                    to="/"
                    className={`whitespace-nowrap text-sm transition-all duration-200 ${
                      location.pathname === '/' ? 'nav-pill-active' : 'nav-pill-inactive'
                    }`}
                  >
                    Дашборд
                  </Link>
                  {TOP_NAV.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`whitespace-nowrap text-sm transition-all duration-200 ${
                        isNavActive(item.href) ? 'nav-pill-active' : 'nav-pill-inactive'
                      }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </nav>

                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100 hidden sm:flex"
                    onClick={() => window.dispatchEvent(new Event('crm-open-global-search'))}
                    title="Поиск"
                  >
                    <Search className="h-[18px] w-[18px]" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100 hidden sm:flex"
                    onClick={() => navigate('/tasks')}
                    title="Входящие"
                  >
                    <Mail className="h-[18px] w-[18px]" />
                  </Button>

                  <Notifications />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-10 w-10 rounded-full p-0 overflow-hidden ring-2 ring-white shadow-md hover:scale-105 transition-transform">
                        <Avatar className="h-full w-full">
                          <AvatarFallback className="bg-gradient-to-br from-orange-100 to-amber-50 text-orange-700 font-bold">
                            {userInitial}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-xl border-slate-100 p-2">
                      {isAdmin && (
                        <>
                          <DropdownMenuItem onClick={() => navigate('/settings')} className="rounded-xl cursor-pointer">
                            <Settings className="mr-2 h-4 w-4" />
                            Настройки
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem onClick={handleSignOut} className="rounded-xl text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Выйти
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="lg:hidden">
                  <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72 rounded-r-3xl">
                      <SheetTitle className="sr-only">Меню</SheetTitle>
                      <SheetDescription className="sr-only">Навигация</SheetDescription>
                      <div className="flex flex-col gap-1 mt-8">
                        <Link
                          to="/"
                          onClick={() => setSidebarOpen(false)}
                          className={`px-4 py-3 rounded-2xl text-sm font-medium ${location.pathname === '/' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}
                        >
                          Дашборд
                        </Link>
                        {TOP_NAV.map((item) => (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`px-4 py-3 rounded-2xl text-sm font-medium ${
                              isNavActive(item.href) ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                            }`}
                          >
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-1 md:px-6 custom-scrollbar">
              <div key={location.pathname} className="max-w-[1600px] mx-auto w-full animate-in fade-in duration-300">
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
