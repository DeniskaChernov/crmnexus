import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, Package, ArrowUpCircle, ArrowDownCircle, Truck, RefreshCcw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface MonthlyData {
  month: string;
  warehouses: Record<string, {
    produced: number;
    shipped: number;
    transferredIn: number;
    transferredOut: number;
    corrected: number;
    producedByArticle: Record<string, number>;
    shippedByArticle: Record<string, number>;
  }>;
}

interface MonthlyStatsProps {
  data: MonthlyData[];
  selectedWarehouse: string;
}

export const WarehouseMonthlyStats = ({ data, selectedWarehouse }: MonthlyStatsProps) => {
  if (!data || data.length === 0) {
    return (
      <Card className="tasklab-card border-0">
        <CardContent className="py-12">
          <div className="text-center text-neutral-500">
            <Package className="h-12 w-12 mx-auto mb-3 text-neutral-300" />
            <p className="text-sm">Нет данных для отображения</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const chartData = data.map(item => {
    const monthName = new Date(item.month + '-01').toLocaleDateString('ru-RU', { year: 'numeric', month: 'short' });
    
    if (selectedWarehouse === 'all') {
      // Aggregate all warehouses
      let produced = 0;
      let shipped = 0;
      let transferredIn = 0;
      let transferredOut = 0;
      let corrected = 0;

      Object.values(item.warehouses).forEach(wh => {
        produced += wh.produced || 0;
        shipped += wh.shipped || 0;
        transferredIn += wh.transferredIn || 0;
        transferredOut += wh.transferredOut || 0;
        corrected += wh.corrected || 0;
      });

      return {
        month: monthName,
        produced: Math.round(produced),
        shipped: Math.round(shipped),
        transferredIn: Math.round(transferredIn),
        transferredOut: Math.round(transferredOut),
        corrected: Math.round(corrected),
        net: Math.round(produced - shipped + corrected)
      };
    } else {
      // Specific warehouse
      const wh = item.warehouses[selectedWarehouse] || { produced: 0, shipped: 0, transferredIn: 0, transferredOut: 0, corrected: 0 };
      return {
        month: monthName,
        produced: Math.round(wh.produced),
        shipped: Math.round(wh.shipped),
        transferredIn: Math.round(wh.transferredIn),
        transferredOut: Math.round(wh.transferredOut),
        corrected: Math.round(wh.corrected),
        net: Math.round(wh.produced - wh.shipped + wh.transferredIn - wh.transferredOut + wh.corrected)
      };
    }
  }).reverse(); // Reverse to show oldest first in chart

  // Calculate totals
  const totals = chartData.reduce((acc, item) => ({
    produced: acc.produced + item.produced,
    shipped: acc.shipped + item.shipped,
    transferredIn: acc.transferredIn + item.transferredIn,
    transferredOut: acc.transferredOut + item.transferredOut,
    corrected: acc.corrected + item.corrected,
    net: acc.net + item.net
  }), { produced: 0, shipped: 0, transferredIn: 0, transferredOut: 0, corrected: 0, net: 0 });

  // Get top articles
  const getTopArticles = (type: 'produced' | 'shipped') => {
    const articleTotals: Record<string, number> = {};
    
    data.forEach(item => {
      if (selectedWarehouse === 'all') {
        Object.values(item.warehouses).forEach(wh => {
          const articles = type === 'produced' ? wh.producedByArticle : wh.shippedByArticle;
          Object.entries(articles || {}).forEach(([art, qty]) => {
            articleTotals[art] = (articleTotals[art] || 0) + qty;
          });
        });
      } else {
        const wh = item.warehouses[selectedWarehouse];
        if (wh) {
          const articles = type === 'produced' ? wh.producedByArticle : wh.shippedByArticle;
          Object.entries(articles || {}).forEach(([art, qty]) => {
            articleTotals[art] = (articleTotals[art] || 0) + qty;
          });
        }
      }
    });

    return Object.entries(articleTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([article, amount]) => ({ article, amount: Math.round(amount) }));
  };

  const topProduced = getTopArticles('produced');
  const topShipped = getTopArticles('shipped');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="tasklab-card border-0 bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-green-600" />
              Произведено
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {totals.produced.toLocaleString()}
              <span className="text-sm font-normal text-neutral-500 ml-1">кг</span>
            </div>
          </CardContent>
        </Card>

        <Card className="tasklab-card border-0 bg-gradient-to-br from-red-50 to-white border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4 text-red-600" />
              Отгружено
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {totals.shipped.toLocaleString()}
              <span className="text-sm font-normal text-neutral-500 ml-1">кг</span>
            </div>
          </CardContent>
        </Card>

        <Card className="tasklab-card border-0 bg-gradient-to-br from-[var(--tasklab-lime)]/10 to-white border-neutral-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <Truck className="h-4 w-4 text-neutral-900" />
              Перемещения
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-sm">
                <span className="text-green-600 font-semibold">↓ {totals.transferredIn.toLocaleString()}</span>
                <span className="text-neutral-400 mx-1">/</span>
                <span className="text-red-600 font-semibold">↑ {totals.transferredOut.toLocaleString()}</span>
                <span className="text-xs text-neutral-500 ml-1">кг</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="tasklab-card border-0 bg-gradient-to-br from-neutral-50 to-white border-neutral-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 text-neutral-600" />
              Чистое изменение
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-700 flex items-center gap-2">
              {totals.net > 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : totals.net < 0 ? (
                <TrendingDown className="h-5 w-5 text-red-600" />
              ) : null}
              <span className={totals.net >= 0 ? 'text-green-700' : 'text-red-700'}>
                {totals.net >= 0 ? '+' : ''}{totals.net.toLocaleString()}
              </span>
              <span className="text-sm font-normal text-neutral-500">кг</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="produced">Производство</TabsTrigger>
          <TabsTrigger value="articles">Артикулы</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="tasklab-card border-0">
            <CardHeader>
              <CardTitle className="text-base">Производство и отгрузка по месяцам</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}
                    formatter={(value: any) => `${value.toLocaleString()} кг`}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="produced" fill="#10b981" name="Произведено" />
                  <Bar dataKey="shipped" fill="#ef4444" name="Отгружено" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="tasklab-card border-0">
            <CardHeader>
              <CardTitle className="text-base">Чистое изменение остатков</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}
                    formatter={(value: any) => `${value.toLocaleString()} кг`}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="net" stroke="#171717" strokeWidth={2} name="Чистое изменение" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produced" className="space-y-4">
          <Card className="tasklab-card border-0">
            <CardHeader>
              <CardTitle className="text-base">Детали производства по месяцам</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}
                    formatter={(value: any) => `${value.toLocaleString()} кг`}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="produced" fill="#10b981" name="Произведено" />
                  <Bar dataKey="transferredIn" fill="#a3e635" name="Получено" />
                  <Bar dataKey="corrected" fill="#f59e0b" name="Корректировка" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="tasklab-card border-0">
            <CardHeader>
              <CardTitle className="text-base">Расход по месяцам</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}
                    formatter={(value: any) => `${value.toLocaleString()} кг`}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="shipped" fill="#ef4444" name="Отгружено" />
                  <Bar dataKey="transferredOut" fill="#f97316" name="Отправлено" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="articles" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="tasklab-card border-0">
              <CardHeader>
                <CardTitle className="text-base">Топ-10 произведенных артикулов</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topProduced.length > 0 ? (
                    topProduced.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-green-100 text-green-700 font-bold">
                            {idx + 1}
                          </Badge>
                          <span className="text-sm font-medium text-neutral-700">{item.article}</span>
                        </div>
                        <span className="text-sm font-bold text-green-700">
                          {item.amount.toLocaleString()} кг
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-neutral-500 text-center py-4">Нет данных</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="tasklab-card border-0">
              <CardHeader>
                <CardTitle className="text-base">Топ-10 отгруженных артикулов</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topShipped.length > 0 ? (
                    topShipped.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-red-100 text-red-700 font-bold">
                            {idx + 1}
                          </Badge>
                          <span className="text-sm font-medium text-neutral-700">{item.article}</span>
                        </div>
                        <span className="text-sm font-bold text-red-700">
                          {item.amount.toLocaleString()} кг
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-neutral-500 text-center py-4">Нет данных</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly breakdown table */}
          <Card className="tasklab-card border-0">
            <CardHeader>
              <CardTitle className="text-base">Детализация по месяцам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-2 px-3 font-semibold text-neutral-700">Месяц</th>
                      <th className="text-right py-2 px-3 font-semibold text-green-700">Произведено</th>
                      <th className="text-right py-2 px-3 font-semibold text-red-700">Отгружено</th>
                      <th className="text-right py-2 px-3 font-semibold text-neutral-800">Получено</th>
                      <th className="text-right py-2 px-3 font-semibold text-orange-700">Отправлено</th>
                      <th className="text-right py-2 px-3 font-semibold text-neutral-700">Итого</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.slice().reverse().map((row, idx) => (
                      <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50">
                        <td className="py-2 px-3 font-medium">{row.month}</td>
                        <td className="py-2 px-3 text-right text-green-700">+{row.produced.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-red-700">-{row.shipped.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-neutral-800">+{row.transferredIn.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-orange-700">-{row.transferredOut.toLocaleString()}</td>
                        <td className={`py-2 px-3 text-right font-bold ${row.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {row.net >= 0 ? '+' : ''}{row.net.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-neutral-300 font-bold">
                      <td className="py-2 px-3">Всего</td>
                      <td className="py-2 px-3 text-right text-green-700">+{totals.produced.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-red-700">-{totals.shipped.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-neutral-800">+{totals.transferredIn.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-orange-700">-{totals.transferredOut.toLocaleString()}</td>
                      <td className={`py-2 px-3 text-right ${totals.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {totals.net >= 0 ? '+' : ''}{totals.net.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
