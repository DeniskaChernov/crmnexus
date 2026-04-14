import React, { useState, useEffect } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Users, Clock, Banknote, Calendar as CalendarIcon, Plus, Trash2, Edit2, TrendingUp, Info, Pencil, Settings, Wallet, CreditCard, DollarSign } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { crm } from "@/lib/crmClient.ts";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import { EmployeesDialog } from './EmployeesDialog';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export default function Employees() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // Dialog states
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isTimesheetOpen, setIsTimesheetOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [newTimesheet, setNewTimesheet] = useState({ employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), hours: '' });

  // Rates Settings
  const [rates, setRates] = useState({ winding: 1000, twisting: 1500 });
  const [isRatesOpen, setIsRatesOpen] = useState(false);
  
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  
  // Personal Employee Settings State
  const [personalSettings, setPersonalSettings] = useState({
      name: '',
      role: 'master', // master | sales_manager
      fixedSalary: '', // for sales_manager
      hourlyRate: '',
      windingRate: '',
      twistingRate: ''
  });

  // Payroll calculation dialog states
  const [isPayrollOpen, setIsPayrollOpen] = useState(false);
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]); // History of payments
  const [currentMonthPayroll, setCurrentMonthPayroll] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchPayrollForMonth();
  }, [selectedMonth]);

  const fetchPayrollForMonth = async () => {
    try {
        const monthStr = format(selectedMonth, 'yyyy-MM');
        const response = await fetch(`${crmUrl(`/payroll/${monthStr}`)}`, {
            headers: { ...authHeaders(false) }
        });
        if (response.ok) {
            const data = await response.json();
            setCurrentMonthPayroll(data);
        } else {
            setCurrentMonthPayroll(null);
        }
    } catch (e) {
        console.error("Error fetching payroll:", e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { ...authHeaders(false) };

      const [empRes, timeRes, logRes, ratesRes, dealsRes, paymentsRes] = await Promise.all([
        fetch(`${crmUrl("/employees")}`, { headers }),
        fetch(`${crmUrl("/timesheets")}`, { headers }),
        fetch(`${crmUrl("/production-logs")}`, { headers }),
        fetch(`${crmUrl("/settings/rates")}`, { headers }),
        crm.from("deals").select("*"),
        fetch(`${crmUrl("/payments")}`, { headers }),
      ]);

      if (empRes.ok) setEmployees(await empRes.json());
      if (timeRes.ok) setTimesheets(await timeRes.json());
      if (logRes.ok) setLogs(await logRes.json());
      if (ratesRes.ok) {
          const ratesData = await ratesRes.json();
          setRates(ratesData);
      }
      if (dealsRes.data) setDeals(dealsRes.data);
      if (paymentsRes.ok) setPayments(await paymentsRes.json());

    } catch (e) {
      console.error('Error fetching employee data:', e);
      toast.error("Ошибка загрузки данных сотрудников");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTimesheet = async () => {
    if (!newTimesheet.employeeId || !newTimesheet.hours) {
      toast.error("Заполните все поля");
      return;
    }

    try {
      const emp = employees.find(e => e.id === newTimesheet.employeeId);
      const rate = emp?.hourlyRate || 0;

      const response = await fetch(`${crmUrl('/timesheets')}`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify({
          ...newTimesheet,
          rate
        })
      });

      if (!response.ok) throw new Error("Failed");

      toast.success("Запись добавлена");
      setIsTimesheetOpen(false);
      setNewTimesheet({ employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), hours: '' });
      fetchData();
    } catch (e) {
      toast.error("Ошибка сохранения");
    }
  };

  const handleDeleteTimesheet = async (id: string) => {
    if (!confirm("Удалить запись?")) return;
    try {
      await fetch(`${crmUrl(`/timesheets/${id}`)}`, {
        method: 'DELETE',
        headers: { ...authHeaders(false) }
      });
      toast.success("Удалено");
      fetchData();
    } catch (e) {
      toast.error("Ошибка удаления");
    }
  };

  // When an employee is selected in Settings -> Personal
  useEffect(() => {
    if (selectedEmpId) {
        const emp = employees.find(e => e.id === selectedEmpId);
        if (emp) {
            setPersonalSettings({
                name: emp.name,
                role: emp.role || 'master',
                fixedSalary: emp.fixedSalary?.toString() || '2000000',
                hourlyRate: emp.hourlyRate?.toString() || '0',
                windingRate: emp.windingRate?.toString() || '',
                twistingRate: emp.twistingRate?.toString() || ''
            });
        }
    } else {
        setPersonalSettings({ name: '', role: 'master', fixedSalary: '', hourlyRate: '', windingRate: '', twistingRate: '' });
    }
  }, [selectedEmpId, employees]);

  const handleSavePersonalSettings = async () => {
    if (!selectedEmpId || !personalSettings.name.trim()) return;

    try {
        const response = await fetch(`${crmUrl(`/employees/${selectedEmpId}`)}`, {
            method: 'PUT',
            headers: { ...authHeaders() },
            body: JSON.stringify({
                name: personalSettings.name.trim(),
                role: personalSettings.role,
                fixedSalary: parseFloat(personalSettings.fixedSalary) || 0,
                hourlyRate: parseFloat(personalSettings.hourlyRate) || 0,
                windingRate: personalSettings.windingRate, 
                twistingRate: personalSettings.twistingRate
            })
        });

        if (!response.ok) throw new Error("Failed");

        toast.success("Данные сотрудника обновлены");
        fetchData(); // Refresh data to update UI
    } catch (e) {
        toast.error("Ошиба обновления сотрудника");
    }
  };

  // Calculation Logic
  const getStats = (employee: any) => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);

    // --- OWNER/DIRECTOR LOGIC ---
    // Calculate salary based on total cash balance (80% of total cash)
    if (employee.role === 'owner' || employee.role === 'director') {
        // Calculate total cash from payments (income) FOR SELECTED MONTH
        // Ensure payments is an array before calling reduce
        const paymentsArray = Array.isArray(payments) ? payments : [];
        
        // Filter payments for selected month only
        const monthlyPayments = paymentsArray.filter(p => {
            try {
                return isWithinInterval(parseISO(p.date), { start, end });
            } catch (e) {
                return false;
            }
        });
        
        const totalCash = monthlyPayments.reduce((sum, p) => {
            // Only count income payments (positive amounts)
            const amount = parseFloat(p?.amount) || 0;
            return sum + amount;
        }, 0);
        
        // Owner gets 80% of total cash (cash - 20%)
        const bonus = totalCash * 0.8;
        
        return {
            role: 'owner',
            totalCash,
            bonusRate: 0.80, // 80%
            bonus,
            totalSalary: bonus
        };
    }

    // --- SALES MANAGER LOGIC ---
    if (employee.role === 'sales_manager') {
        const fixedSalary = employee.fixedSalary || 2000000;
        
        // Calculate Total Sales from ALL ACTUAL PAYMENTS received in this month
        // For now, we count ALL payments in the system for this month
        // TODO: In future, filter by assignedTo field when it's added to deals table
        const actualPayments = payments.filter(p => {
            try {
                return isWithinInterval(parseISO(p.date), { start, end });
            } catch (e) {
                return false;
            }
        });
        
        // Total sales = sum of ALL ACTUAL PAYMENTS received in selected month
        const totalSales = actualPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Calculate Commission
        // < 20M: 5%
        // 20M - 40M: 10%
        // >= 40M: 15%
        let commissionRate = 0;
        if (totalSales < 20000000) commissionRate = 0.05;
        else if (totalSales < 40000000) commissionRate = 0.10;
        else commissionRate = 0.15;

        const commission = totalSales * commissionRate;
        const totalSalary = fixedSalary + commission;

        return {
            role: 'sales_manager',
            fixedSalary,
            totalSales,
            commissionRate,
            commission,
            totalSalary,
            dealsCount: deals.filter(d => d.status === 'won').length
        };
    }

    // --- MASTER LOGIC ---
    // 1. Timesheet Stats
    const empTimesheets = timesheets.filter(t => 
      t.employeeId === employee.id && 
      isWithinInterval(parseISO(t.date), { start, end })
    );

    const totalHours = empTimesheets.reduce((sum, t) => sum + (t.hours || 0), 0);
    // Calculate salary based on historical rate in timesheet (if saved) or current rate
    const salaryHours = empTimesheets.reduce((sum, t) => {
        // If rate is saved in timesheet use it, otherwise use current employee rate
        let rate = t.rate !== undefined ? t.rate : (employee.hourlyRate || 0);
        return sum + (t.hours * rate);
    }, 0);

    // 2. Production Stats
    // We need to look for logs where 'worker' or 'twistedWorker' matches employee name
    const empLogs = logs.filter(l => {
        const logDate = parseISO(l.date);
        return isWithinInterval(logDate, { start, end });
    });

    let windingKg = 0; // Намотка
    let twistingKg = 0; // Перекрутка
    let salaryPiecework = 0;

    // Use Personal Rates if set, otherwise Global Rates
    const actualWindingRate = employee.windingRate !== undefined && employee.windingRate !== null 
        ? employee.windingRate 
        : (rates.winding || 0);

    const actualTwistingRate = employee.twistingRate !== undefined && employee.twistingRate !== null
        ? employee.twistingRate
        : (rates.twisting || 0);

    empLogs.forEach(l => {
        const amount = parseFloat(l.amount) || 0;
        
        // Check Winding (Намотка) - Matches 'worker'
        if (l.worker && l.worker.toLowerCase() === employee.name.toLowerCase()) {
            windingKg += amount;
            // Use snapshot rate if available, otherwise current rate
            const rate = l.rateSnapshotWinding !== undefined && l.rateSnapshotWinding !== null 
                ? l.rateSnapshotWinding 
                : actualWindingRate;
            salaryPiecework += amount * rate;
        }

        // Check Twisting (Перекрутка) - Matches 'twistedWorker'
        if (l.twistedWorker && l.twistedWorker.toLowerCase() === employee.name.toLowerCase()) {
            twistingKg += amount;
            // Use snapshot rate if available, otherwise current rate
            const rate = l.rateSnapshotTwisting !== undefined && l.rateSnapshotTwisting !== null
                ? l.rateSnapshotTwisting
                : actualTwistingRate;
            salaryPiecework += amount * rate;
        }
    });

    return {
        role: 'master',
        totalHours,
        salaryHours,
        windingKg,
        twistingKg,
        salaryPiecework,
        totalSalary: salaryHours + salaryPiecework,
        actualWindingRate,
        actualTwistingRate
    };
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Сотрудники</h1>
                <p className="text-slate-500 mt-1">Табель учета рабочего времени и расчет зарплаты</p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setIsManageOpen(true)} title="Управление сотрудниками">
                    <Users className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setIsRatesOpen(true)} title="Настройки">
                    <Settings className="h-4 w-4" />
                </Button>
            </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <Button 
            onClick={() => {
              // Calculate payroll for all employees
              const payrollCalculations = employees.map(emp => {
                const stats = getStats(emp);
                
                // Check if there is a saved record for this employee in the current month's payroll
                const savedEmpData = currentMonthPayroll?.data?.find((p: any) => p.employeeId === emp.id);
                const paidAmount = savedEmpData ? (parseFloat(savedEmpData.paidAmount) || 0) : 0;
                
                return {
                  employeeId: emp.id,
                  employeeName: emp.name,
                  calculatedSalary: stats.totalSalary,
                  paidAmount: paidAmount,
                  remaining: stats.totalSalary - paidAmount
                };
              });
              setPayrollData(payrollCalculations);
              setIsPayrollOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Wallet className="h-4 w-4 mr-2" />
            Рассчитать Сотрудников
          </Button>

          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
               <Button variant="ghost" onClick={() => setSelectedMonth(d => new Date(d.setMonth(d.getMonth() - 1)))}>
                   <CalendarIcon className="h-4 w-4" />
               </Button>
               <span className="w-32 text-center font-medium">
                   {format(selectedMonth, 'LLLL yyyy', { locale: ru })}
               </span>
               <Button variant="ghost" onClick={() => setSelectedMonth(d => new Date(d.setMonth(d.getMonth() + 1)))}>
                   <CalendarIcon className="h-4 w-4" />
               </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees
            .sort((a, b) => {
                // Owner/Director first
                const aIsOwner = (a.role === 'owner' || a.role === 'director');
                const bIsOwner = (b.role === 'owner' || b.role === 'director');
                if (aIsOwner && !bIsOwner) return -1;
                if (!aIsOwner && bIsOwner) return 1;
                
                // Sales managers second
                if ((a.role === 'sales_manager') && (b.role !== 'sales_manager')) return -1;
                if ((a.role !== 'sales_manager') && (b.role === 'sales_manager')) return 1;
                // Then by name
                return a.name.localeCompare(b.name);
            })
            .map(emp => {
              const stats = getStats(emp);
              
              // Get saved payment data
              const savedEmpData = currentMonthPayroll?.data?.find((p: any) => p.employeeId === emp.id);
              const paidAmount = savedEmpData ? (parseFloat(savedEmpData.paidAmount) || 0) : 0;
              const remaining = stats.totalSalary - paidAmount;

              const rate = emp.hourlyRate || 0;
              const isManager = stats.role === 'sales_manager';
              const isOwner = stats.role === 'owner';
              
              let progress = 0;
              let progressMsg = "";
              if (isManager) {
                  const sales = stats.totalSales;
                  if (sales < 20000000) {
                      progress = (sales / 20000000) * 100;
                      progressMsg = `До 10%: ${new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(20000000 - sales)}`;
                  } else if (sales < 40000000) {
                      progress = ((sales - 20000000) / 20000000) * 100;
                      progressMsg = `До 15%: ${new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(40000000 - sales)}`;
                  } else {
                      progress = 100;
                      progressMsg = "Макс. бонус!";
                  }
              }

              return (
                  <Card 
                    key={emp.id} 
                    onClick={() => {
                        setSelectedEmpId(emp.id);
                        setIsDetailsOpen(true);
                    }}
                    className={`overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                        isManager 
                        ? 'border-blue-300 ring-1 ring-blue-100 bg-blue-50/20' 
                        : isOwner
                        ? 'border-amber-300 ring-2 ring-amber-100 bg-amber-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                      <CardHeader className={`${isManager ? 'bg-blue-50/50 border-blue-100' : isOwner ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'} pb-4 border-b`}>
                          <div className="flex justify-between items-start">
                              <div>
                                  <CardTitle className="flex items-center gap-2">
                                    {emp.name}
                                    {isManager && <Badge className="bg-blue-600 hover:bg-blue-700 h-5 px-2 text-[10px]">Manager</Badge>}
                                    {isOwner && <Badge className="bg-amber-600 hover:bg-amber-700 h-5 px-2 text-[10px]">👑 Владелец</Badge>}
                                  </CardTitle>
                                  <CardDescription className="mt-1 flex items-center gap-2">
                                      <Badge variant="outline" className="bg-white">
                                          {isManager 
                                              ? 'Менеджер продаж' 
                                              : isOwner
                                              ? 'Директор / Владелец'
                                              : (rate > 0 ? `${rate.toLocaleString()} сум/час` : 'Ставка не задана')
                                          }
                                      </Badge>
                                  </CardDescription>
                              </div>
                              <div className={`h-10 w-10 rounded-full border flex items-center justify-center font-bold text-lg ${
                                  isManager ? 'bg-blue-100 text-blue-600 border-blue-200' : isOwner ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-white text-slate-500'
                              }`}>
                                  {emp.name.charAt(0)}
                              </div>
                          </div>
                      </CardHeader>
                      <CardContent className="p-0">
                          {stats.role === 'owner' ? (
                              <div className="grid grid-cols-2 divide-x border-b">
                                  <div className="p-4 space-y-1">
                                      <span className="text-xs text-slate-500 uppercase tracking-wider">Общая касса</span>
                                      <div className="flex items-baseline gap-1">
                                          <span className="text-lg font-bold text-slate-700">
                                            {new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(stats.totalCash)}
                                          </span>
                                      </div>
                                      <div className="text-xs text-slate-500 mt-2">
                                          Все поступления
                                      </div>
                                  </div>
                                  <div className="p-4 space-y-1">
                                      <span className="text-xs text-slate-500 uppercase tracking-wider">Расчет</span>
                                      <div className="flex flex-col text-sm gap-1">
                                           <div className="flex justify-between items-center">
                                              <span className="text-slate-500">Касса:</span>
                                              <span className="font-bold">{new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(stats.totalCash)}</span>
                                           </div>
                                           <div className="flex justify-between items-center">
                                              <span className="text-slate-500">Бонус {(stats.bonusRate * 100).toFixed(0)}%:</span>
                                              <span className="font-bold text-emerald-600">{new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(stats.bonus)}</span>
                                           </div>
                                      </div>
                                  </div>
                              </div>
                          ) : stats.role === 'sales_manager' ? (
                              <div className="grid grid-cols-2 divide-x border-b">
                                  <div className="p-4 space-y-1">
                                      <span className="text-xs text-slate-500 uppercase tracking-wider">Факт. платежи</span>
                                      <div className="flex items-baseline gap-1">
                                          <span className="text-lg font-bold text-slate-700">
                                            {new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(stats.totalSales)}
                                          </span>
                                      </div>
                                      <div className="space-y-1 mt-2">
                                        <div className="flex justify-between text-[10px] text-slate-500">
                                            <span>Прогресс</span>
                                            <span>{progressMsg}</span>
                                        </div>
                                        <Progress value={progress} className="h-1.5" />
                                      </div>
                                  </div>
                                  <div className="p-4 space-y-1">
                                      <span className="text-xs text-slate-500 uppercase tracking-wider">Расчет</span>
                                      <div className="flex flex-col text-sm gap-1">
                                           <div className="flex justify-between items-center">
                                              <span className="text-slate-500">Фикс:</span>
                                              <span className="font-bold">{new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(stats.fixedSalary)}</span>
                                           </div>
                                           <div className="flex justify-between items-center">
                                              <span className="text-slate-500">Бонус {(stats.commissionRate * 100).toFixed(0)}%:</span>
                                              <span className="font-bold text-emerald-600">+{new Intl.NumberFormat('uz-UZ', { notation: "compact" }).format(stats.commission)}</span>
                                           </div>
                                      </div>
                                  </div>
                              </div>
                          ) : (
                              <div className="grid grid-cols-2 divide-x border-b">
                                  <div className="p-4 space-y-1">
                                      <span className="text-xs text-slate-500 uppercase tracking-wider">Часы</span>
                                      <div className="flex items-baseline gap-1">
                                          <span className="text-2xl font-bold text-slate-700">{stats.totalHours}</span>
                                          <span className="text-sm text-slate-400">ч</span>
                                      </div>
                                      <div className="text-xs text-emerald-600 font-medium">
                                          {stats.salaryHours.toLocaleString()} сум
                                      </div>
                                  </div>
                                  <div className="p-4 space-y-1">
                                      <span className="text-xs text-slate-500 uppercase tracking-wider">Выработка</span>
                                      <div className="flex flex-col">
                                          <div className="flex justify-between text-sm">
                                              <span>Намотка:</span>
                                              <span className="font-bold">{stats.windingKg.toLocaleString()} кг</span>
                                          </div>
                                          <div className="flex justify-between text-sm">
                                              <span>Перекрутка:</span>
                                              <span className="font-bold">{stats.twistingKg.toLocaleString()} кг</span>
                                          </div>
                                      </div>
                                      <div className="text-xs text-blue-600 font-medium mt-1">
                                          {stats.salaryPiecework.toLocaleString()} сум
                                      </div>
                                  </div>
                              </div>
                          )}
                          <div className="p-4 bg-slate-50 space-y-2">
                              {paidAmount > 0 ? (
                                <>
                                  <div className="flex justify-between items-center">
                                      <span className="font-medium text-slate-500">Начислено:</span>
                                      <span className="font-bold text-slate-700">
                                          {stats.totalSalary.toLocaleString()} сум
                                      </span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-500">Выплачено:</span>
                                      <span className="font-medium text-emerald-600">
                                          -{paidAmount.toLocaleString()} сум
                                      </span>
                                  </div>
                                  <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-2">
                                      <span className="font-bold text-slate-700">К выплате:</span>
                                      <span className={`text-xl font-bold ${remaining <= 0 ? 'text-slate-400' : 'text-emerald-600'}`}>
                                          {remaining > 0 ? remaining.toLocaleString() : "0"} сум
                                      </span>
                                  </div>
                                </>
                              ) : (
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-slate-600">Итого к выплате:</span>
                                    <span className="text-xl font-bold text-emerald-600">
                                        {stats.totalSalary.toLocaleString()} сум
                                    </span>
                                </div>
                              )}
                          </div>
                      </CardContent>
                  </Card>
              );
          })}
          
          <Card className="flex flex-col justify-center items-center p-6 border-dashed border-2 border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setIsTimesheetOpen(true)}>
              <div className="h-12 w-12 rounded-full bg-white border flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Plus className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="font-medium text-slate-900">Добавить часы</h3>
              <p className="text-sm text-slate-500 text-center mt-1">Внести запись в табель рабочего времени</p>
          </Card>
      </div>

      <Card>
          <CardHeader>
              <CardTitle>История табеля</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="whitespace-nowrap">Дата</TableHead>
                          <TableHead className="whitespace-nowrap">Сотрудник</TableHead>
                          <TableHead className="whitespace-nowrap">Часы</TableHead>
                          <TableHead className="whitespace-nowrap">Ставка (на момент)</TableHead>
                          <TableHead className="whitespace-nowrap">Сумма</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Действия</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {timesheets
                          .filter(t => isWithinInterval(parseISO(t.date), { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) }))
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map(t => {
                              const emp = employees.find(e => e.id === t.employeeId);
                              return (
                                  <TableRow key={t.id}>
                                      <TableCell className="whitespace-nowrap">{format(parseISO(t.date), 'dd.MM.yyyy')}</TableCell>
                                      <TableCell className="font-medium whitespace-nowrap">{emp?.name || 'Удален'}</TableCell>
                                      <TableCell>{t.hours}</TableCell>
                                      <TableCell>{t.rate?.toLocaleString()}</TableCell>
                                      <TableCell className="font-bold">{(t.hours * (t.rate || 0)).toLocaleString()}</TableCell>
                                      <TableCell className="text-right">
                                          <Button variant="ghost" size="icon" onClick={() => handleDeleteTimesheet(t.id)}>
                                              <Trash2 className="h-4 w-4 text-red-500" />
                                          </Button>
                                      </TableCell>
                                  </TableRow>
                              );
                          })}
                        {timesheets.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-slate-500">Нет записей за этот месяц</TableCell>
                            </TableRow>
                        )}
                  </TableBody>
              </Table>
          </CardContent>
      </Card>

      {/* Add Hours Dialog */}
      <Dialog open={isTimesheetOpen} onOpenChange={setIsTimesheetOpen}>
        <DialogContent className="max-w-[90vw] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Добавить часы</DialogTitle>
            <DialogDescription>
              Заполните форму для добавления рабочих часов сотруднику.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs md:text-sm">Сотрудник</Label>
              <Select 
                  value={newTimesheet.employeeId} 
                  onValueChange={(val) => setNewTimesheet({...newTimesheet, employeeId: val})}
              >
                  <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Выберите..." />
                  </SelectTrigger>
                  <SelectContent>
                      {employees.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs md:text-sm">Дата</Label>
              <Input 
                  type="date" 
                  className="col-span-3"
                  value={newTimesheet.date}
                  onChange={(e) => setNewTimesheet({...newTimesheet, date: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs md:text-sm">Часы</Label>
              <Input 
                  type="number" 
                  step="0.5"
                  className="col-span-3"
                  value={newTimesheet.hours}
                  onChange={(e) => setNewTimesheet({...newTimesheet, hours: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsTimesheetOpen(false)}>Отмена</Button>
            <Button className="w-full sm:w-auto" onClick={handleAddTimesheet}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              {(() => {
                  const emp = employees.find(e => e.id === selectedEmpId);
                  if (!emp) return null;

                  const stats = getStats(emp);
                  const isManager = emp.role === 'sales_manager';
                  const isOwner = emp.role === 'owner' || emp.role === 'director';
                  const start = startOfMonth(selectedMonth);
                  const end = endOfMonth(selectedMonth);

                  // Filter data for this employee and month
                  const empTimesheets = timesheets
                      .filter(t => t.employeeId === emp.id && isWithinInterval(parseISO(t.date), { start, end }))
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  
                  const empLogs = logs
                      .filter(l => {
                          const date = parseISO(l.date);
                          const isMatch = (l.worker && l.worker.toLowerCase() === emp.name.toLowerCase()) || 
                                          (l.twistedWorker && l.twistedWorker.toLowerCase() === emp.name.toLowerCase());
                          return isMatch && isWithinInterval(date, { start, end });
                      })
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                  const empDeals = deals
                      .filter(d => d.status === 'won' && isWithinInterval(parseISO(d.created_at), { start, end }))
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                  // Calculate Progress for Dialog
                  let progress = 0;
                  let progressMsg = "";
                  if (isManager) {
                      const sales = stats.totalSales;
                      if (sales < 20000000) {
                          progress = (sales / 20000000) * 100;
                          progressMsg = `Осталось ${new Intl.NumberFormat('uz-UZ').format(20000000 - sales)} до повышения ставки (10%)`;
                      } else if (sales < 40000000) {
                          progress = ((sales - 20000000) / 20000000) * 100;
                          progressMsg = `Осталось ${new Intl.NumberFormat('uz-UZ').format(40000000 - sales)} до максимальной ставки (15%)`;
                      } else {
                          progress = 100;
                          progressMsg = "Максимальный бонус достигнут!";
                      }
                  }

                  return (
                      <>
                          <DialogHeader>
                              <div className="flex justify-between items-start">
                                  <div>
                                      <DialogTitle className="text-2xl flex items-center gap-3">
                                          {emp.name}
                                          {isManager && <Badge className="bg-blue-600">Manager</Badge>}
                                          {isOwner && <Badge className="bg-amber-600">👑 Владелец</Badge>}
                                      </DialogTitle>
                                      <DialogDescription className="mt-2">
                                          Детальная статистика за {format(selectedMonth, 'LLLL yyyy', { locale: ru })}
                                      </DialogDescription>
                                  </div>
                                  <Button variant="outline" size="sm" onClick={() => { setIsDetailsOpen(false); setIsRatesOpen(true); }}>
                                      <Settings className="h-4 w-4 mr-2" />
                                      Настройки
                                  </Button>
                              </div>
                          </DialogHeader>

                          {isOwner ? (
                              <div className="space-y-6 py-4">
                                  {/* Owner Stats Section */}
                                  <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                                      <div className="flex justify-between items-center mb-2">
                                          <span className="text-sm font-medium text-amber-900">Расчет от общей кассы</span>
                                          <span className="text-sm font-bold text-amber-700">80% от кассы (касса - 20%)</span>
                                      </div>
                                      <div className="text-xs text-slate-500 mt-2">
                                          Ваша зарплата рассчитывается как 80% от общей кассы (все поступления)
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-4">
                                      <div className="bg-slate-50 p-4 rounded-lg border">
                                          <div className="text-sm text-slate-500">Общая касса</div>
                                          <div className="text-2xl font-bold">{new Intl.NumberFormat('uz-UZ').format(stats.totalCash)} сум</div>
                                          <div className="text-xs text-slate-400 mt-1">Все поступления</div>
                                      </div>
                                      <div className="bg-slate-50 p-4 rounded-lg border">
                                          <div className="text-sm text-slate-500">Процент</div>
                                          <div className="text-2xl font-bold text-amber-600">{(stats.bonusRate * 100).toFixed(0)}%</div>
                                          <div className="text-xs text-slate-400 mt-1">Ставка владельца</div>
                                      </div>
                                      <div className="bg-slate-50 p-4 rounded-lg border">
                                          <div className="text-sm text-slate-500">Итого к выплате</div>
                                          <div className="text-2xl font-bold text-emerald-600">{new Intl.NumberFormat('uz-UZ').format(stats.totalSalary)} сум</div>
                                          <div className="text-xs text-slate-400 mt-1">Ваш бонус</div>
                                      </div>
                                  </div>

                                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                      <h4 className="font-semibold text-sm mb-2">ℹ️ Формула расчета</h4>
                                      <div className="text-sm text-slate-700 space-y-1">
                                          <p>• Общая касса: {new Intl.NumberFormat('uz-UZ').format(stats.totalCash)} сум</p>
                                          <p>• Процент владельца: {(stats.bonusRate * 100).toFixed(0)}%</p>
                                          <p className="font-bold text-emerald-700">• Итого: {new Intl.NumberFormat('uz-UZ').format(stats.totalCash)} × {(stats.bonusRate * 100).toFixed(0)}% = {new Intl.NumberFormat('uz-UZ').format(stats.bonus)} сум</p>
                                      </div>
                                  </div>
                              </div>
                          ) : isManager ? (
                              <div className="space-y-6 py-4">
                                  {/* Progress Bar Section */}
                                  <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                      <div className="flex justify-between items-center mb-2">
                                          <span className="text-sm font-medium text-blue-900">Прогресс продаж</span>
                                          <span className="text-sm font-bold text-blue-700">{progressMsg}</span>
                                      </div>
                                      <Progress value={progress} className="h-3 bg-blue-100" />
                                      <div className="flex justify-between mt-1 text-xs text-slate-400">
                                          <span>0</span>
                                          <span>20 млн</span>
                                          <span>40 млн+</span>
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-4">
                                      <div className="bg-slate-50 p-4 rounded-lg border">
                                          <div className="text-sm text-slate-500">Фактические платежи</div>
                                          <div className="text-2xl font-bold">{new Intl.NumberFormat('uz-UZ').format(stats.totalSales)} сум</div>
                                          <div className="text-xs text-slate-400 mt-1">{stats.dealsCount} сделок</div>
                                      </div>
                                      <div className="bg-slate-50 p-4 rounded-lg border">
                                          <div className="text-sm text-slate-500">Бонус</div>
                                          <div className="text-2xl font-bold text-emerald-600">+{new Intl.NumberFormat('uz-UZ').format(stats.commission)} сум</div>
                                          <div className="text-xs text-slate-400 mt-1">{(stats.commissionRate * 100).toFixed(0)}% от платежей</div>
                                      </div>
                                      <div className="bg-slate-50 p-4 rounded-lg border">
                                          <div className="text-sm text-slate-500">Итого к выплате</div>
                                          <div className="text-2xl font-bold text-blue-600">{new Intl.NumberFormat('uz-UZ').format(stats.totalSalary)} сум</div>
                                          <div className="text-xs text-slate-400 mt-1">Оклад + Бонус</div>
                                      </div>
                                  </div>

                                  {/* Info Message about calculation logic */}
                                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                      <div className="flex items-start gap-2">
                                          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                          <div className="text-sm text-blue-800">
                                              <p className="font-semibold mb-1">💡 Расчет бонуса</p>
                                              <p className="text-xs leading-relaxed">
                                                  Бонус менеджера рассчитывается от <strong>фактически полученных платежей</strong> (payments), а не от ожидаемой суммы сделок. Учитываются только платежи по закрытым сделкам (won) в текущем месяце.
                                              </p>
                                          </div>
                                      </div>
                                  </div>

                                  <div>
                                      <h3 className="text-lg font-medium mb-4">История продаж (Won)</h3>
                                      <div className="border rounded-md">
                                          <Table>
                                              <TableHeader>
                                                  <TableRow>
                                                      <TableHead>Дата</TableHead>
                                                      <TableHead>Сумма сделки</TableHead>
                                                      <TableHead className="text-right">Комиссия (расчетная)</TableHead>
                                                  </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                  {empDeals.length > 0 ? empDeals.map(deal => (
                                                      <TableRow key={deal.id}>
                                                          <TableCell>{format(parseISO(deal.created_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                                                          <TableCell className="font-medium">{new Intl.NumberFormat('uz-UZ').format(deal.amount)} сум</TableCell>
                                                          <TableCell className="text-right text-slate-500">
                                                              ~{new Intl.NumberFormat('uz-UZ').format(deal.amount * stats.commissionRate)}
                                                          </TableCell>
                                                      </TableRow>
                                                  )) : (
                                                      <TableRow>
                                                          <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                                                              Нет успешных сделок за этот месяц
                                                          </TableCell>
                                                      </TableRow>
                                                  )}
                                              </TableBody>
                                          </Table>
                                      </div>
                                  </div>
                              </div>
                          ) : (
                              <Tabs defaultValue="production" className="w-full">
                                  <TabsList className="grid w-full grid-cols-2">
                                      <TabsTrigger value="production">Производство</TabsTrigger>
                                      <TabsTrigger value="timesheet">Табель часов</TabsTrigger>
                                  </TabsList>
                                  
                                  <TabsContent value="production" className="space-y-4 pt-4">
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="bg-slate-50 p-4 rounded-lg border">
                                              <div className="text-sm text-slate-500">Всего выработка</div>
                                              <div className="text-2xl font-bold text-blue-600">{stats.salaryPiecework.toLocaleString()} сум</div>
                                          </div>
                                          <div className="bg-slate-50 p-4 rounded-lg border">
                                              <div className="text-sm text-slate-500">Объем</div>
                                              <div className="flex gap-4 mt-1">
                                                  <div>
                                                      <span className="text-xs text-slate-400 block">Намотка</span>
                                                      <span className="font-bold">{stats.windingKg.toLocaleString()} кг</span>
                                                  </div>
                                                  <div>
                                                      <span className="text-xs text-slate-400 block">Перекрутка</span>
                                                      <span className="font-bold">{stats.twistingKg.toLocaleString()} кг</span>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>

                                      <div className="border rounded-md">
                                          <Table>
                                              <TableHeader>
                                                  <TableRow>
                                                      <TableHead>Дата</TableHead>
                                                      <TableHead>Тип работы</TableHead>
                                                      <TableHead>Количество</TableHead>
                                                      <TableHead>Тариф</TableHead>
                                                      <TableHead className="text-right">Сумма</TableHead>
                                                  </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                  {empLogs.length > 0 ? empLogs.map(log => {
                                                      const isWinding = log.worker && log.worker.toLowerCase() === emp.name.toLowerCase();
                                                      const amount = parseFloat(log.amount) || 0;
                                                      const rate = isWinding ? stats.actualWindingRate : stats.actualTwistingRate;
                                                      const sum = amount * rate;

                                                      return (
                                                          <TableRow key={log.id}>
                                                              <TableCell>{format(parseISO(log.date), 'dd.MM.yyyy')}</TableCell>
                                                              <TableCell>
                                                                  <Badge variant="secondary" className={isWinding ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}>
                                                                      {isWinding ? 'Намотка' : 'Перекрутка'}
                                                                  </Badge>
                                                              </TableCell>
                                                              <TableCell>{amount} кг</TableCell>
                                                              <TableCell>{rate} сум/кг</TableCell>
                                                              <TableCell className="text-right font-medium">{sum.toLocaleString()} сум</TableCell>
                                                          </TableRow>
                                                      );
                                                  }) : (
                                                      <TableRow>
                                                          <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                                              Нет записей производства за этот месяц
                                                          </TableCell>
                                                      </TableRow>
                                                  )}
                                              </TableBody>
                                          </Table>
                                      </div>
                                  </TabsContent>

                                  <TabsContent value="timesheet" className="space-y-4 pt-4">
                                      <div className="bg-slate-50 p-4 rounded-lg border">
                                          <div className="flex justify-between items-center">
                                              <div>
                                                  <div className="text-sm text-slate-500">Оплата по часам</div>
                                                  <div className="text-2xl font-bold text-blue-600">{stats.salaryHours.toLocaleString()} сум</div>
                                              </div>
                                              <div className="text-right">
                                                  <div className="text-sm text-slate-500">Всего часов</div>
                                                  <div className="text-2xl font-bold">{stats.totalHours} ч</div>
                                              </div>
                                          </div>
                                      </div>

                                      <div className="border rounded-md">
                                          <Table>
                                              <TableHeader>
                                                  <TableRow>
                                                      <TableHead>Дата</TableHead>
                                                      <TableHead>Часы</TableHead>
                                                      <TableHead>Ставка</TableHead>
                                                      <TableHead className="text-right">Сумма</TableHead>
                                                  </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                  {empTimesheets.length > 0 ? empTimesheets.map(t => (
                                                      <TableRow key={t.id}>
                                                          <TableCell>{format(parseISO(t.date), 'dd.MM.yyyy')}</TableCell>
                                                          <TableCell>{t.hours}</TableCell>
                                                          <TableCell>{t.rate?.toLocaleString()}</TableCell>
                                                          <TableCell className="text-right font-medium">{(t.hours * (t.rate || 0)).toLocaleString()}</TableCell>
                                                      </TableRow>
                                                  )) : (
                                                      <TableRow>
                                                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                                              Нет записей в табеле за этот месяц
                                                          </TableCell>
                                                      </TableRow>
                                                  )}
                                              </TableBody>
                                          </Table>
                                      </div>
                                  </TabsContent>
                              </Tabs>
                          )}
                          <DialogFooter>
                              <Button onClick={() => setIsDetailsOpen(false)}>Закрыть</Button>
                          </DialogFooter>
                      </>
                  );
              })()}
          </DialogContent>
      </Dialog>

      {/* Settings Dialog - Employee Management Only */}
      <Dialog open={isRatesOpen} onOpenChange={setIsRatesOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Управление сотрудниками</DialogTitle>
            <DialogDescription>
              Редактирование ставок и условий работы персонала.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
               <div className="flex items-center gap-4">
                   <Label className="w-1/4 text-right">Сотрудник:</Label>
                   <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                      <SelectTrigger className="w-3/4">
                          <SelectValue placeholder="Выберите сотрудника..." />
                      </SelectTrigger>
                      <SelectContent>
                          {employees.map(e => (
                              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                          ))}
                      </SelectContent>
                   </Select>
               </div>

               {selectedEmpId && (
                   <div className="border rounded-lg p-4 space-y-4 bg-slate-50 animate-in fade-in zoom-in-95 duration-200">
                       <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">Имя</Label>
                          <Input 
                              className="col-span-3"
                              value={personalSettings.name}
                              onChange={(e) => setPersonalSettings({...personalSettings, name: e.target.value})}
                          />
                       </div>

                       <div className="grid grid-cols-4 items-center gap-4">
                           <Label className="text-right">Роль</Label>
                           <Select value={personalSettings.role} onValueChange={(val) => setPersonalSettings({...personalSettings, role: val})}>
                               <SelectTrigger className="col-span-3">
                                   <SelectValue />
                               </SelectTrigger>
                               <SelectContent>
                                   <SelectItem value="owner">👑 Владелец / Директор</SelectItem>
                                   <SelectItem value="director">👑 Владелец / Директор</SelectItem>
                                   <SelectItem value="sales_manager">Менеджер по продажам</SelectItem>
                                   <SelectItem value="master">Мастер (Производство)</SelectItem>
                               </SelectContent>
                           </Select>
                       </div>

                       {personalSettings.role === 'owner' || personalSettings.role === 'director' ? (
                           <div className="space-y-4 border-t pt-4">
                               <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                                   <h4 className="font-bold text-sm mb-2 text-amber-900">👑 Расчет зарплаты владельца</h4>
                                   <div className="text-sm text-amber-800 space-y-2">
                                       <p>Ваша зарплата рассчитывается автоматически:</p>
                                       <p className="font-bold">Бонус = Общая касса × 80%</p>
                                       <p className="text-xs text-amber-700 mt-2">
                                           • Общая касса = все поступления (payments)<br/>
                                           • Процент фиксированный: 80% (касса - 20%)<br/>
                                           • Расчет происходит автоматически
                                       </p>
                                   </div>
                               </div>
                           </div>
                       ) : personalSettings.role === 'sales_manager' ? (
                           <div className="space-y-4 border-t pt-4">
                               <div className="grid grid-cols-4 items-center gap-4">
                                  <Label className="text-right">Оклад (Fix)</Label>
                                  <Input 
                                      type="number"
                                      className="col-span-3"
                                      value={personalSettings.fixedSalary}
                                      onChange={(e) => setPersonalSettings({...personalSettings, fixedSalary: e.target.value})}
                                  />
                               </div>
                               <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 space-y-1">
                                   <p className="font-bold">Схема расчета бонусов:</p>
                                   <p>• Продажи &lt; 20 млн: 5%</p>
                                   <p>• 20 млн - 40 млн: 10%</p>
                                   <p>• &gt; 40 млн: 15%</p>
                               </div>
                           </div>
                       ) : (
                           <>
                               <div className="grid grid-cols-4 items-center gap-4">
                                  <Label className="text-right">Почасовая (сум/час)</Label>
                                  <Input 
                                      type="number"
                                      className="col-span-3"
                                      value={personalSettings.hourlyRate}
                                      onChange={(e) => setPersonalSettings({...personalSettings, hourlyRate: e.target.value})}
                                  />
                               </div>
                               
                               <div className="border-t pt-4 mt-4">
                                   <h4 className="font-medium mb-3 text-sm text-slate-700">Персональные тарифы</h4>
                                   <div className="grid gap-4">
                                       <div className="grid grid-cols-4 items-center gap-4">
                                          <Label className="text-right">Намотка</Label>
                                          <Input 
                                              type="number"
                                              className="col-span-3"
                                              placeholder={`По умолчанию: ${rates.winding}`}
                                              value={personalSettings.windingRate}
                                              onChange={(e) => setPersonalSettings({...personalSettings, windingRate: e.target.value})}
                                          />
                                       </div>
                                       <div className="grid grid-cols-4 items-center gap-4">
                                          <Label className="text-right">Перекрутка</Label>
                                          <Input 
                                              type="number"
                                              className="col-span-3"
                                              placeholder={`По умолчанию: ${rates.twisting}`}
                                              value={personalSettings.twistingRate}
                                              onChange={(e) => setPersonalSettings({...personalSettings, twistingRate: e.target.value})}
                                          />
                                       </div>
                                   </div>
                                   <p className="text-xs text-slate-400 mt-2 text-right">
                                       * Оставьте пустым, чтобы использовать базовый тариф
                                   </p>
                               </div>
                           </>
                       )}

                       <div className="flex justify-end pt-2">
                          <Button onClick={handleSavePersonalSettings}>Сохранить изменения</Button>
                       </div>
                   </div>
               )}
               
               {!selectedEmpId && (
                   <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg bg-slate-50/50">
                       <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                       <p>Выберите сотрудника из списка выше,<br/>чтобы настроить его условия</p>
                   </div>
               )}
           </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRatesOpen(false)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmployeesDialog open={isManageOpen} onOpenChange={setIsManageOpen} onUpdate={fetchData} />

      {/* Payroll Dialog - Calculate and Pay Employees */}
      <Dialog open={isPayrollOpen} onOpenChange={setIsPayrollOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
              Расчет зарплаты - {format(selectedMonth, 'LLLL yyyy', { locale: ru })}
            </DialogTitle>
            <DialogDescription className="flex justify-between items-center">
              <span>Введите фактически выданные суммы для каждого сотрудника</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const newData = payrollData.map(item => ({
                    ...item,
                    paidAmount: item.calculatedSalary,
                    remaining: 0
                  }));
                  setPayrollData(newData);
                }}
              >
                Заполнить всё
              </Button>
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-[30%]">Сотрудник</TableHead>
                  <TableHead className="text-right">К выплате</TableHead>
                  <TableHead className="w-[25%]">Выдано</TableHead>
                  <TableHead className="text-right">Остаток</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData.map((item, index) => {
                  const paidAmount = parseFloat(item.paidAmount as any) || 0;
                  const remaining = item.calculatedSalary - paidAmount;
                  
                  return (
                    <TableRow key={item.employeeId} className={remaining < 0 ? 'bg-red-50' : remaining === 0 ? 'bg-emerald-50' : ''}>
                      <TableCell className="font-medium">{item.employeeName}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600">
                        {item.calculatedSalary.toLocaleString()} сум
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0"
                          value={item.paidAmount || ''}
                          onChange={(e) => {
                            const newData = [...payrollData];
                            newData[index].paidAmount = parseFloat(e.target.value) || 0;
                            newData[index].remaining = newData[index].calculatedSalary - (parseFloat(e.target.value) || 0);
                            setPayrollData(newData);
                          }}
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold ${
                          remaining > 0 ? 'text-orange-600' : 
                          remaining < 0 ? 'text-red-600' : 
                          'text-emerald-600'
                        }`}>
                          {remaining.toLocaleString()} сум
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {payrollData.length > 0 && (
              <div className="mt-6 p-4 bg-slate-100 rounded-lg border">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-slate-500">Всего к выплате</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {payrollData.reduce((sum, item) => sum + item.calculatedSalary, 0).toLocaleString()} сум
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-500">Выдано</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {payrollData.reduce((sum, item) => sum + (parseFloat(item.paidAmount as any) || 0), 0).toLocaleString()} сум
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-500">Остаток</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {payrollData.reduce((sum, item) => {
                        const paid = parseFloat(item.paidAmount as any) || 0;
                        return sum + (item.calculatedSalary - paid);
                      }, 0).toLocaleString()} сум
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row mt-4">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsPayrollOpen(false)}>
              Отмена
            </Button>
            <Button 
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
              onClick={async () => {
                try {
                  // Save payroll data to backend
                  const response = await fetch(`${crmUrl('/payroll')}`, {
                    method: 'POST',
                    headers: { ...authHeaders() },
                    body: JSON.stringify({
                      month: format(selectedMonth, 'yyyy-MM'),
                      payrollData: payrollData.map(item => ({
                        employeeId: item.employeeId,
                        employeeName: item.employeeName,
                        calculatedSalary: item.calculatedSalary,
                        paidAmount: parseFloat(item.paidAmount as any) || 0,
                        remaining: item.calculatedSalary - (parseFloat(item.paidAmount as any) || 0)
                      }))
                    })
                  });

                  if (!response.ok) throw new Error('Failed to save payroll');

                  toast.success('Расчет зарплаты сохранен');
                  setIsPayrollOpen(false);
                  setPayrollData([]);
                  fetchData(); // Refresh data to update payments history
                } catch (e) {
                  console.error(e);
                  toast.error('Ошибка сохранения расчета');
                }
              }}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Сохранить ра��чет
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}