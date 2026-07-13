import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { crm } from "../lib/crmClient.ts";
import { ensureAuthToken } from "../lib/crmApi.ts";
import { isDealerSession } from "../lib/userRole.ts";

export default function DealerAuthGuard() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const resolve = async (attempt = 0) => {
      const { data: { session: s } } = await crm.auth.getSession();
      if (cancelled) return;
      if (s) {
        setSession(s);
        setLoading(false);
        return;
      }
      if (attempt === 0) {
        await ensureAuthToken();
        return resolve(1);
      }
      setSession(null);
      setLoading(false);
    };
    void resolve();
    const { data: { subscription } } = crm.auth.onAuthStateChange((_e, s) => {
      if (!cancelled) {
        setSession(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6f4] text-sm text-neutral-600">
        Загрузка портала дилера…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isDealerSession(session)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
