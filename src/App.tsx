import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Database from "./pages/crm/Database";
import Deals from "./pages/crm/Deals";
import DealsArchive from "./pages/crm/DealsArchive";
import Tasks from "./pages/crm/Tasks";
import Marketing from "./pages/Marketing";
import Settings from "./pages/Settings";
import ImportWizard from "./pages/Import";
import { Toaster } from "sonner@2.0.3";
import GlobalSearch from "./components/GlobalSearch";
import { GlobalHelp } from "./components/GlobalHelp";
import Warehouse from "./components/Warehouse";
import AIChatPage from "./pages/AIChatPage";
import Employees from "./components/Employees";
import Recipes from "./pages/Recipes";
import ProductionCalendar from "./pages/ProductionCalendar";
import Leads from "./pages/crm/Leads";
import SalesAnalytics from "./pages/SalesAnalytics";
import { NexusProvider } from "./components/nexus/NexusContext";
import { NexusOrb } from "./components/nexus/NexusOrb";

export default function App() {
  return (
    <BrowserRouter>
      <NexusProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<Layout />}>
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

        <Toaster
          position="top-right"
          richColors
          expand={true}
        />
        <GlobalSearch />
        <GlobalHelp />
        <NexusOrb />
      </NexusProvider>
    </BrowserRouter>
  );
}