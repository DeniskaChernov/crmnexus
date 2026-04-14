import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar, X, Filter, Search } from 'lucide-react';
import { Badge } from '../ui/badge';

export interface WarehouseFilters {
  dateFrom: string;
  dateTo: string;
  warehouses: string[];
  movementTypes: string[];
  searchQuery: string;
  articles: string[];
}

interface WarehouseFiltersProps {
  filters: WarehouseFilters;
  onFiltersChange: (filters: WarehouseFilters) => void;
  onReset: () => void;
  availableWarehouses: string[];
  availableArticles: string[];
}

const MOVEMENT_TYPES = [
  { value: 'production', label: 'Производство', color: 'bg-green-100 text-green-700' },
  { value: 'shipment', label: 'Отгрузка', color: 'bg-red-100 text-red-700' },
  { value: 'transfer', label: 'Перемещение', color: 'bg-blue-100 text-blue-700' },
  { value: 'correction', label: 'Корректировка', color: 'bg-orange-100 text-orange-700' }
];

export const WarehouseFiltersComponent = ({
  filters,
  onFiltersChange,
  onReset,
  availableWarehouses,
  availableArticles
}: WarehouseFiltersProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const hasActiveFilters = 
    filters.dateFrom || 
    filters.dateTo || 
    filters.warehouses.length > 0 || 
    filters.movementTypes.length > 0 ||
    filters.searchQuery ||
    filters.articles.length > 0;

  const toggleWarehouse = (warehouse: string) => {
    const newWarehouses = filters.warehouses.includes(warehouse)
      ? filters.warehouses.filter(w => w !== warehouse)
      : [...filters.warehouses, warehouse];
    onFiltersChange({ ...filters, warehouses: newWarehouses });
  };

  const toggleMovementType = (type: string) => {
    const newTypes = filters.movementTypes.includes(type)
      ? filters.movementTypes.filter(t => t !== type)
      : [...filters.movementTypes, type];
    onFiltersChange({ ...filters, movementTypes: newTypes });
  };

  const toggleArticle = (article: string) => {
    const newArticles = filters.articles.includes(article)
      ? filters.articles.filter(a => a !== article)
      : [...filters.articles, article];
    onFiltersChange({ ...filters, articles: newArticles });
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-slate-50 to-white border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-slate-600" />
          <h3 className="font-bold text-slate-800">Фильтры</h3>
          {hasActiveFilters && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              Активно
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onReset}
              className="h-8 gap-1 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              Сбросить
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 text-xs"
          >
            {isExpanded ? 'Свернуть' : 'Развернуть'}
          </Button>
        </div>
      </div>

      {/* Быстрый поиск - всегда видимый */}
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Поиск по артикулу, заметке, сотруднику..."
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
            className="pl-9 h-10"
          />
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Даты */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Дата от
              </Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Дата до
              </Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                className="h-9"
              />
            </div>
          </div>

          {/* Быстрый выбор периода */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                onFiltersChange({
                  ...filters,
                  dateFrom: firstDay.toISOString().split('T')[0],
                  dateTo: today.toISOString().split('T')[0]
                });
              }}
              className="h-7 text-xs"
            >
              Текущий месяц
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                onFiltersChange({
                  ...filters,
                  dateFrom: lastMonth.toISOString().split('T')[0],
                  dateTo: lastMonthEnd.toISOString().split('T')[0]
                });
              }}
              className="h-7 text-xs"
            >
              Прошлый месяц
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
                onFiltersChange({
                  ...filters,
                  dateFrom: threeMonthsAgo.toISOString().split('T')[0],
                  dateTo: today.toISOString().split('T')[0]
                });
              }}
              className="h-7 text-xs"
            >
              Последние 3 месяца
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);
                onFiltersChange({
                  ...filters,
                  dateFrom: sixMonthsAgo.toISOString().split('T')[0],
                  dateTo: today.toISOString().split('T')[0]
                });
              }}
              className="h-7 text-xs"
            >
              Последние 6 месяцев
            </Button>
          </div>

          {/* Склады */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-600">Склады</Label>
            <div className="flex flex-wrap gap-2">
              {availableWarehouses.map(warehouse => (
                <Button
                  key={warehouse}
                  variant={filters.warehouses.includes(warehouse) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleWarehouse(warehouse)}
                  className="h-8 text-xs"
                >
                  {warehouse}
                </Button>
              ))}
            </div>
          </div>

          {/* Типы движений */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-600">Типы движений</Label>
            <div className="flex flex-wrap gap-2">
              {MOVEMENT_TYPES.map(type => (
                <Button
                  key={type.value}
                  variant={filters.movementTypes.includes(type.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleMovementType(type.value)}
                  className="h-8 text-xs"
                >
                  {type.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Артикулы - с поиском для большого количества */}
          {availableArticles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-600">
                Артикулы ({filters.articles.length > 0 ? `${filters.articles.length} выбрано` : 'все'})
              </Label>
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-white">
                <div className="flex flex-wrap gap-1.5">
                  {availableArticles.slice(0, 20).map(article => (
                    <Badge
                      key={article}
                      variant={filters.articles.includes(article) ? "default" : "outline"}
                      className="cursor-pointer hover:scale-105 transition-transform text-xs py-1 px-2"
                      onClick={() => toggleArticle(article)}
                    >
                      {article}
                    </Badge>
                  ))}
                  {availableArticles.length > 20 && (
                    <Badge variant="secondary" className="text-xs">
                      +{availableArticles.length - 20} еще
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Активные фильтры - сводка */}
          {hasActiveFilters && (
            <div className="pt-3 border-t border-slate-200">
              <div className="text-xs text-slate-600 font-semibold mb-2">Активные фильтры:</div>
              <div className="flex flex-wrap gap-2">
                {filters.dateFrom && (
                  <Badge variant="secondary" className="text-xs">
                    От: {new Date(filters.dateFrom).toLocaleDateString('ru-RU')}
                  </Badge>
                )}
                {filters.dateTo && (
                  <Badge variant="secondary" className="text-xs">
                    До: {new Date(filters.dateTo).toLocaleDateString('ru-RU')}
                  </Badge>
                )}
                {filters.warehouses.map(w => (
                  <Badge key={w} variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                    {w}
                  </Badge>
                ))}
                {filters.movementTypes.map(t => {
                  const type = MOVEMENT_TYPES.find(mt => mt.value === t);
                  return (
                    <Badge key={t} className={`text-xs ${type?.color}`}>
                      {type?.label}
                    </Badge>
                  );
                })}
                {filters.articles.slice(0, 3).map(a => (
                  <Badge key={a} variant="secondary" className="text-xs">
                    {a}
                  </Badge>
                ))}
                {filters.articles.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{filters.articles.length - 3} артикулов
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
