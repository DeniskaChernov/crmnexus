import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { crm } from "../lib/crmClient.ts";
import { ensureAuthToken } from "../lib/crmApi.ts";
import { isDealerSession } from "../lib/userRole.ts";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const resolveSession = async (attempt = 0) => {
      const { data: { session } } = await crm.auth.getSession();
      if (cancelled) return;
      if (session) {
        setSession(session);
        setLoading(false);
        return;
      }
      if (attempt === 0) {
        await ensureAuthToken();
        return resolveSession(attempt + 1);
      }
      const hasToken = Boolean(localStorage.getItem("crm_token"));
      if (hasToken && attempt < 4) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        return resolveSession(attempt + 1);
      }
      setSession(null);
      setLoading(false);
    };

    void resolveSession();

    const {
      data: { subscription },
    } = crm.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setSession(session);
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
      <div className="btt-crm-body h-screen w-full flex flex-col items-center justify-center gap-3">
        <div className="btt-module-content px-6 py-3 text-sm text-[#747a74]">Загрузка сессии…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isDealerSession(session)) {
    return <Navigate to="/dealer" replace />;
  }

  return <>{children}</>;
}
