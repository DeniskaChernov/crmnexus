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
  ChevronLeft,
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
  DropdownMenuTrigger 
} from './ui/dropdown-menu';

const bttLogo = "/btt-logo.svg";

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
        // Don't redirect immediately on error, might be temporary network issue
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

  // Mapped to match "SugarCRM" top menu style
  const allNavigation = [
    { name: 'Дашборд', href: '/', icon: LayoutDashboard, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
    // Leads moved to sidebar
    { name: 'Сделки', href: '/deals', icon: Briefcase, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
    { name: 'Задачи', href: '/tasks', icon: CheckSquare, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
    { name: 'Календарь', href: '/production-calendar', icon: Calendar, roles: ['admin', 'director', 'manager', 'owner'] },
    { name: 'Клиенты', href: '/database', icon: Users, roles: ['admin', 'director', 'manager', 'sales', 'owner'] },
    { name: 'Аналитика', href: '/sales-analytics', icon: TrendingUp, roles: ['admin', 'director', 'manager', 'owner'] },
    { name: 'Склад', href: '/warehouse', icon: Package, roles: ['admin', 'director', 'manager', 'owner'] }, // Warehouse usually requires strict control
    { name: 'Сотрудники', href: '/employees', icon: UserCog, roles: ['admin', 'director', 'manager', 'owner'] },
    { name: 'Маркетинг', href: '/marketing', icon: BarChart3, roles: ['admin', 'director', 'manager', 'owner'] },
  ];

  const topNavigation = allNavigation.filter(item => item.roles.includes(userRole));
  const navPills =
    topNavigation.length > 0
      ? topNavigation
      : allNavigation.filter((i) => i.href === '/');
  const isNavActive = (href: string) =>
    href === '/'
      ? location.pathname === '/'
      : location.pathname === href || location.pathname.startsWith(`${href}/`);

  type MobileNavItem =
    | { name: string; href: string; icon: LucideIcon }
    | { name: string; icon: LucideIcon; openAiSheet: true };

  const mobileNavigation: MobileNavItem[] = [
    { name: 'Лиды', href: '/leads', icon: UserPlus },
    ...navPills.map((item) => ({
      name: item.name,
      href: item.href,
      icon: item.icon,
    })),
    { name: 'Библиотека рецептов', href: '/recipes', icon: ChefHat },
    { name: 'CRM ИИ', icon: Bot, openAiSheet: true },
    ...(isAdmin ? [{ name: 'Настройки', href: '/settings', icon: Settings }] : []),
  ];

  return (
    <CrmAiClientProvider>
    <CrmAiFocusResetOnRoute>
    <div className="min-h-screen flex font-sans text-slate-600 nexus-app overflow-hidden">
      
      {/* 1. Left Icon Sidebar (Fixed strip) — единая «стеклянная» колонка под Nexus Ops */}
      <aside className="hidden md:flex flex-col items-center py-6 w-20 z-50 border-r border-slate-200/80 bg-white/75 backdrop-blur-xl shadow-[inset_-1px_0_0_rgba(148,163,184,0.12)]">
        <div className="mb-8">
           {/* Back button */}
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => navigate(-1)}
             className="h-10 w-10 rounded-full bg-white shadow-sm hover:bg-slate-50 hover:scale-105 transition-all"
             title="Назад"
           >
              <ChevronLeft className="h-5 w-5 text-slate-400" />
           </Button>
        </div>
        
        <div className="flex flex-col gap-4 w-full items-center">
           
           {/* Leads Shortcut (Replaced Share) */}
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => navigate('/leads')}
             className={`h-10 w-10 rounded-xl transition-colors ${
               location.pathname.startsWith('/leads')
                 ? 'bg-indigo-100 text-indigo-800 shadow-sm ring-1 ring-indigo-200/60'
                 : 'text-slate-500 hover:text-indigo-700 hover:bg-indigo-50/80'
             }`}
             title="Лиды (Холодные)"
           >
              <Phone className="h-5 w-5" />
           </Button>

           {/* Quick Create Menu */}
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-slate-500 hover:text-indigo-700 hover:bg-indigo-50/80 transition-colors" title="Создать">
                  <Plus className="h-5 w-5" />
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent side="right" align="start" className="w-48 ml-2">
               <DropdownMenuLabel>Быстрое создание</DropdownMenuLabel>
               <DropdownMenuSeparator />
               <DropdownMenuItem onClick={() => navigate('/leads')} className="cursor-pointer">
                 <UserPlus className="mr-2 h-4 w-4" /> Лид
               </DropdownMenuItem>
               <DropdownMenuItem onClick={() => navigate('/deals')} className="cursor-pointer">
                 <Briefcase className="mr-2 h-4 w-4" /> Сделка
               </DropdownMenuItem>
               <DropdownMenuItem onClick={() => navigate('/tasks')} className="cursor-pointer">
                 <CheckSquare className="mr-2 h-4 w-4" /> Задача
               </DropdownMenuItem>
               <DropdownMenuItem onClick={() => navigate('/database')} className="cursor-pointer">
                 <Users className="mr-2 h-4 w-4" /> Клиент
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>

           {/* Deals Shortcut */}
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => navigate('/deals')}
             className={`h-10 w-10 rounded-xl transition-colors ${
               location.pathname.startsWith('/deals')
                 ? 'bg-indigo-100 text-indigo-800 shadow-sm ring-1 ring-indigo-200/60'
                 : 'text-slate-500 hover:text-indigo-700 hover:bg-indigo-50/80'
             }`}
             title="Сделки (Воронки)"
           >
              <Briefcase className="h-5 w-5" />
           </Button>

           {/* Sales Analytics Shortcut */}
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => navigate('/sales-analytics')}
             className={`h-10 w-10 rounded-xl transition-all duration-300 ${
               location.pathname === '/sales-analytics' 
                 ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-md' 
                 : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
             }`}
             title="Аналитика и отчёты"
           >
              <TrendingUp className="h-5 w-5" />
           </Button>

           {/* Встроенный CRM ИИ */}
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => openCrmAiAssistant()}
             className="h-10 w-10 rounded-xl transition-all duration-300 text-slate-400 hover:text-violet-700 hover:bg-violet-50 hover:scale-105 active:scale-95 hover:shadow-md hover:shadow-violet-200/50"
             title="CRM ИИ (панель)"
           >
              <Bot className="h-5 w-5" />
           </Button>

           {/* Recipes */}
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => navigate('/recipes')}
             className={`h-10 w-10 rounded-xl transition-all duration-300 ${
               location.pathname === '/recipes'
                 ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                 : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
             }`}
             title="Библиотека рецептов"
           >
              <ChefHat className="h-5 w-5" />
           </Button>

           {/* Settings - Admin Only */}
           {isAdmin && (
             <Button 
               variant="ghost" 
               size="icon" 
               className={`h-10 w-10 rounded-xl transition-colors ${
                 location.pathname === '/settings'
                   ? 'bg-slate-100 text-slate-900 shadow-sm'
                   : 'text-slate-400 hover:text-slate-600 hover:bg-white/80'
               }`}
               onClick={() => navigate('/settings')}
               title="Настройки"
             >
                <Settings className="h-5 w-5" />
             </Button>
           )}
        </div>
        
        <div className="mt-auto">
            {/* Bottom utils */}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* 2. Top bar — карточка вместо «висит в воздухе» */}
        <header className="shrink-0 z-40 px-3 pt-3 pb-2 md:px-5 md:pt-4 md:pb-3">
          <div className="nexus-header-surface flex min-h-[3.5rem] md:min-h-[4.25rem] items-center justify-between gap-2 px-3 py-2 md:px-5 md:py-2.5">
           
           {/* Logo / Brand Name */}
           <div className="flex items-center gap-3 mr-2 md:mr-6 shrink-0">
              <Link to="/" className="block rounded-full ring-1 ring-slate-200/80 shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]">
                 <ImageWithFallback 
                    src={bttLogo} 
                    alt="BTT Nexus" 
                    className="h-10 md:h-11 w-auto object-contain bg-gradient-to-br from-slate-800 to-slate-950 rounded-full px-3 py-1.5 md:px-4 md:py-2"
                 />
              </Link>
           </div>

           {/* Center Menu - Pills */}
           <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto custom-scrollbar px-2">
              {navPills.map((item) => {
                const isActive = isNavActive(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`whitespace-nowrap text-sm transition-all duration-300 rounded-full will-change-transform ${
                      isActive 
                        ? 'nav-pill-active' 
                        : 'nav-pill-inactive'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
           </nav>

           {/* Right Actions */}
           <div className="flex items-center gap-2 md:gap-3 ml-2 shrink-0">
              {/* Search Pill */}
             <div className="hidden lg:flex items-center bg-slate-50/90 rounded-full px-4 py-2 border border-slate-200/90 w-64 xl:w-72 transition-all duration-300 hover:bg-white hover:shadow-md hover:border-indigo-200/60 focus-within:ring-2 focus-within:ring-indigo-200/70 focus-within:border-indigo-200/80 focus-within:bg-white">
                 <Search className="h-4 w-4 text-slate-400 mr-2" />
                 <input 
                    type="text" 
                    readOnly
                    placeholder="Поиск…" 
                    className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 cursor-pointer"
                    onFocus={() => window.dispatchEvent(new Event('crm-open-global-search'))}
                    onClick={() => window.dispatchEvent(new Event('crm-open-global-search'))}
                 />
                 <span className="ml-2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                   Ctrl+K
                 </span>
              </div>

              <Notifications />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                   <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden border-2 border-white shadow-sm hover:scale-105 transition-transform">
                     <Avatar className="h-full w-full">
                       <AvatarFallback className="bg-orange-100 text-orange-600">
                         {userInitial}
                       </AvatarFallback>
                     </Avatar>
                   </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-xl border-none p-2">
                  <DropdownMenuItem onClick={handleSignOut} className="rounded-xl text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer p-3">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Выйти</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
           </div>
           
           {/* Mobile Menu Toggle */}
           <div className="md:hidden ml-1">
             <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
               <SheetTrigger asChild>
                 <Button variant="ghost" size="icon">
                   <Menu className="h-6 w-6" />
                 </Button>
               </SheetTrigger>
               <SheetContent side="left" className="w-64">
                 <SheetTitle className="sr-only">Меню навигации</SheetTitle>
                 <SheetDescription className="sr-only">Основное меню мобильной навигации</SheetDescription>
                 <div className="flex flex-col gap-4 mt-8 overflow-y-auto max-h-[80vh]">
                   {mobileNavigation.map((item) =>
                     "openAiSheet" in item && item.openAiSheet ? (
                       <button
                         key={item.name}
                         type="button"
                         onClick={() => {
                           openCrmAiAssistant();
                           setSidebarOpen(false);
                         }}
                         className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left hover:bg-violet-50 text-violet-900"
                       >
                         <item.icon className="h-5 w-5" />
                         {item.name}
                       </button>
                     ) : (
                       <Link
                         key={item.name}
                         to={item.href}
                         onClick={() => setSidebarOpen(false)}
                         className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                           isNavActive(item.href)
                             ? 'bg-slate-900 text-white'
                             : 'hover:bg-slate-100'
                         }`}
                       >
                         <item.icon className="h-5 w-5" />
                         {item.name}
                       </Link>
                     ),
                   )}
                 </div>
               </SheetContent>
             </Sheet>
           </div>
          </div>
        </header>

        {/* 3. Dashboard Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-6 pt-1 md:px-6 md:pb-8 md:pt-2 custom-scrollbar">
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
