import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { crm } from "../lib/crmClient.ts";
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    crm.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!cancelled) {
          setSession(session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null);
          setLoading(false);
        }
      });

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
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="h-11 w-11 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/15">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
        <p className="text-sm text-slate-500">Загрузка сессии…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}