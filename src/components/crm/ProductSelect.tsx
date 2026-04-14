import React, { useEffect, useState, useMemo } from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '../ui/utils';
import { Input } from '../ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
interface ProductSelectProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
    productType?: string;
}

export function ProductSelect({ value, onChange, className, disabled, productType }: ProductSelectProps) {
    const [open, setOpen] = useState(false);
    const [products, setProducts] = useState<{name: string, stock: number}[]>([]);
    const [loading, setLoading] = useState(false);
    
    // We don't need separate search state, we use 'value' prop directly for filtering

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${crmUrl('/warehouse/inventory')}`, {
                headers: { ...authHeaders(false) }
            });
            if (res.ok) {
                const data = await res.json();
                // Aggregate
                const map: Record<string, number> = {};
                
                ['AIKO', 'BTT'].forEach(wh => {
                    const byArt = data[wh]?.current?.byArticle || {};
                    Object.entries(byArt).forEach(([art, qty]) => {
                        const name = art as string;
                        map[name] = (map[name] || 0) + (qty as number);
                    });
                });

                const list = Object.entries(map).map(([name, stock]) => ({
                    name, 
                    stock: Math.round(stock * 100) / 100 // Round to 2 decimals
                })).sort((a, b) => a.name.localeCompare(b.name));
                
                setProducts(list);
            }
        } catch (e) {
            console.error("Failed to fetch inventory", e);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = useMemo(() => {
        if (!value) return [];
        return products
            .filter(p => p.name.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 50);
    }, [products, value]);

    return (
        <Popover open={open && filteredProducts.length > 0} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative">
                    <Input
                        value={value}
                        onChange={(e) => {
                            onChange(e.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        placeholder="Артикул или название"
                        className={cn("pr-8", className)}
                        disabled={disabled}
                        autoComplete="off"
                    />
                    <ChevronsUpDown className="absolute right-2 top-2.5 h-4 w-4 opacity-50 pointer-events-none" />
                </div>
            </PopoverTrigger>
            <PopoverContent 
                className="w-[300px] p-0 max-h-[200px] overflow-y-auto" 
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="p-1">
                    {filteredProducts.map((product) => (
                        <div
                            key={product.name}
                            className={cn(
                                "flex items-center justify-between px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-slate-100 transition-colors",
                                value === product.name && "bg-slate-100 font-medium"
                            )}
                            onClick={() => {
                                onChange(product.name);
                                setOpen(false);
                            }}
                        >
                            <span className="truncate mr-2">{product.name}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {product.stock} {
                                    (productType === 'Искусственный ротанг' || product.name.toLowerCase().includes('ротанг')) 
                                    ? 'кг' 
                                    : 'шт'
                                }
                            </span>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
