import React, { useEffect, useState } from 'react';
import { crmUrl } from '../lib/crmApi.ts';
import { useLocation, useNavigate } from 'react-router-dom';
import { crm } from '@/lib/crmClient.ts';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner@2.0.3';
import { loginRedirectPath } from '../lib/userRole.ts';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Sparkles } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath =
    typeof (location.state as { from?: { pathname?: string } } | null)?.from?.pathname === 'string'
      ? (location.state as { from: { pathname: string } }).from.pathname
      : '/';

  const resolveRedirect = (session: { user?: { user_metadata?: Record<string, unknown> } } | null) => {
    if (fromPath.startsWith('/dealer') && !loginRedirectPath(session).startsWith('/dealer')) {
      return fromPath;
    }
    return loginRedirectPath(session);
  };

  useEffect(() => {
    let cancelled = false;
    crm.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) navigate(resolveRedirect(session), { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [fromPath, navigate]);

  const handleQuickLogin = async () => {
    setLoading(true);
    try {
      let token: string | null = null;
      let migError = '';
      const migRes = await fetch(crmUrl('/auth/migration-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      const migBody = await migRes.json().catch(() => ({} as { error?: string; token?: string }));
      if (migRes.ok && migBody.token) token = migBody.token;
      else migError = migBody.error || `Ошибка входа (${migRes.status})`;

      if (!token) {
        throw new Error(migError || 'Быстрый вход недоступен. Введите email и пароль.');
      }
      localStorage.setItem('crm_token', token);
      window.dispatchEvent(new Event('crm-auth'));
      window.location.assign(fromPath);
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'message' in error && typeof (error as { message: string }).message === 'string'
          ? (error as { message: string }).message
          : 'Ошибка авторизации';
      toast.error(msg);
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const response = await fetch(`${crmUrl('/signup')}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Ошибка регистрации');
        }
        toast.success('Регистрация успешна!');
        const { error: signInError } = await crm.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (signInError) throw signInError;
        const { data: { session: s1 } } = await crm.auth.getSession();
        navigate(resolveRedirect(s1), { replace: true });
      } else {
        const { error } = await crm.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        const { data: { session: s2 } } = await crm.auth.getSession();
        navigate(resolveRedirect(s2), { replace: true });
      }
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'message' in error && typeof (error as { message: string }).message === 'string'
          ? (error as { message: string }).message
          : 'Ошибка авторизации';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="btt-crm-body min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[1100px] grid lg:grid-cols-2 gap-6">
        <div className="btt-module-content p-8 md:p-10">
          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: '#171817' }}>
              <Sparkles className="w-6 h-6" style={{ color: '#dafa58' }} />
            </div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Soyuz Grotesk, sans-serif' }}>
              {isSignUp ? 'Создать аккаунт' : 'BTT CRM'}
            </h1>
            <p className="text-[#747a74] mt-2">Управление заказами и производством</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-5" autoComplete="off">
            {!isSignUp && (
              <div className="rounded-[22px] p-4" style={{ background: '#dafa58' }}>
                <p className="font-semibold text-sm">Вход одним кликом</p>
                <Button
                  type="button"
                  className="w-full mt-3 h-10 rounded-[14px] font-bold"
                  style={{ background: '#171817', color: '#fff' }}
                  disabled={loading}
                  onClick={handleQuickLogin}
                >
                  Войти
                </Button>
              </div>
            )}
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="rounded-[13px] border-[#dfe3db]" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-[13px] border-[#dfe3db]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-[13px] border-[#dfe3db] pr-12"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 rounded-[14px] font-bold" style={{ background: '#dafa58' }} disabled={loading}>
              {loading ? '…' : (
                <span className="flex items-center justify-center gap-2">
                  {isSignUp ? 'Зарегистрироваться' : 'Войти в систему'}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
          <p className="text-sm text-center mt-6 text-[#747a74]">
            {isSignUp ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="ml-2 font-bold text-[#171817]">
              {isSignUp ? 'Войти' : 'Создать'}
            </button>
          </p>
        </div>
        <div className="btt-module-hero hidden lg:flex flex-col justify-end">
          <div className="relative z-[2]">
            <small>BTT NEXUS</small>
            <h2 style={{ fontSize: 47, margin: '12px 0' }}>CRM система</h2>
            <p>Заказы, производство, склад и команда</p>
            <ul className="mt-6 space-y-2 text-sm text-[#aeb3ac]">
              {['Воронка заказов', 'График производства', 'AI-ассистент'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: '#dafa58' }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
