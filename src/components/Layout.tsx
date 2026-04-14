import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  Share,
  Trash2,
  FileText,
  Bot,
  ChefHat,
  Calendar,
  UserPlus,
  Phone,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { ImageWithFallback } from "./ImageWithFallback";
import { crm } from "@/lib/crmClient.ts";
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from './ui/sheet';
import Notifications from './Notifications';
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

  const userRole = user?.user_metadata?.role || 'director'; // Default to director for creator/first user
  const isAdmin = userRole === 'admin' || userRole === 'director' || userRole === 'owner';
  const isManager = userRole === 'manager' || isAdmin;

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
    { name: 'Сотрудники', href: '/employees', icon: Users, roles: ['admin', 'director', 'manager', 'owner'] },
    { name: 'Маркетинг', href: '/marketing', icon: BarChart3, roles: ['admin', 'director', 'manager', 'owner'] },
  ];

  const topNavigation = allNavigation.filter(item => item.roles.includes(userRole));

  // Combine everything for mobile menu
  const mobileNavigation = [
    { name: 'Лиды', href: '/leads', icon: UserPlus }, // Add leads back for mobile menu
    ...topNavigation,
    { name: 'Библиотека Рецептов', href: '/recipes', icon: ChefHat },
    { name: 'AI Чат', href: '/ai-chat', icon: Bot },
    ...(isAdmin ? [{ name: 'Настройки', href: '/settings', icon: Settings }] : [])
  ];

  return (
    <div className="min-h-screen flex font-sans text-slate-600 bg-background overflow-hidden">
      
      {/* 1. Left Icon Sidebar (Fixed strip) */}
      <aside className="hidden md:flex flex-col items-center py-6 w-20 bg-background/60 backdrop-blur-md z-50 border-r border-slate-100/50">
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
                 ? 'bg-blue-100 text-blue-700 shadow-sm'
                 : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
             }`}
             title="Лиды (Холодные)"
           >
              <Phone className="h-5 w-5" />
           </Button>

           {/* Quick Create Menu */}
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Создать">
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
                 ? 'bg-blue-100 text-blue-700 shadow-sm'
                 : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
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
             className={`h-10 w-10 rounded-xl transition-colors ${
               location.pathname === '/sales-analytics' 
                 ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-md' 
                 : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
             }`}
             title="Аналитика и Отчеты"
           >
              <TrendingUp className="h-5 w-5" />
           </Button>

           {/* AI Chat */}
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => navigate('/ai-chat')}
             className={`h-10 w-10 rounded-xl transition-all ${
               location.pathname === '/ai-chat'
                 ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md hover:shadow-lg scale-105'
                 : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'
             }`}
             title="AI Чат"
           >
              <Bot className="h-5 w-5" />
           </Button>

           {/* Recipes */}
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => navigate('/recipes')}
             className={`h-10 w-10 rounded-xl transition-colors ${
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
        
        {/* 2. Top Navigation Bar (Pill menu + Search + Profile) */}
        <header className="h-16 md:h-24 px-4 md:px-8 flex items-center justify-between shrink-0 bg-transparent z-40">
           
           {/* Logo / Brand Name */}
           <div className="flex items-center gap-3 mr-4 md:mr-8">
              <Link to="/" className="block">
                 <ImageWithFallback 
                    src={bttLogo} 
                    alt="BTT Nexus" 
                    className="h-10 md:h-12 w-auto object-contain bg-slate-900 rounded-full px-3 py-1.5 md:px-4 md:py-2 shadow-md"
                 />
              </Link>
           </div>

           {/* Center Menu - Pills */}
           <nav className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto custom-scrollbar px-4">
              {(topNavigation && topNavigation.length > 0 ? topNavigation : [
                { name: 'Дашборд', href: '/' },
                // Leads removed from here
                { name: 'Сделки', href: '/deals' },
                { name: 'Задачи', href: '/tasks' },
                { name: 'Контакты', href: '/database' },
                { name: 'Аналитика', href: '/sales-analytics' },
                { name: 'Склад', href: '/warehouse' },
                { name: 'Сотрудники', href: '/employees' },
                { name: 'Маркетинг', href: '/marketing' },
              ]).map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`whitespace-nowrap text-sm transition-all duration-300 rounded-full ${
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
           <div className="flex items-center gap-4 ml-4">
              {/* Search Pill */}
              <div className="hidden lg:flex items-center bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100 w-64">
                 <Search className="h-4 w-4 text-slate-400 mr-2" />
                 <input 
                    type="text" 
                    placeholder="Search..." 
                    className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400"
                 />
              </div>

              <Notifications />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                   <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden border-2 border-white shadow-sm hover:scale-105 transition-transform">
                     <Avatar className="h-full w-full">
                       <AvatarFallback className="bg-orange-100 text-orange-600">
                         {user?.email?.[0].toUpperCase()}
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
           <div className="md:hidden ml-4">
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
                   {mobileNavigation.map((item) => (
                     <Link
                       key={item.name}
                       to={item.href}
                       onClick={() => setSidebarOpen(false)}
                       className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                         location.pathname === item.href
                           ? 'bg-slate-900 text-white'
                           : 'hover:bg-slate-100'
                       }`}
                     >
                       <item.icon className="h-5 w-5" />
                       {item.name}
                     </Link>
                   ))}
                 </div>
               </SheetContent>
             </Sheet>
           </div>
        </header>

        {/* 3. Dashboard Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden md:px-8 md:pb-8 custom-scrollbar">
           <div className="max-w-[1600px] mx-auto w-full">
             <Outlet />
           </div>
        </main>

      </div>
    </div>
  );
}