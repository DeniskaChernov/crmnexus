import React, { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "sonner@2.0.3";
import { Loader2 } from "lucide-react";
import AuthGuard from "./components/AuthGuard";

const loadLayout = () => import("./components/Layout");
const loadLogin = () => import("./pages/Login");
const loadDashboard = () => import("./pages/Dashboard");
const loadDatabase = () => import("./pages/crm/Database");
const loadDeals = () => import("./pages/crm/Deals");
const loadDealsArchive = () => import("./pages/crm/DealsArchive");
const loadTasks = () => import("./pages/crm/Tasks");
const loadMarketing = () => import("./pages/Marketing");
const loadSettings = () => import("./pages/Settings");
const loadImportWizard = () => import("./pages/Import");
const loadWarehouse = () => import("./components/Warehouse");
const loadAIChat = () => import("./pages/AIChatPage");
const loadEmployees = () => import("./components/Employees");
const loadRecipes = () => import("./pages/Recipes");
const loadProductionCalendar = () => import("./pages/ProductionCalendar");
const loadLeads = () => import("./pages/crm/Leads");
const loadSalesAnalytics = () => import("./pages/SalesAnalytics");
const loadGlobalSearch = () => import("./components/GlobalSearch");

const Layout = lazy(loadLayout);
const Login = lazy(loadLogin);
const Dashboard = lazy(loadDashboard);
const Database = lazy(loadDatabase);
const Deals = lazy(loadDeals);
const DealsArchive = lazy(loadDealsArchive);
const Tasks = lazy(loadTasks);
const Marketing = lazy(loadMarketing);
const Settings = lazy(loadSettings);
const ImportWizard = lazy(loadImportWizard);
const Warehouse = lazy(loadWarehouse);
const AIChatPage = lazy(loadAIChat);
const Employees = lazy(loadEmployees);
const Recipes = lazy(loadRecipes);
const ProductionCalendar = lazy(loadProductionCalendar);
const Leads = lazy(loadLeads);
const SalesAnalytics = lazy(loadSalesAnalytics);
const GlobalSearch = lazy(loadGlobalSearch);
const GlobalHelp = lazy(() =>
  import("./components/GlobalHelp").then((m) => ({ default: m.GlobalHelp })),
);
function AppFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
        <span className="text-sm text-slate-600">Загрузка интерфейса…</span>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const prefetch = () => {
      void Promise.allSettled([
        loadDashboard(),
        loadDeals(),
        loadTasks(),
        loadDatabase(),
        loadGlobalSearch(),
      ]);
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(prefetch);
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(prefetch, 1200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <BrowserRouter>
        <Suspense fallback={<AppFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
              <Route index element={<Dashboard />} />
              <Route path="database" element={<Database />} />
              <Route path="leads" element={<Leads />} />
              <Route path="deals" element={<Deals />} />
              <Route
                path="deals/archive"
                element={<DealsArchive />}
              />
              <Route path="tasks" element={<Tasks />} />
              <Route path="marketing" element={<Marketing />} />
              <Route path="warehouse" element={<Warehouse />} />
              <Route path="employees" element={<Employees />} />
              <Route path="settings" element={<Settings />} />
              <Route path="import" element={<ImportWizard />} />
              <Route path="ai-chat" element={<AIChatPage />} />
              <Route path="recipes" element={<Recipes />} />
              <Route
                path="production-calendar"
                element={<ProductionCalendar />}
              />
              <Route
                path="sales-analytics"
                element={<SalesAnalytics />}
              />
            </Route>

            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </Suspense>

        <Toaster
          position="top-right"
          richColors
          expand={true}
        />
        <Suspense fallback={null}>
          <GlobalSearch />
          <GlobalHelp />
        </Suspense>
    </BrowserRouter>
  );
}
