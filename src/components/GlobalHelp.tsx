import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  BookOpen, 
  GraduationCap, 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  PieChart,
  Lightbulb,
  ArrowRight,
  Target,
  AlertCircle,
  X
} from 'lucide-react';

export function GlobalHelp() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Sheet>
        <SheetTrigger asChild>
          <Button 
            size="icon" 
            className="h-14 w-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-neutral-800 hover:to-neutral-900 text-white border-2 border-white/50 transition-all hover:scale-105 hover:shadow-[0_8px_40px_rgb(0,0,0,0.16)]"
          >
            <BookOpen className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        
        <SheetContent className="overflow-y-auto sm:max-w-[540px] w-full z-[100] border-l-0 shadow-2xl p-0">
          
          {/* Header */}
          <div className="bg-neutral-50/80 backdrop-blur-md sticky top-0 z-20 border-b px-6 py-5 flex items-start justify-between gap-4">
            <SheetHeader className="text-left p-0 space-y-1 flex-1">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold text-neutral-900">
                <div className="p-2 bg-[var(--tasklab-lime)]/20 rounded-xl border border-[var(--tasklab-lime)]/30">
                  <GraduationCap className="h-6 w-6 text-neutral-900" />
                </div>
                База знаний BTT NEXUS
              </SheetTitle>
              <SheetDescription className="text-neutral-500 ml-1">
                Руководство собственника по управлению на основе данных
              </SheetDescription>
            </SheetHeader>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="shrink-0 -mr-2 -mt-2 md:hidden">
                 <X className="h-6 w-6 text-neutral-500" />
              </Button>
            </SheetClose>
          </div>

          <div className="p-6 space-y-8 bg-neutral-50/30 min-h-full">
            
            {/* Intro Card */}
            <div className="tasklab-card p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[var(--tasklab-lime)]"></div>
              <div className="flex gap-4">
                <div className="p-2 bg-[var(--tasklab-lime)]/20 rounded-full h-fit shrink-0">
                  <Lightbulb className="h-5 w-5 text-neutral-900" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-neutral-900 text-sm">Принцип "От общего к частному"</h4>
                  <p className="text-sm text-neutral-600 leading-relaxed">
                    Не закапывайтесь в цифры сразу. Начните с вкладки <strong>Обзор</strong>, чтобы понять общий тренд. Если видите падение — переходите в <strong>Воронку</strong> и <strong>Продажи</strong>, чтобы найти конкретную причину.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              
              {/* 1. OVERVIEW */}
              <Card className="tasklab-card border-0 border-neutral-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group bg-white">
                <div className="h-1.5 w-full bg-neutral-600 group-hover:bg-neutral-800 transition-colors" />
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2 text-neutral-900 text-lg">
                      <BarChart3 className="h-5 w-5 text-neutral-500" />
                      1. Стратегия (Обзор)
                    </h3>
                    <Badge variant="secondary" className="bg-neutral-100 text-neutral-600">Ежедневно</Badge>
                  </div>
                  
                  <div className="bg-neutral-50 rounded-lg p-3 mb-4 text-sm italic text-neutral-600 border border-neutral-100">
                    "Где мы находимся относительно цели месяца?"
                  </div>

                  <div className="space-y-4 text-sm text-neutral-700">
                    <div>
                      <h5 className="font-semibold text-neutral-900 mb-1 flex items-center gap-2">
                        <Target className="h-3 w-3 text-neutral-400" /> Smart Forecast (Умный прогноз)
                      </h5>
                      <p className="text-neutral-600 pl-5">
                        Это не просто сумма сделок. Мы учитываем историческую вероятность закрытия. 
                        Если прогноз <span className="text-red-500 font-medium">ниже плана</span> — нужно срочно наполнять воронку новыми лидами.
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-neutral-900 mb-1 flex items-center gap-2">
                        <Target className="h-3 w-3 text-neutral-400" /> Динамика (Growth)
                      </h5>
                      <p className="text-neutral-600 pl-5">
                        Сравнивает текущий месяц с прошлым. Нормальный рост — это <strong>+10-20%</strong>. Если цифра отрицательная, проверьте количество новых сделок.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. SALES */}
              <Card className="tasklab-card border-0 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
                <div className="h-1.5 w-full bg-neutral-900 group-hover:bg-neutral-800 transition-colors" />
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2 text-neutral-900 text-lg">
                      <TrendingUp className="h-5 w-5 text-neutral-700" />
                      2. Тактика (Продажи)
                    </h3>
                    <Badge variant="secondary" className="bg-[var(--tasklab-lime)]/20 text-neutral-900">Еженедельно</Badge>
                  </div>

                  <div className="bg-[var(--tasklab-lime)]/10 rounded-lg p-3 mb-4 text-sm italic text-neutral-800 border border-[var(--tasklab-lime)]/30">
                    "Кто наши лучшие клиенты и как продавать больше?"
                  </div>

                  <div className="space-y-4 text-sm text-neutral-700">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-neutral-50 p-3 rounded-lg">
                        <span className="font-semibold block text-neutral-900 mb-1">Принцип Парето (LTV)</span>
                        <p className="text-neutral-600 text-xs leading-relaxed">
                          Топ-5 клиентов обычно приносят 50-80% выручки. Удерживать их дешевле, чем искать новых. 
                          <span className="block mt-1 text-neutral-900 font-medium">Совет: Позвоните топ-клиентам лично раз в квартал.</span>
                        </p>
                      </div>
                      <div className="bg-neutral-50 p-3 rounded-lg">
                         <span className="font-semibold block text-neutral-900 mb-1">Средний чек</span>
                         <p className="text-neutral-600 text-xs leading-relaxed">
                           Растет ли он? Если нет — менеджеры не делают Cross-sell (допродажи) или боятся предлагать дорогие услуги.
                         </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3. FINANCE */}
              <Card className="tasklab-card border-0 border-emerald-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group bg-white">
                <div className="h-1.5 w-full bg-emerald-500 group-hover:bg-emerald-600 transition-colors" />
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2 text-neutral-900 text-lg">
                      <DollarSign className="h-5 w-5 text-emerald-500" />
                      3. Финансы (Cash Flow)
                    </h3>
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Важно</Badge>
                  </div>

                  <div className="bg-emerald-50/50 rounded-lg p-3 mb-4 text-sm italic text-emerald-800 border border-emerald-100">
                    "Контракт подписан, но где деньги?"
                  </div>

                  <div className="space-y-4 text-sm text-neutral-700">
                    <div className="flex gap-4 items-start">
                      <div className="w-full">
                        <p className="mb-2 text-neutral-600">
                          Мы разделяем понятие "Выручка" на две части:
                        </p>
                        <ul className="space-y-2">
                          <li className="flex items-start gap-2 bg-[var(--tasklab-lime)]/10 p-2 rounded border border-[var(--tasklab-lime)]/30">
                            <span className="w-2 h-2 rounded-full bg-neutral-900 mt-1.5 shrink-0" />
                            <span><strong className="text-neutral-900">Contracted:</strong> Обязательства. Клиент подписал договор, но денег еще нет.</span>
                          </li>
                          <li className="flex items-start gap-2 bg-emerald-50/50 p-2 rounded border border-emerald-100">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <span><strong className="text-emerald-700">Collected:</strong> Кэш. Деньги реально поступили на счет.</span>
                          </li>
                        </ul>
                        <div className="mt-3 flex gap-2 items-center text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
                          <AlertCircle className="h-4 w-4" />
                          <span>Большой разрыв = Кассовый разрыв. Требуйте авансы!</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4. PIPELINE */}
              <Card className="tasklab-card-dark border-0 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
                <div className="h-1.5 w-full bg-[var(--tasklab-lime)] group-hover:opacity-90 transition-colors" />
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2 text-white text-lg">
                      <PieChart className="h-5 w-5 text-[var(--tasklab-lime)]" />
                      4. Воронка (Эффективность)
                    </h3>
                    <Badge variant="secondary" className="bg-white/10 text-white border-0">Контроль</Badge>
                  </div>

                  <div className="bg-white/5 rounded-lg p-3 mb-4 text-sm italic text-neutral-200 border border-white/10">
                    "Где мы теряем клиентов?"
                  </div>

                  <div className="space-y-3 text-sm text-neutral-200">
                    <p className="text-neutral-300">
                      Воронка показывает "узкие горлышки". Идеальная воронка похожа на трубу, плохая — на бокал для мартини (резкое сужение).
                    </p>
                    <ul className="grid grid-cols-1 gap-2">
                       <li className="p-2 border border-white/10 rounded bg-white/5 flex justify-between items-center">
                         <span className="font-medium text-white">Конверсия</span>
                         <span className="text-neutral-400 text-xs">Норма: 15-30% для B2B</span>
                       </li>
                       <li className="p-2 border border-white/10 rounded bg-white/5 flex justify-between items-center">
                         <span className="font-medium text-white">Зависшие сделки</span>
                         <span className="text-neutral-400 text-xs">Если сделка висит &gt;30 дней — закрывайте как Lost</span>
                       </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

            </div>
            
            <div className="h-10" />

            <SheetClose asChild>
              <Button className="w-full md:hidden" variant="secondary" size="lg">
                Закрыть Базу Знаний
              </Button>
            </SheetClose>

            <div className="h-10" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
