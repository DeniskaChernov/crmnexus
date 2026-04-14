import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Trash2, Plus, Package, Factory } from 'lucide-react';
import { ProductSelect } from './ProductSelect';

export interface DealItem {
  article: string;
  quantity: number | string;
  price: number | string;
  warehouse: 'AIKO' | 'BTT';
  type?: 'stock' | 'production';
}

interface DealItemsEditorProps {
  items: DealItem[];
  onChange: (items: DealItem[]) => void;
  readOnly?: boolean;
  productType?: string;
}

export function DealItemsEditor({ items, onChange, readOnly, productType }: DealItemsEditorProps) {
  const cleanAmount = (val: any) => {
    if (!val) return 0;
    const str = String(val).replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const addItem = () => {
    onChange([...items, { article: '', quantity: 1, price: 0, warehouse: 'AIKO', type: 'stock' }]);
  };

  const updateItem = (index: number, field: keyof DealItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex justify-between items-center">
        <Label className="text-base font-medium">Товары сделки</Label>
        {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Добавить товар
            </Button>
        )}
      </div>
      
      {items.length === 0 ? (
        <div className="text-center p-4 border border-dashed rounded-md text-sm text-muted-foreground bg-slate-50">
            Нет добавленных товаров. Нажмите "Добавить товар", чтобы указать позиции.
        </div>
      ) : (
        <div className="space-y-2">
            {items.map((item, index) => {
                const isRattan = (item.article || '').toLowerCase().includes('ротанг');
                const isProduction = item.type === 'production';
                
                return (
                <div key={index} className="grid grid-cols-12 gap-2 items-end border p-3 rounded-md bg-white shadow-sm">
                     <div className="col-span-3">
                        <Label className="text-xs mb-1 block text-slate-500">Артикул</Label>
                        <ProductSelect 
                            value={item.article} 
                            onChange={(val) => updateItem(index, 'article', val)}
                            disabled={readOnly}
                            className="h-8"
                            productType={productType}
                        />
                     </div>
                     <div className="col-span-2">
                        <Label className="text-xs mb-1 block text-slate-500">Источник</Label>
                        <Select 
                            value={item.type || 'stock'} 
                            onValueChange={(v: any) => updateItem(index, 'type', v)}
                            disabled={readOnly}
                        >
                            <SelectTrigger className={`h-8 ${isProduction ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-blue-700 bg-blue-50 border-blue-200'}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="stock">
                                    <div className="flex items-center">
                                        <Package className="w-3 h-3 mr-2" /> Со склада
                                    </div>
                                </SelectItem>
                                <SelectItem value="production">
                                    <div className="flex items-center">
                                        <Factory className="w-3 h-3 mr-2" /> На заказ
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                     </div>
                     <div className="col-span-2">
                        <Label className="text-xs mb-1 block text-slate-500">
                            {isRattan ? 'Вес (кг)' : 'Кол-во'}
                        </Label>
                        <Input 
                            type="number"
                            step="any"
                            value={item.quantity} 
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            disabled={readOnly}
                            className="h-8"
                            min="0"
                        />
                     </div>
                     <div className="col-span-2">
                        <Label className="text-xs mb-1 block text-slate-500">Склад</Label>
                        <Select 
                            value={item.warehouse} 
                            onValueChange={(v: any) => updateItem(index, 'warehouse', v)}
                            disabled={readOnly}
                        >
                            <SelectTrigger className="h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AIKO">AIKO</SelectItem>
                                <SelectItem value="BTT">BTT</SelectItem>
                            </SelectContent>
                        </Select>
                     </div>
                     <div className="col-span-2">
                        <Label className="text-xs mb-1 block text-slate-500">Цена (шт/кг)</Label>
                        <Input 
                            type="number"
                            step="any"
                            value={item.price} 
                            onChange={(e) => updateItem(index, 'price', e.target.value)}
                            disabled={readOnly}
                             className="h-8"
                             min="0"
                        />
                     </div>
                     <div className="col-span-1 flex justify-end">
                        {!readOnly && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                     </div>
                </div>
            )})}
             <div className="flex justify-end items-center gap-2 text-sm font-medium text-slate-700 px-2 pt-2">
                <span>Итого по товарам:</span>
                <span className="text-lg text-blue-600">
                    {new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', minimumFractionDigits: 0 }).format(
                        items.reduce((sum, i) => sum + (cleanAmount(i.quantity) * cleanAmount(i.price)), 0)
                    )}
                </span>
             </div>
        </div>
      )}
    </div>
  );
}
