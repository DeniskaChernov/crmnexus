import React, { useState } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { useNavigate } from 'react-router-dom';
import { crm } from "@/lib/crmClient.ts";
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner@2.0.3';
import { Command, ArrowRight, CheckCircle2, User as UserIcon } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Use backend endpoint for immediate confirmation
        const response = await fetch(
          `${crmUrl('/signup')}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              password,
              name
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Ошибка регистрации');
        }

        toast.success('Регистрация успешна! Вход в систему...');
        
        // Auto login after signup
        const { error: signInError } = await crm.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) throw signInError;
        navigate('/');
        
      } else {
        const { error } = await crm.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/');
      }
    } catch (error: unknown) {
      console.error(error);
      const msg =
        error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : "Ошибка авторизации";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Left Pane - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[380px] animate-in slide-in-from-left-4 duration-500">
            {/* Header */}
            <div className="mb-10">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center mb-6 shadow-xl shadow-slate-900/10">
                    <Command className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
                    {isSignUp ? 'Создать аккаунт' : 'С возвращением'}
                </h1>
                <p className="text-slate-500">
                    {isSignUp ? 'Начните управлять продажами эффективнее' : 'Войдите, чтобы продолжить работу'}
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleAuth} className="space-y-5">
                {isSignUp && (
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Имя</Label>
                        <Input 
                            id="name" 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-slate-300 focus:ring-slate-900/5 transition-all rounded-lg"
                            placeholder="Иван Иванов"
                        />
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Email</Label>
                    <Input 
                        id="email" 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-slate-300 focus:ring-slate-900/5 transition-all rounded-lg"
                        placeholder="name@company.com"
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Пароль</Label>
                        {!isSignUp && (
                            <a href="#" className="text-xs font-medium text-slate-900 hover:text-slate-700">Забыли пароль?</a>
                        )}
                    </div>
                    <Input 
                        id="password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-slate-300 focus:ring-slate-900/5 transition-all rounded-lg"
                        placeholder="••••••••"
                    />
                </div>

                <Button 
                    type="submit" 
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-lg shadow-slate-900/20 rounded-lg mt-4 group" 
                    disabled={loading}
                >
                    {loading ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <span className="flex items-center">
                            {isSignUp ? 'Зарегистрироваться' : 'Войти в систему'}
                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </span>
                    )}
                </Button>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-8 border-t border-slate-100 text-center">
                <p className="text-sm text-slate-500">
                    {isSignUp ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}
                    <button 
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="ml-2 text-slate-900 font-bold hover:underline"
                    >
                        {isSignUp ? 'Войти' : 'Создать бесплатно'}
                    </button>
                </p>
            </div>
        </div>
      </div>

      {/* Right Pane - Visual */}
      <div className="hidden lg:flex w-1/2 bg-slate-50 border-l border-slate-200 p-12 items-center justify-center relative overflow-hidden">
         {/* Decorative pattern */}
         <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:32px_32px] opacity-50"></div>
         
         {/* Floating Elements */}
         <div className="relative z-10 max-w-md">
            <div className="bg-white p-8 rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] border border-slate-100 mb-8 transform rotate-1 transition-transform hover:rotate-0 duration-500">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">Успешная сделка</h3>
                        <p className="text-slate-500 text-sm">ООО "ТехноСтрой"</p>
                    </div>
                    <div className="ml-auto">
                        <span className="text-emerald-600 font-bold">+ 12.5M UZS</span>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-slate-900 rounded-full"></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 font-medium">
                        <span>Прогресс</span>
                        <span>75%</span>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900">Управляйте бизнесом на новом уровне</h2>
                <ul className="space-y-3">
                    {[
                        'Автоматический расчет воронки продаж',
                        'Интеграция с почтой и мессенджерами',
                        'Умная аналитика на базе AI'
                    ].map((item, i) => (
                        <li key={i} className="flex items-center text-slate-600">
                            <CheckCircle2 className="w-5 h-5 text-slate-900 mr-3" />
                            {item}
                        </li>
                    ))}
                </ul>
            </div>
         </div>
      </div>
    </div>
  );
}
