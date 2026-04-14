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
            className="h-14 w-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-2 border-white/50 transition-all hover:scale-105 hover:shadow-[0_8px_40px_rgb(0,0,0,0.16)]"
          >
            <BookOpen className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        
        <SheetContent className="overflow-y-auto sm:max-w-[540px] w-full z-[100] border-l-0 shadow-2xl p-0">
          
          {/* Header */}
          <div className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20 border-b px-6 py-5 flex items-start justify-between gap-4">
            <SheetHeader className="text-left p-0 space-y-1 flex-1">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
                <div className="p-2 bg-blue-100/50 rounded-xl border border-blue-100">
                  <GraduationCap className="h-6 w-6 text-blue-700" />
                </div>
                База знаний BTT NEXUS
              </SheetTitle>
              <SheetDescription className="text-slate-500 ml-1">
                Руководство собственника по управлению на основе данных
              </SheetDescription>
            </SheetHeader>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="shrink-0 -mr-2 -mt-2 md:hidden">
                 <X className="h-6 w-6 text-slate-500" />
              </Button>
            </SheetClose>
          </div>

          <div className="p-6 space-y-8 bg-slate-50/30 min-h-full">
            
            {/* Intro Card */}
            <div className="bg-white border border-blue-100 p-5 rounded-xl shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <div className="flex gap-4">
                <div className="p-2 bg-blue-50 rounded-full h-fit shrink-0">
                  <Lightbulb className="h-5 w-5 text-blue-600" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-900 text-sm">Принцип "От общего к частному"</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Не закапывайтесь в цифры сразу. Начните с вкладки <strong>Обзор</strong>, чтобы понять общий тренд. Если видите падение — переходите в <strong>Воронку</strong> и <strong>Продажи</strong>, чтобы найти конкретную причину.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              
              {/* 1. OVERVIEW */}
              <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group bg-white">
                <div className="h-1.5 w-full bg-slate-600 group-hover:bg-slate-800 transition-colors" />
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2 text-slate-900 text-lg">
                      <BarChart3 className="h-5 w-5 text-slate-500" />
                      1. Стратегия (Обзор)
                    </h3>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600">Ежедневно</Badge>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm italic text-slate-600 border border-slate-100">
                    "Где мы находимся относительно цели месяца?"
                  </div>

                  <div className="space-y-4 text-sm text-slate-700">
                    <div>
                      <h5 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                        <Target className="h-3 w-3 text-slate-400" /> Smart Forecast (Умный прогноз)
                      </h5>
                      <p className="text-slate-600 pl-5">
                        Это не просто сумма сделок. Мы учитываем историческую вероятность закрытия. 
                        Если прогноз <span className="text-red-500 font-medium">ниже плана</span> — нужно срочно наполнять воронку новыми лидами.
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                        <Target className="h-3 w-3 text-slate-400" /> Динамика (Growth)
                      </h5>
                      <p className="text-slate-600 pl-5">
                        Сравнивает текущий месяц с прошлым. Нормальный рост — это <strong>+10-20%</strong>. Если цифра отрицательная, проверьте количество новых сделок.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. SALES */}
              <Card className="border-blue-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group bg-white">
                <div className="h-1.5 w-full bg-blue-500 group-hover:bg-blue-600 transition-colors" />
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2 text-slate-900 text-lg">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      2. Тактика (Продажи)
                    </h3>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700">Еженедельно</Badge>
                  </div>

                  <div className="bg-blue-50/50 rounded-lg p-3 mb-4 text-sm italic text-blue-800 border border-blue-100">
                    "Кто наши лучшие клиенты и как продавать больше?"
                  </div>

                  <div className="space-y-4 text-sm text-slate-700">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-slate-50 p-3 rounded-lg">
                        <span className="font-semibold block text-slate-900 mb-1">Принцип Парето (LTV)</span>
                        <p className="text-slate-600 text-xs leading-relaxed">
                          Топ-5 клиентов обычно приносят 50-80% выручки. Удерживать их дешевле, чем искать новых. 
                          <span className="block mt-1 text-blue-700 font-medium">Совет: Позвоните топ-клиентам лично раз в квартал.</span>
                        </p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg">
                         <span className="font-semibold block text-slate-900 mb-1">Средний чек</span>
                         <p className="text-slate-600 text-xs leading-relaxed">
                           Растет ли он? Если нет — менеджеры не делают Cross-sell (допродажи) или боятся предлагать дорогие услуги.
                         </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3. FINANCE */}
              <Card className="border-emerald-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group bg-white">
                <div className="h-1.5 w-full bg-emerald-500 group-hover:bg-emerald-600 transition-colors" />
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2 text-slate-900 text-lg">
                      <DollarSign className="h-5 w-5 text-emerald-500" />
                      3. Финансы (Cash Flow)
                    </h3>
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Важно</Badge>
                  </div>

                  <div className="bg-emerald-50/50 rounded-lg p-3 mb-4 text-sm italic text-emerald-800 border border-emerald-100">
                    "Контракт подписан, но где деньги?"
                  </div>

                  <div className="space-y-4 text-sm text-slate-700">
                    <div className="flex gap-4 items-start">
                      <div className="w-full">
                        <p className="mb-2 text-slate-600">
                          Мы разделяем понятие "Выручка" на две части:
                        </p>
                        <ul className="space-y-2">
                          <li className="flex items-start gap-2 bg-blue-50/50 p-2 rounded border border-blue-100">
                            <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            <span><strong className="text-blue-700">Contracted:</strong> Обязательства. Клиент подписал договор, но денег еще нет.</span>
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
              <Card className="border-purple-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group bg-white">
                <div className="h-1.5 w-full bg-purple-500 group-hover:bg-purple-600 transition-colors" />
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2 text-slate-900 text-lg">
                      <PieChart className="h-5 w-5 text-purple-500" />
                      4. Воронка (Эффективность)
                    </h3>
                    <Badge variant="secondary" className="bg-purple-50 text-purple-700">Контроль</Badge>
                  </div>

                  <div className="bg-purple-50/50 rounded-lg p-3 mb-4 text-sm italic text-purple-800 border border-purple-100">
                    "Где мы теряем клиентов?"
                  </div>

                  <div className="space-y-3 text-sm text-slate-700">
                    <p className="text-slate-600">
                      Воронка показывает "узкие горлышки". Идеальная воронка похожа на трубу, плохая — на бокал для мартини (резкое сужение).
                    </p>
                    <ul className="grid grid-cols-1 gap-2">
                       <li className="p-2 border border-slate-100 rounded bg-slate-50 flex justify-between items-center">
                         <span className="font-medium text-slate-700">Конверсия</span>
                         <span className="text-slate-500 text-xs">Норма: 15-30% для B2B</span>
                       </li>
                       <li className="p-2 border border-slate-100 rounded bg-slate-50 flex justify-between items-center">
                         <span className="font-medium text-slate-700">Зависшие сделки</span>
                         <span className="text-slate-500 text-xs">Если сделка висит &gt;30 дней — закрывайте как Lost</span>
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
