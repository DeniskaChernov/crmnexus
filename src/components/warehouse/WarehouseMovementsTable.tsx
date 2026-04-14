import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ArrowUpCircle, ArrowDownCircle, Truck, RefreshCcw, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Movement {
  id: string;
  type: 'production' | 'shipment' | 'transfer' | 'correction';
  subType?: 'in' | 'out';
  date: string;
  warehouse: string;
  article: string;
  amount: number;
  unit: string;
  note?: string;
  worker?: string;
  twistedWorker?: string;
  materialType?: string;
  stickerClient?: string;
  dealId?: string;
  transferTo?: string;
  transferFrom?: string;
  systemAmount?: number;
  realAmount?: number;
  image?: string;
  user?: string;
  bags?: number;
}

interface WarehouseMovementsTableProps {
  movements: Movement[];
  loading?: boolean;
}

const MOVEMENT_TYPE_CONFIG = {
  production: {
    label: 'Производство',
    icon: ArrowUpCircle,
    color: 'bg-green-100 text-green-700 border-green-200',
    iconColor: 'text-green-600'
  },
  shipment: {
    label: 'Отгрузка',
    icon: ArrowDownCircle,
    color: 'bg-red-100 text-red-700 border-red-200',
    iconColor: 'text-red-600'
  },
  transfer: {
    label: 'Перемещение',
    icon: Truck,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600'
  },
  correction: {
    label: 'Корректировка',
    icon: RefreshCcw,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    iconColor: 'text-orange-600'
  }
};

export const WarehouseMovementsTable = ({ movements, loading = false }: WarehouseMovementsTableProps) => {
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 50;

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const exportToCSV = () => {
    const headers = ['Дата', 'Тип', 'Склад', 'Артикул', 'Количество', 'Единица', 'Заметка'];
    const rows = movements.map(m => [
      new Date(m.date).toLocaleString('ru-RU'),
      MOVEMENT_TYPE_CONFIG[m.type].label,
      m.warehouse,
      m.article,
      m.amount.toFixed(2),
      m.unit,
      m.note || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `warehouse-movements-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-500 mx-auto mb-3"></div>
            <p className="text-sm text-slate-500">Загрузка движений...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (movements.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-slate-500">
            <ArrowUpCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">Движения не найдены</p>
            <p className="text-xs text-slate-400 mt-1">Попробуйте изменить фильтры</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(movements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMovements = movements.slice(startIndex, endIndex);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-800">
            История движений ({movements.length.toLocaleString()})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="h-8 gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Экспорт CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="w-[140px]">Дата</TableHead>
                <TableHead className="w-[140px]">Тип</TableHead>
                <TableHead className="w-[100px]">Склад</TableHead>
                <TableHead>Артикул</TableHead>
                <TableHead className="text-right w-[120px]">Количество</TableHead>
                <TableHead className="w-[200px]">Заметка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {currentMovements.map((movement) => {
                  const config = MOVEMENT_TYPE_CONFIG[movement.type];
                  const Icon = config.icon;
                  const isExpanded = expandedRows.has(movement.id);

                  return (
                    <React.Fragment key={movement.id}>
                      <TableRow 
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => toggleRow(movement.id)}
                      >
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          {new Date(movement.date).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs font-semibold ${config.color}`}>
                            <Icon className={`h-3 w-3 mr-1 ${config.iconColor}`} />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {movement.warehouse}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {movement.article || 'Без артикула'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold text-sm ${
                            movement.amount > 0 ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {movement.amount > 0 ? '+' : ''}{movement.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs text-slate-500 ml-1">{movement.unit}</span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 truncate max-w-[200px]">
                          {movement.note || '-'}
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded details */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-slate-50">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="p-4 space-y-2"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                {movement.type === 'production' && (
                                  <>
                                    {movement.bags && (
                                        <div>
                                            <span className="text-slate-500">Мешков:</span>
                                            <span className="ml-2 font-medium">{movement.bags} шт</span>
                                        </div>
                                    )}
                                    {movement.materialType && (
                                      <div>
                                        <span className="text-slate-500">Тип материала:</span>
                                        <span className="ml-2 font-medium">{movement.materialType}</span>
                                      </div>
                                    )}
                                    {movement.worker && (
                                      <div>
                                        <span className="text-slate-500">Сотрудник:</span>
                                        <span className="ml-2 font-medium">{movement.worker}</span>
                                      </div>
                                    )}
                                    {movement.twistedWorker && (
                                      <div>
                                        <span className="text-slate-500">Крутильщик:</span>
                                        <span className="ml-2 font-medium">{movement.twistedWorker}</span>
                                      </div>
                                    )}
                                    {movement.user && (
                                      <div>
                                        <span className="text-slate-500">Добавил:</span>
                                        <span className="ml-2 font-medium">{movement.user}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                                
                                {movement.type === 'shipment' && (
                                  <>
                                    {movement.stickerClient && (
                                      <div>
                                        <span className="text-slate-500">Клиент:</span>
                                        <span className="ml-2 font-medium">{movement.stickerClient}</span>
                                      </div>
                                    )}
                                    {movement.dealId && (
                                      <div>
                                        <span className="text-slate-500">ID сделки:</span>
                                        <span className="ml-2 font-medium">{movement.dealId}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                                
                                {movement.type === 'transfer' && (
                                  <>
                                    <div>
                                      <span className="text-slate-500">Откуда:</span>
                                      <Badge variant="secondary" className="ml-2">
                                        {movement.transferFrom}
                                      </Badge>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Куда:</span>
                                      <Badge variant="secondary" className="ml-2">
                                        {movement.transferTo}
                                      </Badge>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Направление:</span>
                                      <Badge 
                                        variant="outline" 
                                        className={`ml-2 ${movement.subType === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                                      >
                                        {movement.subType === 'in' ? 'Приход' : 'Расход'}
                                      </Badge>
                                    </div>
                                  </>
                                )}
                                
                                {movement.type === 'correction' && (
                                  <>
                                    {movement.systemAmount !== undefined && (
                                      <div>
                                        <span className="text-slate-500">Было в системе:</span>
                                        <span className="ml-2 font-medium">{movement.systemAmount.toLocaleString()} {movement.unit}</span>
                                      </div>
                                    )}
                                    {movement.realAmount !== undefined && (
                                      <div>
                                        <span className="text-slate-500">Фактически:</span>
                                        <span className="ml-2 font-medium">{movement.realAmount.toLocaleString()} {movement.unit}</span>
                                      </div>
                                    )}
                                    {movement.image && (
                                      <div>
                                        <span className="text-slate-500">Фото:</span>
                                        <a 
                                          href={movement.image} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="ml-2 text-blue-600 hover:underline"
                                        >
                                          Открыть
                                        </a>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              
                              {movement.note && (
                                <div className="pt-2 border-t border-slate-200">
                                  <span className="text-slate-500 text-xs">Полная заметка:</span>
                                  <p className="mt-1 text-sm text-slate-700">{movement.note}</p>
                                </div>
                              )}
                            </motion.div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
            <div className="text-sm text-slate-600">
              Показаны {startIndex + 1}-{Math.min(endIndex, movements.length)} из {movements.length.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Назад
              </Button>
              <div className="text-sm font-medium text-slate-700">
                {currentPage} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Вперед
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
