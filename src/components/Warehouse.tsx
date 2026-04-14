import React, { useEffect, useState, useRef } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Package, RefreshCw, Database, Info, FileSpreadsheet, Plus, ArrowUpCircle, ArrowDownCircle, Boxes, Pencil, Trash2, Settings, RefreshCcw, Printer, Truck, X, Search, Clock, ChevronDown, ChevronUp, Maximize2, Minimize2, Archive, Upload, Camera, AlertCircle, Grid, List, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner@2.0.3';
import { crm } from "@/lib/crmClient.ts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from './ui/dialog';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { EmployeesDialog } from './EmployeesDialog';
import { useIsMobile } from './ui/use-mobile';
import { ImageUploadZone } from './WarehouseImproved';
import { WarehouseFiltersComponent, WarehouseFilters } from './warehouse/WarehouseFilters';
import { WarehouseMonthlyStats } from './warehouse/WarehouseMonthlyStats';
import { WarehouseMovementsTable } from './warehouse/WarehouseMovementsTable';

interface ShipmentItem {
  id: string;
  article: string;
  weight: number;
  coils?: number; // Number of coils/packs
  date: string;
  stickerArticle?: string; // Optional custom article for sticker printing
  bags?: number;
}

interface Shipment {
  id: string;
  date: string;
  note: string;
  destination?: string; // Destination route
  status: 'draft' | 'completed';
  items: ShipmentItem[];
  stickerClient?: string;
  warehouse?: string;
  dealId?: string;
  totalBags?: number; // Total number of bags for the shipment
}

interface ProductionLog {
  id: string;
  date: string;
  user: string;
  amount: number;
  unit: string;
  status: 'pending_sync' | 'synced';
  originalMessage: string;
  article?: string;
  warehouse?: string;
  materialType?: string;
  worker?: string;
  twistedWorker?: string;
  bags?: number;
}

interface WarehouseStats {
  produced: { total: number; byArticle: Record<string, number> };
  sold: { total: number; byArticle: Record<string, number> };
  current: { total: number; byArticle: Record<string, number> };
}

interface InventoryStats {
  [key: string]: WarehouseStats;
}

interface Employee {
  id: string;
  name: string;
  active: boolean;
}

const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, backoff = 500) => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok && (res.status >= 500 || res.status === 429)) {
         throw new Error(`Server error: ${res.status}`);
      }
      return res;
    } catch (err) {
      console.warn(`Fetch attempt ${i + 1} failed for ${url}:`, err);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, backoff * (i + 1)));
    }
  }
  throw new Error("Failed after retries");
};

interface StockCardProps {
  title: string;
  items: {art: string, qty: number}[];
  icon: React.ReactNode;
  warehouseName: string;
  onEdit: (art: string, qty: number) => void;
  onClear: (art: string, warehouse: string, qty: number) => void;
  getUnit: (mat?: string, art?: string) => string;
  isExpandedMode: boolean;
  isCompactMode: boolean;
  onToggleExpandMode: () => void;
  recipeImages?: Record<string, string>; // Map of article -> image URL
}

const StockCard = ({ title, items, icon, warehouseName, onEdit, onClear, getUnit, isExpandedMode, isCompactMode, onToggleExpandMode, recipeImages = {} }: StockCardProps) => {
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid'); // Default to grid view
  
  useEffect(() => {
    if (isExpandedMode) setIsListExpanded(true);
    else if (isCompactMode) setIsListExpanded(false);
  }, [isExpandedMode, isCompactMode]);

  const filteredItems = items.filter(i => Math.abs(i.qty) >= 0.01).sort((a, b) => b.qty - a.qty);
  const limit = isExpandedMode ? 100 : 5;
  const visibleItems = isListExpanded ? filteredItems : filteredItems.slice(0, limit);

  return (
    <Card className={`flex flex-col h-full border-slate-200 shadow-sm transition-all duration-500 ${isExpandedMode ? 'shadow-md border-blue-200 ring-1 ring-blue-100' : 'hover:shadow-md'}`}>
        <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-3">
                <div className={`p-2.5 bg-slate-100 rounded-xl text-slate-600 transition-all ${isCompactMode ? 'scale-75' : ''}`}>
                     {icon}
                </div>
                {!isCompactMode && (
                    <motion.span initial={{opacity: 0}} animate={{opacity: 1}} className="whitespace-nowrap">
                        {title}
                    </motion.span>
                )}
                
                <div className="ml-auto flex items-center gap-2">
                    {!isCompactMode && (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap">
                            {filteredItems.reduce((acc, i) => acc + i.qty, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} {title.includes('Кашпо') ? 'шт' : 'кг'}
                        </Badge>
                    )}
                    {isCompactMode && (
                         <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-slate-700">
                                {filteredItems.reduce((acc, i) => acc + i.qty, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                         </div>
                    )}
                    
                    {!isCompactMode && !isExpandedMode && (
                      <Button 
                        variant={viewMode === 'grid' ? 'default' : 'outline'}
                        size="sm" 
                        className="h-8 gap-1.5 text-xs font-semibold"
                        onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                      >
                        {viewMode === 'grid' ? (
                          <>
                            <Grid className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Карточки</span>
                          </>
                        ) : (
                          <>
                            <List className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Список</span>
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={onToggleExpandMode}>
                        {isExpandedMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                </div>
            </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 px-5 pb-5 overflow-hidden">
            {isCompactMode ? (
                <div className="flex flex-col gap-2 opacity-50">
                    {filteredItems.slice(0, 3).map(item => (
                        <div key={item.art} className="flex justify-between text-xs">
                             <span className="truncate max-w-[80px]">{item.art}</span>
                             <span className="font-bold">{Math.round(item.qty)}</span>
                        </div>
                    ))}
                    {filteredItems.length > 3 && <div className="text-xs text-center">...</div>}
                </div>
            ) : (
                <>
                <div className="space-y-1">
                    {filteredItems.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-sm text-slate-400">Нет товаров</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        // Grid View with Images - Enhanced
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                        <AnimatePresence initial={false}>
                        {visibleItems.map(({ art, qty }) => {
                          const imageUrl = recipeImages[art];
                          const isLowStock = qty < 10 && qty > 0;
                          const isOutOfStock = qty <= 0;
                          
                          return (
                            <motion.div 
                                key={art} 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                                className="group relative bg-white border-2 border-slate-200 rounded-xl overflow-hidden hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer active:scale-95"
                                onClick={() => onEdit(art, qty)}
                            >
                                {/* Status Badges */}
                                <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                                    {!imageUrl && (
                                        <Badge variant="outline" className="bg-white/95 backdrop-blur-sm text-xs shadow-sm">
                                            Без фото
                                        </Badge>
                                    )}
                                    {isOutOfStock && (
                                        <Badge variant="destructive" className="text-xs font-semibold shadow-sm">
                                            Нет в наличии
                                        </Badge>
                                    )}
                                    {isLowStock && !isOutOfStock && (
                                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs font-semibold shadow-sm">
                                            Мало
                                        </Badge>
                                    )}
                                </div>
                                
                                {/* Image */}
                                <div className="w-full h-40 sm:h-48 bg-gradient-to-br from-slate-100 to-slate-50 relative overflow-hidden">
                                   {imageUrl ? (
                                     <>
                                       <img 
                                         src={imageUrl} 
                                         alt={art}
                                         className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                       />
                                       <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                     </>
                                   ) : (
                                     <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
                                       <div className="bg-slate-200 rounded-full p-4 group-hover:scale-110 transition-transform">
                                         <Package className="h-8 w-8 sm:h-10 sm:w-10 text-slate-400" />
                                       </div>
                                       <p className="text-xs sm:text-sm text-slate-500 text-center font-medium">
                                         Нажмите для<br/>добавления фото
                                       </p>
                                     </div>
                                   )}
                                   
                                   {/* Action Buttons Overlay - Desktop Only */}
                                   <div className="hidden sm:flex absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1.5">
                                       <Button 
                                           variant="ghost" 
                                           size="icon" 
                                           className="h-8 w-8 bg-white/95 backdrop-blur-sm text-blue-600 hover:bg-white hover:text-blue-700 shadow-lg" 
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             onEdit(art, qty);
                                           }}
                                       >
                                           <Pencil className="h-4 w-4" />
                                       </Button>
                                       <Button 
                                           variant="ghost" 
                                           size="icon" 
                                           className="h-8 w-8 bg-white/95 backdrop-blur-sm text-red-500 hover:bg-white hover:text-red-600 shadow-lg" 
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             onClear(art, warehouseName, qty);
                                           }}
                                       >
                                           <Trash2 className="h-4 w-4" />
                                       </Button>
                                   </div>
                                </div>
                                
                                {/* Info */}
                                <div className="p-3 sm:p-4 space-y-2">
                                    <h4 className="font-bold text-sm sm:text-base text-slate-800 truncate" title={art}>{art}</h4>
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className={`text-2xl sm:text-3xl font-bold leading-none ${
                                                qty < 0 ? 'text-red-600' : 
                                                isLowStock ? 'text-orange-600' : 
                                                'text-emerald-600'
                                            }`}>
                                                {parseFloat(qty.toFixed(2)).toLocaleString()}
                                            </span>
                                            <span className="text-xs text-slate-500 uppercase font-semibold mt-1">
                                                {getUnit(undefined, art)}
                                            </span>
                                        </div>
                                        
                                        {/* Mobile Action Buttons - Always Visible */}
                                        <div className="flex sm:hidden gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg" 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onEdit(art, qty);
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg" 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onClear(art, warehouseName, qty);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                          );
                        })}
                        </AnimatePresence>
                        </div>
                    ) : (
                        // List View - Enhanced
                        <div className="space-y-2">
                        <AnimatePresence initial={false}>
                        {visibleItems.map(({ art, qty }) => {
                          const imageUrl = recipeImages[art];
                          const isLowStock = qty < 10 && qty > 0;
                          
                          return (
                            <motion.div 
                                key={art} 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="group flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all cursor-pointer active:scale-98"
                                onClick={() => onEdit(art, qty)}
                            >
                                {/* Thumbnail */}
                                <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
                                    {imageUrl ? (
                                        <img src={imageUrl} alt={art} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="h-5 w-5 text-slate-400" />
                                        </div>
                                    )}
                                </div>
                                
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm sm:text-base text-slate-800 truncate">{art}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-lg sm:text-xl font-bold ${
                                            qty < 0 ? 'text-red-600' : isLowStock ? 'text-orange-600' : 'text-emerald-600'
                                        }`}>
                                            {parseFloat(qty.toFixed(2)).toLocaleString()}
                                        </span>
                                        <span className="text-xs text-slate-500 uppercase font-semibold">
                                            {getUnit(undefined, art)}
                                        </span>
                                        {isLowStock && (
                                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs ml-1">
                                                Мало
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Actions - Desktop hover, Mobile always visible */}
                                <div className="flex sm:opacity-0 sm:group-hover:opacity-100 transition-opacity gap-1 flex-shrink-0">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(art, qty);
                                        }}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClear(art, warehouseName, qty);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </motion.div>
                          );
                        })}
                        </AnimatePresence>
                        </div>
                    )}
                </div>
                {filteredItems.length > 5 && !isExpandedMode && (
                    <Button 
                        variant="ghost" 
                        className="w-full mt-4 text-xs text-slate-500 hover:text-slate-900 uppercase tracking-wider font-semibold" 
                        onClick={() => setIsListExpanded(!isListExpanded)}
                    >
                        {isListExpanded ? (
                            <div className="flex items-center gap-2 justify-center"><ChevronUp className="h-3 w-3" /> Свернуть</div>
                        ) : (
                            <div className="flex items-center gap-2 justify-center"><ChevronDown className="h-3 w-3" /> Показать все ({filteredItems.length})</div>
                        )}
                    </Button>
                )}
                </>
            )}
        </CardContent>
    </Card>
  );
};

const StatCard = ({ title, total, unit, subtitle, icon, colorScheme, isExpanded, isCompact, onToggleExpand, breakdown }: {
    title: string, total: number, unit: string, subtitle: string, icon: React.ReactNode, 
    colorScheme: 'green' | 'blue' | 'orange', isExpanded: boolean, isCompact: boolean, onToggleExpand: () => void,
    breakdown?: Record<string, number>
}) => {
    const colors = {
        green: { border: 'border-green-100', bg: 'bg-green-500/20', icon: 'text-green-600', text: 'text-green-600' },
        blue: { border: 'border-blue-100', bg: 'bg-blue-500/20', icon: 'text-blue-600', text: 'text-blue-600' },
        orange: { border: 'border-orange-100', bg: 'bg-orange-500/20', icon: 'text-orange-600', text: 'text-orange-600' }
    }[colorScheme];

    // Calculate separate totals for materials (kg) and planters (шт)
    let materialsTotal = 0;
    let plantersTotal = 0;
    
    if (breakdown) {
        Object.entries(breakdown).forEach(([art, qty]) => {
            if (art.toLowerCase().includes('кашпо')) {
                plantersTotal += qty;
            } else {
                materialsTotal += qty;
            }
        });
    }
    
    const hasMixedUnits = materialsTotal > 0 && plantersTotal > 0;

    return (
        <Card className={`h-full bg-white shadow-sm relative overflow-hidden transition-all duration-500 border ${colors.border} flex-1`}>
            <div className={`absolute right-0 top-0 h-full w-1 ${colors.bg}`} />
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {React.cloneElement(icon as React.ReactElement, { className: `h-4 w-4 ${colors.icon}` })}
                        {title}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {hasMixedUnits ? (
                    <div className="space-y-2">
                        <div>
                            <div className="text-xs text-slate-500 font-medium mb-0.5">Искусственный ротанг</div>
                            <div className="font-bold text-slate-900 text-2xl">
                                {materialsTotal.toLocaleString()} <span className="text-base font-normal text-slate-400">кг</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 font-medium mb-0.5">Ка��п���</div>
                            <div className="font-bold text-slate-700 text-xl">
                                {plantersTotal.toLocaleString()} <span className="text-sm font-normal text-slate-400">шт</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="font-bold text-slate-900 text-3xl">
                        {total.toLocaleString()} <span className="text-lg font-normal text-slate-400">{unit}</span>
                    </div>
                )}
                <p className={`text-xs mt-1 font-medium ${colors.text}`}>{subtitle}</p>
            </CardContent>
        </Card>
    );
};

export default function Warehouse() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedStat, setExpandedStat] = useState<string | null>(null);
  const [expandedBottom, setExpandedBottom] = useState<string | null>(null);
  const [expandedShipmentsLog, setExpandedShipmentsLog] = useState(false);
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [integrations, setIntegrations] = useState({ google: false });
  const [activeTab, setActiveTab] = useState("AIKO");
  const [recipeImages, setRecipeImages] = useState<Record<string, string>>({});
  const [isFetching, setIsFetching] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEmployeesOpen, setIsEmployeesOpen] = useState(false);
  const [isShipmentOpen, setIsShipmentOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [currentShipment, setCurrentShipment] = useState<Shipment | null>(null);
  const [transferForm, setTransferForm] = useState({
    fromWarehouse: 'AIKO',
    toWarehouse: 'BTT',
    article: '',
    quantity: '',
    note: ''
  });
  const [transfers, setTransfers] = useState<any[]>([]);
  
  // New state for filters and analytics
  const [filters, setFilters] = useState<WarehouseFilters>({
    dateFrom: '',
    dateTo: '',
    warehouses: [],
    movementTypes: [],
    searchQuery: '',
    articles: []
  });
  const [movements, setMovements] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [availableArticles, setAvailableArticles] = useState<string[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [loadingMonthlyStats, setLoadingMonthlyStats] = useState(false);
  
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [newLog, setNewLog] = useState({ 
      amount: '', 
      article: '', 
      note: '', 
      warehouse: 'AIKO',
      materialType: 'Искусственный ротанг',
      worker: '',
      twistedWorker: '',
      planterType: '',
      bags: '',
      date: new Date().toISOString().slice(0, 16) 
  });
  const [savingManual, setSavingManual] = useState(false);
  const [isManualArticleInput, setIsManualArticleInput] = useState(false);

  // Correction State
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [correctionData, setCorrectionData] = useState({ article: '', warehouse: '', current: 0, real: '', image: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingCorrection, setSavingCorrection] = useState(false);
  
  // Stock History State
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchIntegrationStatus = async () => {
    try {
      const response = await fetchWithRetry(`${crmUrl('/integrations/status')}`, {
        headers: { ...authHeaders(false) }
      });
      if (response.ok) {
        const data = await response.json();
        setIntegrations(data);
      }
    } catch (e) {
      console.warn("Failed to check integrations (Server might be sleeping or unreachable)", e);
    }
  };

  const fetchRecipes = async () => {
    try {
      const response = await fetchWithRetry(`${crmUrl('/recipes')}`, {
        headers: { ...authHeaders(false) }
      });
      if (response.ok) {
        const recipes = await response.json();
        // Create a map of article name -> image URL
        const imageMap: Record<string, string> = {};
        recipes.forEach((recipe: any) => {
          if (recipe.name && recipe.image) {
            imageMap[recipe.name] = recipe.image;
          }
        });
        setRecipeImages(imageMap);
      }
    } catch (e) {
      console.warn("Failed to fetch recipes", e);
      // Mock data
      setRecipeImages({
        'Ротанг С8': 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5a?w=800',
        'Кашпо 16л': 'https://images.unsplash.com/photo-1596525178657-65778a876a3e?w=800'
      });
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetchWithRetry(`${crmUrl('/employees')}`, {
        headers: { ...authHeaders(false) }
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.sort((a: Employee, b: Employee) => a.name.localeCompare(b.name)));
      }
    } catch (e) {
      console.warn("Failed to fetch employees", e);
      setEmployees([
        { id: '1', name: 'Алексей', active: true },
        { id: '2', name: 'Мария', active: true },
      ]);
    }
  };

  const fetchShipments = async () => {
    try {
      const res = await fetchWithRetry(`${crmUrl('/shipments')}`, {
        headers: { ...authHeaders(false) }
      });
      if (res.ok) {
        const data = await res.json();
        setShipments(data);
      }
    } catch (e) {
      console.warn("Failed to fetch shipments", e);
      setShipments([]);
    }
  };

  const fetchTransfers = async () => {
    try {
      const res = await fetchWithRetry(`${crmUrl('/transfers')}`, {
        headers: { ...authHeaders(false) }
      });
      if (res.ok) {
        const data = await res.json();
        setTransfers(data);
      }
    } catch (e) {
      console.warn("Failed to fetch transfers", e);
      setTransfers([]);
    }
  };

  const fetchData = async () => {
    // Prevent concurrent fetches
    if (isFetching) {
      console.log('Fetch already in progress, skipping...');
      return;
    }
    
    try {
      setIsFetching(true);
      setLoading(true);

      // Define fetchers for logs and stats to run in parallel
      const fetchLogsPromise = async () => {
        try {
          const responseLogs = await fetchWithRetry(`${crmUrl('/production-logs')}`, {
            headers: { ...authHeaders(false) }
          });
          if (responseLogs.ok) {
            setLogs(await responseLogs.json());
          }
        } catch (e) { 
            console.warn("Failed logs", e);
            setLogs([
                 { id: 'm1', date: new Date().toISOString(), user: 'Demo', amount: 50, unit: 'кг', status: 'synced', originalMessage: 'Демо запись', article: 'Ротанг С8', warehouse: 'AIKO', materialType: 'Искусственный ротанг' }
            ]);
        }
      };

      const fetchStatsPromise = async () => {
        try {
          const responseStats = await fetchWithRetry(`${crmUrl('/warehouse/inventory')}`, {
            headers: { ...authHeaders(false) }
          });
          if (responseStats.ok) {
            setStats(await responseStats.json());
          } else {
            console.warn(`Stats fetch failed with status: ${responseStats.status}`);
            setStats({
                 'AIKO': { produced: { total: 1000, byArticle: {'Ротанг С8': 1000} }, sold: { total: 500, byArticle: {'Ротанг С8': 500} }, current: { total: 500, byArticle: {'Ротанг С8': 500} } },
                 'BTT': { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} }, current: { total: 0, byArticle: {} } },
                 'Bizly': { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} }, current: { total: 0, byArticle: {} } }
            });
          }
        } catch (e: any) { 
            console.warn("Failed to fetch stats:", e.message || e); 
            setStats({
                 'AIKO': { produced: { total: 1000, byArticle: {'Ротанг С8': 1000} }, sold: { total: 500, byArticle: {'Ротанг С8': 500} }, current: { total: 500, byArticle: {'Ротанг С8': 500} } },
                 'BTT': { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} }, current: { total: 0, byArticle: {} } },
                 'Bizly': { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} }, current: { total: 0, byArticle: {} } }
            });
        }
      };
      
      // Execute ALL fetches in parallel
      await Promise.allSettled([
        fetchIntegrationStatus(),
        fetchEmployees(),
        fetchShipments(),
        fetchTransfers(),
        fetchLogsPromise(),
        fetchStatsPromise(),
        fetchRecipes()
      ]);
      
    } catch (error: any) {
      console.error(error);
      toast.warning('Демо режим (сервер недоступен)');
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  // Fetch available articles for filters
  const fetchAvailableArticles = async () => {
    try {
      const response = await fetch(
        `${crmUrl('/warehouse/available-articles')}`,
        { headers: { ...authHeaders(false) } }
      );
      if (response.ok) {
        const articles = await response.json();
        setAvailableArticles(articles);
      }
    } catch (error) {
      console.warn('Error fetching available articles:', error);
      setAvailableArticles(['Ротанг С8', 'Кашпо 16л', 'Кашпо 10л']);
    }
  };

  // Fetch warehouse movements with filters
  const fetchMovements = async () => {
    try {
      setLoadingMovements(true);
      const params = new URLSearchParams();
      
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.warehouses.length > 0) params.append('warehouses', filters.warehouses.join(','));
      if (filters.movementTypes.length > 0) params.append('movementTypes', filters.movementTypes.join(','));
      if (filters.searchQuery) params.append('searchQuery', filters.searchQuery);
      if (filters.articles.length > 0) params.append('articles', filters.articles.join(','));

      const response = await fetch(
        `${crmUrl("/warehouse/movements")}?${params.toString()}`,
        { headers: { ...authHeaders(false) } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMovements(data);
      }
    } catch (error) {
      console.warn('Error fetching movements:', error);
      setMovements([
          { id: 'm1', date: new Date().toISOString(), type: 'production', article: 'Ротанг С8', amount: 50, warehouse: 'AIKO', user: 'Demo' }
      ]);
    } finally {
      setLoadingMovements(false);
    }
  };

  // Fetch monthly statistics
  const fetchMonthlyStats = async () => {
    try {
      setLoadingMonthlyStats(true);
      const params = new URLSearchParams();
      
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      
      // Pass selected warehouses as multiple query parameters
      if (filters.warehouses.length > 0) {
        filters.warehouses.forEach(wh => params.append('warehouses', wh));
      }

      const response = await fetch(
        `${crmUrl("/warehouse/monthly-stats")}?${params.toString()}`,
        { headers: { ...authHeaders(false) } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMonthlyStats(data);
      }
    } catch (error) {
      console.warn('Error fetching monthly stats:', error);
      setMonthlyStats([
          { month: '2023-10', produced: 1000, sold: 800 },
          { month: '2023-11', produced: 1200, sold: 900 },
      ]);
    } finally {
      setLoadingMonthlyStats(false);
    }
  };

  const handleFiltersChange = (newFilters: WarehouseFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      warehouses: [],
      movementTypes: [],
      searchQuery: '',
      articles: []
    });
  };

  // Refresh movements when filters change
  useEffect(() => {
    if (activeTab === 'Analytics') {
      fetchMovements();
      fetchMonthlyStats();
    }
  }, [filters, activeTab]);

  // Fetch available articles on mount
  useEffect(() => {
    fetchAvailableArticles();
  }, []);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    fetchData();
    
    // Debounce timer for realtime updates
    let debounceTimer: NodeJS.Timeout | null = null;
    
    const handleRealtimeUpdate = () => {
      if (!isMounted.current) return;
      console.log('Realtime update received');
      
      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // Set new timer - only fetch after 1 second of no updates
      debounceTimer = setTimeout(() => {
        if (isMounted.current) {
          fetchData();
        }
      }, 1000);
    };

    // Realtime subscription
    const channel = crm
      .channel('warehouse_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kv_store_f9553289' },
        handleRealtimeUpdate
      )
      .subscribe();

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      crm.removeChannel(channel);
    };
  }, []);

  const openAddDialog = () => {
      setEditingLogId(null);
      setNewLog({ 
        amount: '', 
        article: '', 
        note: '', 
        warehouse: activeTab, 
        materialType: 'Искусственный ротанг',
        worker: '',
        twistedWorker: '',
        planterType: '',
        date: new Date().toISOString().slice(0, 16) 
      });
      setIsManualArticleInput(false);
      setIsAddOpen(true);
  };

  const openEditDialog = (log: ProductionLog) => {
      setEditingLogId(log.id);
      
      let pType = '';
      let art = log.article || '';
      
      // Try to extract Planter Type for editing
      if (log.materialType === 'Кашпо') {
          const types = [
            "Кашпо 16л Пухляш",
            "Кашпо 16л Классика",
            "Кашпо 10л Пух��яш",
            "Кашпо 10л Классика",
            "Кашпо 5л с ручкой",
            "Кашпо 5л прямые"
          ];
          for (const t of types) {
              if (art.startsWith(t)) {
                  pType = t;
                  art = art.slice(t.length).trim();
                  break;
              }
          }
      }

      setNewLog({
          amount: log.amount.toString(),
          article: art,
          note: log.originalMessage || '',
          warehouse: log.warehouse || 'AIKO',
          materialType: log.materialType || 'Искусственный ротанг',
          worker: log.worker || '',
          twistedWorker: log.twistedWorker || '',
          planterType: pType,
          bags: log.bags ? log.bags.toString() : '',
          date: new Date(log.date).toISOString().slice(0, 16)
      });
      setIsManualArticleInput(false);
      setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
      if (!window.confirm("Вы уверены, что хотите удалить эту запись? Это действие нельзя отменить.")) return;
      
      try {
          const response = await fetch(`${crmUrl(`/production-logs/${id}`)}`, {
              method: 'DELETE',
              headers: { ...authHeaders(false) }
          });

          if (response.ok) {
              toast.success("Запись удалена");
              // Realtime will handle the refresh automatically
          } else {
              throw new Error("Failed to delete");
          }
      } catch (e) {
          console.error(e);
          toast.error("Ошибка при удалении");
      }
  };

  const getUnit = (materialType?: string, article?: string) => {
      if (materialType === 'Кашпо') return 'шт';
      if (article && article.toLowerCase().includes('кашпо')) return 'шт';
      return 'кг';
  };

  const handleManualAdd = async () => {
    const cleanAmount = (val: string) => {
        if (!val) return 0;
        const str = String(val).replace(/\s/g, '').replace(',', '.');
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    };

    const amount = cleanAmount(newLog.amount);
    if (amount <= 0) {
        toast.error("Введите корректное количество");
        return;
    }

    try {
        setSavingManual(true);
        const url = editingLogId 
            ? `${crmUrl(`/production-logs/${editingLogId}`)}`
            : `${crmUrl('/production-logs')}`;
            
        const method = editingLogId ? 'PUT' : 'POST';

        const finalArticle = (newLog.materialType === 'Кашпо' && newLog.planterType)
            ? `${newLog.planterType} ${newLog.article}`.trim()
            : newLog.article;

        const unit = getUnit(newLog.materialType, finalArticle);

        const response = await fetch(url, {
            method: method,
            headers: { ...authHeaders() },
            body: JSON.stringify({
                amount: amount,
                unit: unit,
                article: finalArticle,
                note: newLog.note,
                warehouse: newLog.warehouse,
                materialType: newLog.materialType,
                worker: newLog.worker,
                twistedWorker: newLog.materialType === 'Крученый ротанг' ? newLog.twistedWorker : '',
                bags: newLog.bags ? parseInt(newLog.bags) : undefined,
                /*
                twistedWorker: newLog.materialType === 'Крученый ротанг' ? newLog.twistedWorker : '',
                */
                date: new Date(newLog.date).toISOString()
            })
        });


        if (!response.ok) throw new Error("Failed to save log");

        toast.success(editingLogId ? "Запись обновлена" : `Запись добавлена в склад ${newLog.warehouse}`);
        setIsAddOpen(false);
        setEditingLogId(null);
        // Realtime will handle the refresh automatically

    } catch (e) {
        console.error(e);
        toast.error("Ошибка при сохранении");
    } finally {
        setSavingManual(false);
    }
  };

  const fetchStockHistory = async (article: string, warehouse: string) => {
    if (!article) return;
    
    try {
      setLoadingHistory(true);
      const response = await fetch(
        `${crmUrl(`/stock-history/${encodeURIComponent(article)}`)}?warehouse=${encodeURIComponent(warehouse)}`,
        { headers: { ...authHeaders(false) } }
      );
      
      if (response.ok) {
        const history = await response.json();
        setStockHistory(history);
      } else {
        setStockHistory([]);
      }
    } catch (error) {
      console.warn('Error fetching stock history:', error);
      setStockHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleImageUploadForArticle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Файл слишком большой (макс. 5MB)');
      return;
    }

    try {
      setUploadingImage(true);
      const uploadData = new FormData();
      uploadData.append('file', file);

      const response = await fetch(
        `${crmUrl('/upload')}`,
        {
          method: 'POST',
          headers: { ...authHeaders(false) },
          body: uploadData
        }
      );

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      
      setCorrectionData(prev => ({ ...prev, image: data.url }));
      toast.success('Фото загружено');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Ошибка загрузки фото');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveCorrection = async () => {
    // Check if at least something changed
    const realVal = correctionData.real ? parseFloat(correctionData.real.replace(',', '.')) : correctionData.current;
    const diff = realVal - correctionData.current;
    const hasImageChange = correctionData.image && correctionData.image !== recipeImages[correctionData.article];
    
    if (!hasImageChange && Math.abs(diff) < 0.001) {
        toast.info("Нет изменений");
        setIsCorrectionOpen(false);
        return;
    }
    
    setSavingCorrection(true);
    
    try {
        // Save image to recipe if provided or changed
        if (hasImageChange) {
            await fetch(`${crmUrl('/recipes')}`, {
                method: 'POST',
                headers: { ...authHeaders() },
                body: JSON.stringify({
                    name: correctionData.article,
                    image: correctionData.image
                })
            });
            
            // Update local recipe images
            setRecipeImages(prev => ({
                ...prev,
                [correctionData.article]: correctionData.image
            }));
        }

        // Only create correction log if amount changed
        if (Math.abs(diff) >= 0.001) {
            if (!confirm(`Вы уверенны, что хотите изменить остаток с ${correctionData.current} на ${realVal}? Будет создана корректирующая запись на ${diff.toFixed(2)} ${getUnit(undefined, correctionData.article)}.`)) return;

            const response = await fetch(`${crmUrl('/production-logs')}`, {
                method: 'POST',
                headers: { ...authHeaders() },
                body: JSON.stringify({
                    amount: diff,
                    unit: getUnit(undefined, correctionData.article),
                    article: correctionData.article,
                    note: "Корректировка остатков (Инвентаризация)",
                    warehouse: correctionData.warehouse,
                    materialType: "Корректировка",
                    date: new Date().toISOString()
                })
            });

            if (!response.ok) throw new Error("Failed to correct stock");
        }

        if (hasImageChange && Math.abs(diff) >= 0.001) {
            toast.success("Фото и остатки обновлены");
        } else if (hasImageChange) {
            toast.success("Фото добавлено");
        } else {
            toast.success("Остатки скорректированы");
        }
        
        setIsCorrectionOpen(false);
        // Realtime will handle the refresh automatically
    } catch (e) {
        console.error(e);
        toast.error("Ошибка при корректировке");
    } finally {
        setSavingCorrection(false);
    }
  };

  const handleClearStock = async (article: string, warehouse: string, current: number) => {
      if (current === 0) return;
      if (!confirm(`Обнулить остаток для "${article}"? Э��о создаст запись спи��ания на ${current} ${getUnit(undefined, article)}.`)) return;
      
      try {
        const response = await fetch(`${crmUrl('/production-logs')}`, {
            method: 'POST',
            headers: { ...authHeaders() },
            body: JSON.stringify({
                amount: -current, // Subtract current to get to 0
                article: article,
                unit: getUnit(undefined, article),
                note: "Полное списание (Обнуление)",
                warehouse: warehouse,
                materialType: "Списание",
                date: new Date().toISOString()
            })
        });

        if (!response.ok) throw new Error("Failed to clear stock");

        toast.success("Остаток обнулен");
        // Realtime will handle the refresh automatically
    } catch (e) {
        console.error(e);
        toast.error("Ошибка при обнулении");
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch(`${crmUrl('/sync-google-sheets')}`, {
        method: 'POST',
        headers: { ...authHeaders() }
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Sync failed');
      }
      
      toast.success(`Синхронизация успешна! Обновлено записей: ${result.synced || 0}`);
      // Realtime will handle the refresh automatically
    } catch (error) {
      console.error(error);
      toast.error('Не удалось синхронизировать с Google Sheets');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisableGoogleSync = async () => {
    if (!confirm("Вы уверены, что хотите отключить интеграцию с Google Sheets?")) return;
    try {
        const response = await fetch(`${crmUrl('/integrations/google')}`, {
          method: 'DELETE',
          headers: { ...authHeaders(false) }
        });

        if (response.ok) {
            toast.success("Интеграция отключена");
            setIntegrations(prev => ({ ...prev, google: false }));
        } else {
            throw new Error("Failed to disable");
        }
    } catch (e) {
        console.error(e);
        toast.error("Ошибка при отключении");
    }
  };

  const handleInventoryReset = async () => {
    if (!confirm("ВНИМАНИЕ: Вы собираетесь провести инвентаризацию.\n\nЭто действие:\n1. Сохранит текущие остатки в архив.\n2. ОБНУЛИТ все товары на складах.\n3. Скачает Excel файл с остатками ДО обнуления.\n\nПродолжить?")) return;

    try {
        setLoading(true);
        const response = await fetchWithRetry(`${crmUrl('/warehouse/inventory/reset')}`, {
             method: 'POST',
             headers: { ...authHeaders(false) }
        });

        if (response.ok) {
            const data = await response.json();
            
            // Download CSV
            const items = data.snapshot || [];
            if (items.length > 0) {
                 const header = "Склад,Артикул,Количество,Дата\n";
                 const rows = items.map((item: any) => 
                     `"${item.warehouse}","${item.article}",${item.quantity},"${new Date(item.date).toLocaleDateString()}"`
                 ).join("\n");
                 const csvContent = header + rows;
                 
                 const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                 const url = URL.createObjectURL(blob);
                 const link = document.createElement("a");
                 link.href = url;
                 link.download = `inventory_archive_${new Date().toISOString().slice(0,10)}.csv`;
                 document.body.appendChild(link);
                 link.click();
                 document.body.removeChild(link);
                 URL.revokeObjectURL(url);
            }

            toast.success("Инвентаризация завершена. Склад обнулен.");
            // Realtime will handle the refresh automatically
        } else {
            throw new Error("Failed to reset inventory");
        }
    } catch (e) {
        console.error(e);
        toast.error("Ошибка при инвентаризации");
    } finally {
        setLoading(false);
    }
  };

  // --- Shipments Logic ---

  const handleOpenShipment = () => {
      setCurrentShipment({
          id: `draft-${Date.now()}`,
          date: new Date().toISOString(),
          note: '',
          destination: 'Ташкент-Ош',
          status: 'draft',
          items: [],
          warehouse: activeTab === 'SHIPMENTS' ? 'AIKO' : activeTab as any // Default to AIKO if on Shipments tab
      });
      setIsShipmentOpen(true);
      setNewItem({ article: '', weight: '', coils: '', bags: '', date: new Date().toISOString().slice(0, 10), stickerArticle: '' });
  };

  const handleEditShipment = (shipment: Shipment) => {
      setCurrentShipment({ ...shipment, warehouse: shipment.warehouse || 'AIKO' });
      setIsShipmentOpen(true);
      setNewItem({ article: '', weight: '', coils: '', bags: '', date: new Date().toISOString().slice(0, 10), stickerArticle: '' });
  };

  const [newItem, setNewItem] = useState({ article: '', weight: '', coils: '', bags: '', date: new Date().toISOString().slice(0, 10), stickerArticle: '' });
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());

  const handleToggleShipmentSelection = (id: string) => {
      const newSelected = new Set(selectedShipments);
      if (newSelected.has(id)) {
          newSelected.delete(id);
      } else {
          newSelected.add(id);
      }
      setSelectedShipments(newSelected);
  };

  const getAvailableArticles = (warehouse: string) => {
      if (!stats || !stats[warehouse]) return [];
      
      // Start with base stats (produced - sold)
      const baseStock = { ...stats[warehouse].current.byArticle };
      
      // Apply transfers manually (client-side calculation)
      transfers.forEach(t => {
          const art = t.article;
          const qty = parseFloat(t.quantity) || 0;
          
          // Subtract from source warehouse
          if (t.fromWarehouse === warehouse) {
              if (!baseStock[art]) baseStock[art] = 0;
              baseStock[art] -= qty;
          }
          
          // Add to destination warehouse
          if (t.toWarehouse === warehouse) {
              if (!baseStock[art]) baseStock[art] = 0;
              baseStock[art] += qty;
          }
      });
      
      return Object.entries(baseStock)
        .filter(([_, qty]) => (qty as number) > 0)
        .map(([art, qty]) => ({ article: art, qty: qty as number }));
  };

  // Get all unique articles across all warehouses (for production form)
  const getAllArticles = () => {
      if (!stats) return [];
      
      const articlesSet = new Set<string>();
      
      // Collect all articles from all warehouses
      Object.values(stats).forEach(warehouseStats => {
          Object.keys(warehouseStats.produced.byArticle).forEach(art => articlesSet.add(art));
          Object.keys(warehouseStats.sold.byArticle).forEach(art => articlesSet.add(art));
          Object.keys(warehouseStats.current.byArticle).forEach(art => articlesSet.add(art));
      });
      
      return Array.from(articlesSet).sort();
  };

  const getAvailableQuantity = (warehouse: string, article: string): number => {
      if (!stats || !stats[warehouse]) return 0;
      
      let qty = stats[warehouse].current.byArticle[article] || 0;
      
      // Apply transfers
      transfers.forEach(t => {
          if (t.article === article) {
              const transferQty = parseFloat(t.quantity) || 0;
              
              if (t.fromWarehouse === warehouse) {
                  qty -= transferQty;
              }
              
              if (t.toWarehouse === warehouse) {
                  qty += transferQty;
              }
          }
      });
      
      return Math.max(0, qty);
  };

  const handleAddItem = () => {
      if (!currentShipment) return;
      if (!newItem.article || !newItem.weight) {
          toast.error("Заполните артикул и вес");
          return;
      }

      const cleanWeight = (val: string) => {
          const str = String(val).replace(/\s/g, '').replace(',', '.');
          const num = parseFloat(str);
          return isNaN(num) ? 0 : num;
      };

      const weightToAdd = cleanWeight(newItem.weight);
      const coilsToAdd = newItem.coils ? parseInt(newItem.coils) : undefined;
      const bagsToAdd = newItem.bags ? parseInt(newItem.bags) : undefined;

      if (weightToAdd <= 0) {
          toast.error("Некорректный вес");
          return;
      }

      // Validation Logic
      const warehouse = currentShipment.warehouse || 'AIKO';
      const availableStats = stats?.[warehouse]?.current.byArticle[newItem.article] || 0;
      
      // Calculate how much of this article is already in the CURRENT draft (uncommitted)
      const alreadyInDraft = currentShipment.items
        .filter(i => i.article === newItem.article)
        .reduce((sum, i) => sum + i.weight, 0);
      
      const totalAfterAdd = alreadyInDraft + weightToAdd;

      if (totalAfterAdd > availableStats) {
          toast.error(`Ошибка: Недостаточно товара на складе ${warehouse}. Доступно: ${availableStats} кг. В отгрузке: ${alreadyInDraft} кг. Пытаетесь добавить: ${weightToAdd} кг.`);
          return;
      }

      const item: ShipmentItem = {
          id: `item-${Date.now()}`,
          article: newItem.article,
          weight: weightToAdd,
          coils: coilsToAdd,
          bags: bagsToAdd,
          date: newItem.date,
          stickerArticle: newItem.stickerArticle || undefined, // Only save if provided
      };

      const updatedShipment = {
          ...currentShipment,
          items: [item, ...currentShipment.items] // Add to top
      };

      setCurrentShipment(updatedShipment);
      setNewItem({ ...newItem, weight: '', coils: '', bags: '', stickerArticle: '' }); // Reset weight and stickerArticle for next item
  };

  const handleRemoveItem = (itemId: string) => {
      if (!currentShipment) return;
      const updatedShipment = {
          ...currentShipment,
          items: currentShipment.items.filter(i => i.id !== itemId)
      };
      setCurrentShipment(updatedShipment);
  };

  const handleSaveShipment = async (targetStatus: 'draft' | 'completed' = 'draft') => {
      if (!currentShipment) return;
      
      if (targetStatus === 'completed') {
          if (currentShipment.items.length === 0) {
              toast.error("Нельзя завершить пустую отгрузку");
              return;
          }
          
          const isAlreadyCompleted = currentShipment.status === 'completed';
          const confirmMessage = isAlreadyCompleted 
              ? "Сохранить изменения в отгрузке? Это обновит списания со склада." 
              : "Завершить отгрузку? Товары будут списаны с остатков склада.";

          if (!confirm(confirmMessage)) {
              return;
          }
      }
      
      try {
          // If ID starts with draft-, it's new. Otherwise update.
          const isNew = currentShipment.id.startsWith('draft-');
          const method = isNew ? 'POST' : 'PUT';
          const url = isNew 
             ? `${crmUrl('/shipments')}`
             : `${crmUrl(`/shipments/${currentShipment.id}`)}`;
          
          const shipmentPayload = { ...currentShipment, status: targetStatus };

          const response = await fetch(url, {
              method,
              headers: { ...authHeaders() },
              body: JSON.stringify(shipmentPayload)
          });

          if (!response.ok) throw new Error("Failed to save shipment");
          
          toast.success(targetStatus === 'completed' ? "Отгрузка завершена и списана" : "Черновик сохранен");
          setIsShipmentOpen(false);
          // Realtime will handle the refresh automatically via debounced fetchData()
          // No need to call fetchData() manually - prevents double fetching
      } catch (e) {
          console.error(e);
          toast.error("Ошибка при сохранении отгрузки");
      }
  };

  const handleDeleteShipment = async (id: string) => {
      if (!confirm("Удалить эту отгрузку?")) return;
      try {
          await fetch(`${crmUrl(`/shipments/${id}`)}`, {
              method: 'DELETE',
              headers: { ...authHeaders(false) }
          });
          toast.success("��тгрузка удалена");
          fetchShipments();
      } catch (e) {
          toast.error("Ошибка при удалении");
      }
  };

  const handleCreateTransfer = async () => {
      try {
          const qty = parseFloat(transferForm.quantity);
          if (!transferForm.article || !qty || qty <= 0) {
              toast.error("Заполните все поля корректно");
              return;
          }

          console.log('🚀 Sending transfer request:', {
              ...transferForm,
              quantity: qty
          });

          const response = await fetch(`${crmUrl('/transfers')}`, {
              method: 'POST',
              headers: { ...authHeaders() },
              body: JSON.stringify({
                  ...transferForm,
                  quantity: qty
              })
          });

          const data = await response.json();

          console.log('📥 Server response:', data);

          if (!response.ok) {
              console.error('❌ Transfer failed:', data);
              toast.error(data.error || "Ошибка при перемещении");
              return;
          }

          toast.success(`Перемещено ${qty} кг из ${transferForm.fromWarehouse} в ${transferForm.toWarehouse}`);
          setIsTransferOpen(false);
          setTransferForm({
              fromWarehouse: 'AIKO',
              toWarehouse: 'BTT',
              article: '',
              quantity: '',
              note: ''
          });
          // Realtime will handle the refresh automatically via debounced fetchData()
      } catch (e) {
          console.error('❌ Transfer error:', e);
          toast.error("Ошибка при создании перемещения");
      }
  };

  const handleDeleteTransfer = async (id: string) => {
      if (!confirm("Удалить это перемещение?")) return;
      try {
          await fetch(`${crmUrl(`/transfers/${id}`)}`, {
              method: 'DELETE',
              headers: { ...authHeaders(false) }
          });
          toast.success("Перемещение удалено");
          // Realtime will handle the refresh automatically
      } catch (e) {
          toast.error("Ошибка при удалении");
      }
  };

  const printLabel = (item: ShipmentItem, clientName?: string) => {
      // If stickerArticle exists, print ONLY it on the sticker
      // Otherwise, print the original article
      const displayArticle = item.stickerArticle || item.article;
      
      console.log('🖨️ Печать стикера:', { 
          article: item.article,
          stickerArticle: item.stickerArticle,
          printedOnSticker: displayArticle,
          weight: item.weight, 
          date: item.date, 
          clientName: clientName || '' 
      });
      
      if (window.navigator?.vibrate) window.navigator.vibrate(50);
      const win = window.open('', 'Print', 'height=600,width=800');
      if (win) {
          win.document.write(`
              <html>
                  <head>
                      <title>Print Label</title>
                      <link rel="preconnect" href="https://fonts.googleapis.com">
                      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400&display=swap" rel="stylesheet">
                      <style>
                          @page { size: 40mm 30mm; margin: 0; }
                          body { margin: 0; padding: 1mm; width: 40mm; height: 30mm; font-family: sans-serif; overflow: hidden; box-sizing: border-box; }
                          .label { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
                          .client { font-family: 'Montserrat', sans-serif; font-size: 8pt; font-weight: 600; margin-bottom: 0.5mm; color: #000; white-space: nowrap; max-width: 38mm; overflow: visible; text-overflow: clip; }
                          .art { font-size: 10pt; font-weight: bold; line-height: 1; margin-bottom: 0.5mm; white-space: nowrap; max-width: 38mm; overflow: visible; text-overflow: clip; }
                          .weight { font-size: 26pt; font-weight: 900; line-height: 1; margin: 0.5mm 0; }
                          .date { font-size: 8pt; font-weight: bold; margin-top: 0.5mm; }
                      </style>
                  </head>
                  <body>
                      <div class="label">
                          ${clientName ? `<div class="client">${clientName}</div>` : ''}
                          <div class="art">${displayArticle}</div>
                          <div class="weight">${item.weight} кг</div>
                          <div class="date">${new Date(item.date).toLocaleDateString()}</div>
                      </div>
                      <script>
                          window.onload = function() { window.print(); window.close(); }
                      </script>
                  </body>
              </html>
          `);
          win.document.close();
      }
  };

  const printWaybill = () => {
      if (!currentShipment || currentShipment.items.length === 0) {
          toast.error("Отгрузка пуста");
          return;
      }

      const totalWeight = currentShipment.items.reduce((sum, item) => sum + item.weight, 0);
      const totalCoils = currentShipment.items.reduce((sum, item) => sum + (item.coils || 1), 0);
      const totalBags = currentShipment.totalBags || 0;
      
      const win = window.open('', 'PrintWaybill', 'height=800,width=1000');
      if (win) {
          win.document.write(`
              <html>
                  <head>
                      <title>Накладная / Waybill</title>
                      <style>
                          body { font-family: sans-serif; padding: 20px; }
                          .header { text-align: center; margin-bottom: 20px; }
                          .info { margin-bottom: 20px; }
                          .info-row { display: flex; margin-bottom: 5px; }
                          .info-label { width: 150px; font-weight: bold; }
                          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                          th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                          th { background-color: #f0f0f0; }
                          .totals { text-align: right; margin-top: 10px; font-weight: bold; font-size: 1.1em; }
                          .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                          .sign-line { border-top: 1px solid #000; width: 200px; margin-top: 40px; }
                      </style>
                  </head>
                  <body>
                      <div class="header">
                          <h1>НАКЛАДНАЯ / WAYBILL</h1>
                      </div>
                      <div class="info">
                          <div class="info-row"><span class="info-label">Дата:</span> ${new Date(currentShipment.date).toLocaleDateString()}</div>
                          <div class="info-row"><span class="info-label">Клиент:</span> ${currentShipment.note || '—'}</div>
                          <div class="info-row"><span class="info-label">Направление:</span> ${currentShipment.destination || '—'}</div>
                          <div class="info-row"><span class="info-label">Склад:</span> ${currentShipment.warehouse || 'AIKO'}</div>
                      </div>
                      
                      <table>
                          <thead>
                              <tr>
                                  <th>#</th>
                                  <th>Артикул</th>
                                  <th>Бухт (шт)</th>
                                  <th>Вес (кг)</th>
                              </tr>
                          </thead>
                          <tbody>
                              ${currentShipment.items.map((item, index) => {
                                  const itemCoils = item.coils || 1;
                                  return `
                                  <tr>
                                      <td>${index + 1}</td>
                                      <td style="text-align: left; padding-left: 10px;">${item.stickerArticle || item.article}</td>
                                      <td>${itemCoils > 0 ? itemCoils : '—'}</td>
                                      <td>${item.weight}</td>
                                  </tr>
                              `}).join('')}
                          </tbody>
                      </table>
                      
                      <div class="totals">
                          Итого: ${totalCoils > 0 ? totalCoils + ' бухт, ' : ''} ${totalBags > 0 ? totalBags + ' мешков, ' : ''} ${totalWeight.toLocaleString()} кг
                      </div>
                      
                      <div class="footer">
                          <div>
                              <div>Отправил:</div>
                              <div class="sign-line"></div>
                          </div>
                          <div>
                              <div>Получил:</div>
                              <div class="sign-line"></div>
                          </div>
                      </div>
                      
                      <script>
                          window.onload = function() { window.print(); }
                      </script>
                  </body>
              </html>
          `);
          win.document.close();
      }
  };

  const printCombinedWaybill = () => {
      const selectedIds = Array.from(selectedShipments);
      if (selectedIds.length === 0) {
          toast.error("Выберите отгрузки для печати");
          return;
      }
      
      const selectedItems = shipments.filter(s => selectedIds.includes(s.id));
      if (selectedItems.length === 0) return;

      // Flat list of all items from all shipments (no aggregation across shipments)
      const tableItems: { article: string; weight: number; coils: number; bags: number; date: string }[] = [];
      // Map for breakdown by article (aggregating weights and bags for the footer)
      const breakdownMap = new Map<string, {weights: number[], bags: number}>();

      let totalWeight = 0;
      let totalCoils = 0;
      let totalBags = 0;

      // Calculate total bags from shipment-level fields for the global total
      totalBags = selectedItems.reduce((acc, s) => acc + (s.totalBags || 0), 0);

      selectedItems.forEach(s => {
          // Identify if shipment is "mono-article" (ignoring minor variations if needed, but here exact match)
          const uniqueArticles = Array.from(new Set(s.items.map(i => i.stickerArticle || i.article)));
          const shipmentBags = s.totalBags || 0;
          let bagsDistributed = false;

          s.items.forEach((item, itemIndex) => {
              // Calculate effective coils for this item
              const itemCoils = item.coils || 1;
              const articleName = item.stickerArticle || item.article;

              // Heuristic: If shipment has only one article type, assign bags to the first item of that article in this shipment
              // (or distribute, but integers don't split well). 
              // We just show it on the row.
              let itemBagsDisplay = 0;
              
              if (uniqueArticles.length === 1 && shipmentBags > 0 && !bagsDistributed) {
                  itemBagsDisplay = shipmentBags;
                  bagsDistributed = true; // Assign only once per shipment
              } else if (uniqueArticles.length > 1) {
                  // Mixed shipment: we can't easily assign bags to specific items without user input.
                  // Leave as 0 for row display to avoid confusion, or maybe show (Total: X)?
                  // User asked for "each article quantity of bags".
                  // If mixed, we can't know. 
              }

              // Add to flat list for table
              tableItems.push({
                  article: articleName,
                  weight: item.weight,
                  coils: itemCoils,
                  bags: itemBagsDisplay, 
                  date: s.date
              });

              // Add to breakdown map
              if (!breakdownMap.has(articleName)) {
                  breakdownMap.set(articleName, { weights: [], bags: 0 });
              }
              const entry = breakdownMap.get(articleName)!;
              entry.weights.push(item.weight);
              
              // Add bags to breakdown if we attributed them
              if (itemBagsDisplay > 0) {
                  entry.bags += itemBagsDisplay;
              }

              totalWeight += item.weight;
              totalCoils += itemCoils;
          });
      });

      const win = window.open('', 'PrintCombinedWaybill', 'height=800,width=1000');
      if (win) {
          win.document.write(`
              <html>
                  <head>
                      <title>Сводная накладная / Consolidated Waybill</title>
                      <style>
                          body { font-family: sans-serif; padding: 20px; }
                          .header { text-align: center; margin-bottom: 20px; }
                          .info { margin-bottom: 20px; }
                          .info-row { display: flex; margin-bottom: 5px; }
                          .info-label { width: 150px; font-weight: bold; }
                          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                          th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                          th { background-color: #f0f0f0; }
                          .totals { text-align: right; margin-top: 10px; font-weight: bold; font-size: 1.1em; }
                          .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                          .sign-line { border-top: 1px solid #000; width: 200px; margin-top: 40px; }
                          .breakdown { margin-top: 30px; border-top: 1px dashed #ccc; pt: 20px; }
                          .breakdown h3 { font-size: 16px; margin-bottom: 10px; }
                          .breakdown-item { margin-bottom: 8px; font-size: 14px; }
                          .weight-list { color: #555; }
                      </style>
                  </head>
                  <body>
                      <div class="header">
                          <h1>СВОДНАЯ НАКЛАДНАЯ / CONSOLIDATED WAYBILL</h1>
                      </div>
                      <div class="info">
                          <div class="info-row"><span class="info-label">Дата печати:</span> ${new Date().toLocaleDateString()}</div>
                          <div class="info-row"><span class="info-label">Отгрузок:</span> ${selectedItems.length}</div>
                          <div class="info-row"><span class="info-label">Даты отгрузок:</span> ${selectedItems.map(s => new Date(s.date).toLocaleDateString()).join(', ')}</div>
                      </div>
                      
                      <table>
                          <thead>
                              <tr>
                                  <th>#</th>
                                  <th>Артикул</th>
                                  <th>Бухт (шт)</th>
                                  <th>Мешков (шт)</th>
                                  <th>Вес (кг)</th>
                              </tr>
                          </thead>
                          <tbody>
                              ${tableItems.map((item, index) => `
                                  <tr>
                                      <td>${index + 1}</td>
                                      <td style="text-align: left; padding-left: 10px;">${item.article}</td>
                                      <td>${item.coils > 0 ? item.coils : '—'}</td>
                                      <td>${item.bags > 0 ? item.bags : '—'}</td>
                                      <td>${parseFloat(item.weight.toFixed(2))}</td>
                                  </tr>
                              `).join('')}
                          </tbody>
                      </table>
                      
                      <div class="totals">
                          Итого: ${totalCoils > 0 ? totalCoils + ' бухт, ' : ''} ${totalBags > 0 ? totalBags + ' мешков, ' : ''} ${totalWeight.toLocaleString()} кг
                      </div>

                      <div class="breakdown">
                          <h3>Детализация ��еса / Weight Breakdown</h3>
                          ${Array.from(breakdownMap.entries()).map(([article, val]) => `
                              <div class="breakdown-item">
                                  <strong>${article}${val.bags > 0 ? ' (' + val.bags + ' мешков)' : ''}:</strong> 
                                  <span class="weight-list">${val.weights.map(w => w.toFixed(2)).join(', ')}</span>
                              </div>
                          `).join('')}
                      </div>
                      
                      <div class="footer">
                          <div>
                              <div>Отправил:</div>
                              <div class="sign-line"></div>
                          </div>
                          <div>
                              <div>Получил:</div>
                              <div class="sign-line"></div>
                          </div>
                      </div>
                      
                      <script>
                          window.onload = function() { window.print(); }
                      </script>
                  </body>
              </html>
          `);
          win.document.close();
      }
  };

  const renderDashboard = (warehouseName: string) => {
      const whStats = stats ? stats[warehouseName] : null;
      const whLogs = logs.filter(l => (l.warehouse || 'AIKO') === warehouseName);

      const stockByMaterial = {
        'Искусственный ротанг': [] as {art: string, qty: number}[],
        'Крученый ротанг': [] as {art: string, qty: number}[],
        'Кашпо': [] as {art: string, qty: number}[],
      };

      if (whStats) {
          const articleMatMap = new Map<string, string>();
          whLogs.forEach(l => {
              if (l.article && l.materialType) articleMatMap.set(l.article, l.materialType);
          });

          Object.entries(whStats.current.byArticle).forEach(([art, qty]) => {
              // Hide zero balance items
              if (Math.abs(qty) < 0.01) return;

              let mat = articleMatMap.get(art);
              if (!mat) {
                  if (art.toLowerCase().includes('кашпо')) mat = 'Кашпо';
                  else mat = 'Искусственный ротанг';
              }
              
              if (mat === 'Алюминий' || mat === 'Ткань') mat = 'Искусственный ротанг'; 

              if (mat === 'Крученый ротанг') {
                  stockByMaterial['Крученый ротанг'].push({ art, qty });
              } else if (mat === 'Кашпо') {
                  stockByMaterial['Кашпо'].push({ art, qty });
              } else {
                  stockByMaterial['Искусственный ротанг'].push({ art, qty });
              }
          });
      }

      const renderStockCard = (title: string, items: {art: string, qty: number}[], icon: React.ReactNode) => {
        const isExpandedMode = expandedCategory === title;
        const isCompactMode = expandedCategory !== null && expandedCategory !== title;

        return (
            <div className={`transition-all duration-500 ease-in-out ${isExpandedMode ? 'lg:flex-[3] min-w-[300px]' : 'lg:flex-1 min-w-[120px]'}`}>
                <StockCard 
                    title={title} 
                    items={items} 
                    icon={icon} 
                    warehouseName={warehouseName}
                    onEdit={(art, qty) => {
                        setCorrectionData({ 
                            article: art, 
                            warehouse: warehouseName, 
                            current: qty, 
                            real: '', 
                            image: recipeImages[art] || ''
                        });
                        fetchStockHistory(art, warehouseName);
                        setIsCorrectionOpen(true);
                    }}
                    onClear={handleClearStock}
                    getUnit={getUnit}
                    isExpandedMode={isExpandedMode}
                    isCompactMode={isCompactMode}
                    onToggleExpandMode={() => setExpandedCategory(isExpandedMode ? null : title)}
                    recipeImages={recipeImages}
                />
            </div>
        );
      };

      return (
        <div className="space-y-8">
            {/* Stats Cards */}
            <div className="flex flex-col md:flex-row gap-6 min-h-[160px]">
                <StatCard 
                    title="Текущий остаток" 
                    total={whStats ? whStats.current.total : 0} 
                    unit="кг" 
                    subtitle={warehouseName}
                    icon={<Boxes />}
                    colorScheme="green"
                    isExpanded={expandedStat === 'current'}
                    isCompact={expandedStat !== null && expandedStat !== 'current'}
                    onToggleExpand={() => setExpandedStat(expandedStat === 'current' ? null : 'current')}
                    breakdown={whStats?.current.byArticle}
                />
                <StatCard 
                    title="Всего произведено" 
                    total={whStats ? whStats.produced.total : 0} 
                    unit="кг" 
                    subtitle="Поступления"
                    icon={<ArrowUpCircle />}
                    colorScheme="blue"
                    isExpanded={expandedStat === 'produced'}
                    isCompact={expandedStat !== null && expandedStat !== 'produced'}
                    onToggleExpand={() => setExpandedStat(expandedStat === 'produced' ? null : 'produced')}
                    breakdown={whStats?.produced.byArticle}
                />
                <StatCard 
                    title="Всего продано" 
                    total={whStats ? whStats.sold.total : 0} 
                    unit="кг" 
                    subtitle="Списано по сделкам"
                    icon={<ArrowDownCircle />}
                    colorScheme="orange"
                    isExpanded={expandedStat === 'sold'}
                    isCompact={expandedStat !== null && expandedStat !== 'sold'}
                    onToggleExpand={() => setExpandedStat(expandedStat === 'sold' ? null : 'sold')}
                    breakdown={whStats?.sold.byArticle}
                />
            </div>

            {/* Stock Sections Grid */}
            {whStats && (
                <div className="flex flex-col lg:flex-row gap-6">
                    {renderStockCard('Кашпо', stockByMaterial['Кашпо'], <Package className="h-5 w-5" />)}
                    {renderStockCard('Искусственный ротанг', stockByMaterial['Искусственный ротанг'], <Boxes className="h-5 w-5" />)}
                    {renderStockCard('Крученый рот��нг', stockByMaterial['Крученый ротанг'], <RefreshCcw className="h-5 w-5" />)}
                </div>
            )}

            <Dialog open={isCorrectionOpen} onOpenChange={setIsCorrectionOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-xl sm:text-2xl">Редактирование товара</DialogTitle>
                        <DialogDescription className="text-sm sm:text-base">
                            Упра��ление товаром <span className="font-semibold text-slate-800">{correctionData.article}</span>
                        </DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="edit" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="w-full grid grid-cols-2">
                            <TabsTrigger value="edit">Редактировать</TabsTrigger>
                            <TabsTrigger value="history">История движений</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="edit" className="flex-1 overflow-y-auto mt-4">
                    <div className="grid gap-6 pb-4">
                        {/* Image Upload Section - Enhanced */}
                        <ImageUploadZone 
                            imageUrl={correctionData.image || recipeImages[correctionData.article]}
                            onUpload={handleImageUploadForArticle}
                            uploading={uploadingImage}
                            articleName={correctionData.article}
                        />

                        {/* Stock Information */}
                        <div className="bg-slate-50 rounded-xl p-4 sm:p-5 space-y-4 border border-slate-200">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Остатки
                            </h3>
                            
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm text-slate-600">Текущий остаток</Label>
                                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-bold text-slate-800">
                                                {parseFloat(correctionData.current.toFixed(2))}
                                            </span>
                                            <span className="text-sm text-slate-500 uppercase font-semibold">
                                                {getUnit(undefined, correctionData.article)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="real" className="text-sm text-slate-600">
                                        Фактический остаток
                                    </Label>
                                    <Input
                                        id="real"
                                        type="number"
                                        step="0.01"
                                        value={correctionData.real}
                                        onChange={(e) => setCorrectionData({ ...correctionData, real: e.target.value })}
                                        className="h-12 text-lg font-semibold"
                                        placeholder={correctionData.current.toString()}
                                    />
                                    <p className="text-xs text-slate-500">
                                        Оставьте пустым, если остаток не измен��лся
                                    </p>
                                </div>
                            </div>
                            
                            {/* Difference Indicator */}
                            {correctionData.real && parseFloat(correctionData.real.replace(',', '.')) !== correctionData.current && (
                                <div className={`p-3 rounded-lg border ${
                                    parseFloat(correctionData.real.replace(',', '.')) > correctionData.current 
                                        ? 'bg-emerald-50 border-emerald-200' 
                                        : 'bg-red-50 border-red-200'
                                }`}>
                                    <div className="flex items-center gap-2 text-sm">
                                        <AlertCircle className="h-4 w-4" />
                                        <span className="font-medium">
                                            Разница: {(parseFloat(correctionData.real.replace(',', '.')) - correctionData.current).toFixed(2)} {getUnit(undefined, correctionData.article)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsCorrectionOpen(false)} 
                            className="flex-1 sm:flex-none"
                            disabled={savingCorrection || uploadingImage}
                        >
                            Отмена
                        </Button>
                        <Button 
                            onClick={handleSaveCorrection} 
                            className="flex-1 sm:flex-none"
                            disabled={savingCorrection || uploadingImage}
                        >
                            {savingCorrection ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                                    Сохранение...
                                </>
                            ) : (
                                'Сохранить изменения'
                            )}
                        </Button>
                    </DialogFooter>
                    </TabsContent>
                    
                    <TabsContent value="history" className="flex-1 overflow-y-auto mt-4">
                        {loadingHistory ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-600" />
                            </div>
                        ) : stockHistory.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                                <p>История движений отсутствует</p>
                            </div>
                        ) : (
                            <div className="space-y-2 pb-4">
                                {stockHistory.map((item, index) => (
                                    <div 
                                        key={item.id || index}
                                        className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    {item.type === 'in' ? (
                                                        <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
                                                    ) : (
                                                        <Truck className="h-5 w-5 text-red-600" />
                                                    )}
                                                    <span className={`font-semibold ${
                                                        item.type === 'in' ? 'text-emerald-700' : 'text-red-700'
                                                    }`}>
                                                        {item.type === 'in' ? 'Приход' : 'Отгрузка'}
                                                    </span>
                                                    <span className={`text-lg font-bold ${
                                                        item.type === 'in' ? 'text-emerald-600' : 'text-red-600'
                                                    }`}>
                                                        {item.amount > 0 ? '+' : ''}{item.amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} {getUnit(undefined, correctionData.article)}
                                                    </span>
                                                </div>
                                                
                                                {item.note && (
                                                    <p className="text-sm text-slate-600 mb-2">{item.note}</p>
                                                )}
                                                
                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(item.date).toLocaleString('ru-RU', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                    {item.worker && (
                                                        <span>Работник: {item.worker}</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="text-right">
                                                <div className="text-xs text-slate-500 mb-1">Остаток</div>
                                                <div className="text-xl font-bold text-slate-800">
                                                    {item.balance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                                                </div>
                                                <div className="text-xs text-slate-500 uppercase">
                                                    {getUnit(undefined, correctionData.article)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <DialogFooter className="gap-2 sm:gap-0 mt-4">
                            <Button 
                                variant="outline" 
                                onClick={() => setIsCorrectionOpen(false)} 
                                className="w-full sm:w-auto"
                            >
                                Закрыть
                            </Button>
                        </DialogFooter>
                    </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
            
            <div className="flex flex-col xl:flex-row gap-6">
                 {/* Recent Shipments */}
                 <div className={`transition-all duration-500 ease-in-out ${expandedBottom === 'shipments' ? 'xl:flex-[3]' : expandedBottom === 'history' ? 'xl:flex-1' : 'xl:flex-1'}`}>
                      <Card className={`transition-all duration-500 ${expandedBottom === 'shipments' ? 'shadow-md ring-1 ring-blue-100 border-blue-200' : ''}`}>
                         <CardHeader>
                             <CardTitle className="text-base flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-slate-400" />
                                    {!expandedBottom || expandedBottom === 'shipments' || expandedBottom !== 'history' ? 'Последние поступления' : ''}
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => setExpandedBottom(expandedBottom === 'shipments' ? null : 'shipments')}>
                                    {expandedBottom === 'shipments' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                </Button>
                             </CardTitle>
                         </CardHeader>
                         <CardContent className="p-0">
                             <Table>
                                 <TableBody>
                                     {whLogs.slice(0, expandedBottom === 'shipments' ? 100 : 5).map(log => (
                                         <TableRow key={log.id}>
                                             <TableCell className="py-3 px-4">
                                                 <div className="font-medium text-slate-800">{log.amount} {log.unit || (getUnit(log.materialType, log.article))}</div>
                                                 <div className="text-xs text-slate-500 line-clamp-1">{log.article || 'Без артикула'}</div>
                                             </TableCell>
                                             <TableCell className="py-3 px-4 text-right text-xs text-slate-500 whitespace-nowrap">
                                                 <div>{new Date(log.date).toLocaleDateString()}</div>
                                                 <div>{new Date(log.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                             </TableCell>
                                         </TableRow>
                                     ))}
                                     {whLogs.length === 0 && (
                                         <TableRow>
                                             <TableCell colSpan={2} className="text-center py-8 text-slate-400">Нет данных</TableCell>
                                         </TableRow>
                                     )}
                                 </TableBody>
                             </Table>
                         </CardContent>
                     </Card>
                 </div>

                 {/* Detailed Logs History */}
                 <div className={`transition-all duration-500 ease-in-out ${expandedBottom === 'history' ? 'xl:flex-[3]' : expandedBottom === 'shipments' ? 'xl:flex-1' : 'xl:flex-[2]'}`}>
                    <Card className={`transition-all duration-500 ${expandedBottom === 'history' ? 'shadow-md ring-1 ring-blue-100 border-blue-200' : ''}`}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                История ({warehouseName})
                                <Badge variant="outline" className="bg-slate-100">{whLogs.length}</Badge>
                            </CardTitle>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => setExpandedBottom(expandedBottom === 'history' ? null : 'history')}>
                                {expandedBottom === 'history' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                        </CardHeader>
                <CardContent className={isMobile ? "p-4" : ""}>
                <div className="rounded-md border">
                    {isMobile ? (
                        <div className="divide-y divide-slate-100">
                          {whLogs.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">Нет данных</div>
                          ) : (
                             whLogs.slice(0, expandedBottom === 'history' ? undefined : 5).map(log => (
                               <div key={log.id} className="p-3 space-y-2">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <div className="font-medium text-slate-900 flex items-center gap-2">
                                            {log.amount} {log.unit}
                                            {log.article && <Badge variant="outline" className="text-xs h-5">{log.article}</Badge>}
                                          </div>
                                          <div className="text-xs text-slate-500 mt-1">
                                             {new Date(log.date).toLocaleDateString()} {new Date(log.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                          </div>
                                      </div>
                                      <div>
                                         {log.status === 'synced' ? (
                                            <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] h-5">Synced</Badge>
                                         ) : (
                                            <Badge variant="outline" className="text-slate-400 text-[10px] h-5">Wait</Badge>
                                         )}
                                      </div>
                                  </div>
                                  <div className="flex justify-between items-end">
                                      <div className="text-xs text-slate-600">
                                         {log.worker && <span className="block">👤 {log.worker}</span>}
                                         {log.twistedWorker && <span className="block text-slate-500">🔄 {log.twistedWorker}</span>}
                                      </div>
                                      <div className="flex gap-2">
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(log)}>
                                              <Pencil className="h-3.5 w-3.5 text-slate-400" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(log.id)}>
                                              <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                                          </Button>
                                      </div>
                                  </div>
                               </div>
                             ))
                          )}
                        </div>
                    ) : (
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Поступление</TableHead>
                        <TableHead>Артикул</TableHead>
                        <TableHead>Инфо</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {whLogs.length === 0 ? (
                           <TableRow>
                               <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Нет данных</TableCell>
                           </TableRow>
                        ) : (
                           whLogs.slice(0, expandedBottom === 'history' ? undefined : 5).map(log => (
                               <TableRow key={log.id}>
                                   <TableCell>
                                       <div className="font-bold text-slate-800">{log.amount} {log.unit}</div>
                                       <div className="text-xs text-slate-500">
                                          {new Date(log.date).toLocaleDateString()} {new Date(log.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                       </div>
                                   </TableCell>
                                   <TableCell>
                                       {log.article ? <Badge variant="outline">{log.article}</Badge> : '-'}
                                   </TableCell>
                                   <TableCell>
                                       <div className="text-sm">
                                           {log.worker && <div>👤 {log.worker}</div>}
                                           {log.twistedWorker && <div className="text-slate-500">🔄 {log.twistedWorker}</div>}
                                           {log.originalMessage && <div className="text-xs text-slate-400 mt-1 italic">{log.originalMessage}</div>}
                                       </div>
                                   </TableCell>
                                   <TableCell>
                                       {log.status === 'synced' ? (
                                           <Badge variant="secondary" className="bg-green-100 text-green-700">Синхронизировано</Badge>
                                       ) : (
                                           <Badge variant="outline" className="text-slate-400">Ожидание</Badge>
                                       )}
                                   </TableCell>
                                   <TableCell className="text-right">
                                       <div className="flex justify-end gap-2">
                                           <Button variant="ghost" size="sm" onClick={() => openEditDialog(log)}>
                                               <Pencil className="h-4 w-4" />
                                           </Button>
                                           <Button variant="ghost" size="sm" onClick={() => handleDelete(log.id)}>
                                               <Trash2 className="h-4 w-4 text-red-500" />
                                           </Button>
                                       </div>
                                   </TableCell>
                               </TableRow>
                           ))
                        )}
                    </TableBody>
                    </Table>
                    )}
                </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
  };

  return (
    <div className="space-y-6">
      <EmployeesDialog open={isEmployeesOpen} onOpenChange={setIsEmployeesOpen} />
      
      {/* Transfer Dialog */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                  <DialogTitle>Перемещение товара между складами</DialogTitle>
                  <DialogDescription>
                      Переместите товар с одного склада на другой. Остатки будут автоматически пересчитаны.
                  </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Откуда (склад-источник)</Label>
                          <Select 
                              value={transferForm.fromWarehouse} 
                              onValueChange={(v) => setTransferForm({...transferForm, fromWarehouse: v, toWarehouse: transferForm.toWarehouse === v ? '' : transferForm.toWarehouse})}
                          >
                              <SelectTrigger>
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="AIKO">AIKO</SelectItem>
                                  <SelectItem value="BTT">BTT</SelectItem>
                                  <SelectItem value="Bizly">Bizly</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      
                      <div className="space-y-2">
                          <Label>Куда (склад-назначение)</Label>
                          <Select 
                              value={transferForm.toWarehouse} 
                              onValueChange={(v) => setTransferForm({...transferForm, toWarehouse: v})}
                          >
                              <SelectTrigger>
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  {transferForm.fromWarehouse !== 'AIKO' && <SelectItem value="AIKO">AIKO</SelectItem>}
                                  {transferForm.fromWarehouse !== 'BTT' && <SelectItem value="BTT">BTT</SelectItem>}
                                  {transferForm.fromWarehouse !== 'Bizly' && <SelectItem value="Bizly">Bizly</SelectItem>}
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
                  
                  <div className="space-y-2">
                      <Label>Артикул товара</Label>
                      <Select 
                          value={transferForm.article} 
                          onValueChange={(v) => setTransferForm({...transferForm, article: v})}
                      >
                          <SelectTrigger>
                              <SelectValue placeholder="Выберите артикул" />
                          </SelectTrigger>
                          <SelectContent>
                              {getAvailableArticles(transferForm.fromWarehouse).map(({article, qty}) => (
                                  <SelectItem key={article} value={article}>
                                      <div className="flex justify-between w-full gap-4">
                                          <span>{article}</span>
                                          <span className="text-slate-400 font-mono text-xs">{qty} кг</span>
                                      </div>
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  
                  <div className="space-y-2">
                      <Label>Количество (кг)</Label>
                      <Input 
                          type="number" 
                          step="0.01"
                          value={transferForm.quantity}
                          onChange={(e) => setTransferForm({...transferForm, quantity: e.target.value})}
                          placeholder="Введите вес"
                      />
                      {transferForm.article && (
                          <p className="text-xs text-slate-500">
                              Доступно на складе {transferForm.fromWarehouse}: {
                                  getAvailableQuantity(transferForm.fromWarehouse, transferForm.article).toFixed(2)
                              } кг
                          </p>
                      )}
                  </div>
                  
                  <div className="space-y-2">
                      <Label>Примечание (необязательно)</Label>
                      <Input 
                          value={transferForm.note}
                          onChange={(e) => setTransferForm({...transferForm, note: e.target.value})}
                          placeholder="Причина перемещения"
                      />
                  </div>
              </div>
              
              <DialogFooter>
                  <DialogClose asChild>
                      <Button variant="outline">Отмена</Button>
                  </DialogClose>
                  <Button onClick={handleCreateTransfer} className="bg-green-600 hover:bg-green-700">
                      <ArrowUpCircle className="mr-2 h-4 w-4" />
                      Переместить
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>{editingLogId ? 'Редактировать запись' : 'Добавить поступление'}</DialogTitle>
                  <DialogDescription>
                      Внесите данные о произведенной продукции вручную.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                          <Label>Склад</Label>
                          <Select 
                              value={newLog.warehouse} 
                              onValueChange={(v) => setNewLog({...newLog, warehouse: v})}
                          >
                              <SelectTrigger>
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="AIKO">AIKO</SelectItem>
                                  <SelectItem value="BTT">BTT</SelectItem>
                                  <SelectItem value="Bizly">Bizly</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label>Количество ({newLog.materialType === 'Кашпо' ? 'шт' : 'кг'})</Label>
                          <Input 
                              type="number"
                              step="any" 
                              inputMode="decimal" 
                              placeholder="0.0"
                              value={newLog.amount}
                              onChange={(e) => setNewLog({...newLog, amount: e.target.value})}
                          />
                      </div>
                      <div className="space-y-2">
                          <Label>Мешков (шт)</Label>
                          <Input 
                              type="number"
                              placeholder="0"
                              value={newLog.bags}
                              onChange={(e) => setNewLog({...newLog, bags: e.target.value})}
                          />
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Материал</Label>
                          <Select 
                              value={newLog.materialType} 
                              onValueChange={(v) => setNewLog({...newLog, materialType: v})}
                          >
                              <SelectTrigger>
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="Искусственный ротанг">Искусственный ротанг</SelectItem>
                                  <SelectItem value="Крученый ротанг">Крученый ротанг</SelectItem>
                                  <SelectItem value="Кашпо">Кашпо</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      
                      {newLog.materialType === 'Кашпо' ? (
                          <div className="space-y-2">
                              <Label>Тип кашпо</Label>
                              <Select 
                                  value={newLog.planterType} 
                                  onValueChange={(v) => setNewLog({...newLog, planterType: v})}
                              >
                                  <SelectTrigger>
                                      <SelectValue placeholder="Выберите тип" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="Кашпо 16л Пухляш">Кашпо 16л Пухляш</SelectItem>
                                      <SelectItem value="Кашпо 16л Классика">Кашпо 16л Классика</SelectItem>
                                      <SelectItem value="Кашпо 10л Пухляш">Кашпо 10л Пухляш</SelectItem>
                                      <SelectItem value="Кашпо 10л Классика">Кашпо 10л Классика</SelectItem>
                                      <SelectItem value="Кашпо 5л с ручкой">Кашпо 5л с ручкой</SelectItem>
                                      <SelectItem value="Кашпо 5л прямые">Кашпо 5л прямые</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                      ) : (
                          <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                  <Label>Артикул</Label>
                                  <Button 
                                      type="button"
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-xs h-auto p-1"
                                      onClick={() => {
                                          setIsManualArticleInput(!isManualArticleInput);
                                          setNewLog({...newLog, article: ''});
                                      }}
                                  >
                                      {isManualArticleInput ? '← Выбрать из списка' : '+ Новый артикул'}
                                  </Button>
                              </div>
                              {isManualArticleInput ? (
                                  <Input 
                                      placeholder="Например: A-101"
                                      value={newLog.article}
                                      onChange={(e) => setNewLog({...newLog, article: e.target.value})}
                                  />
                              ) : (
                                  <Select 
                                      value={newLog.article}
                                      onValueChange={(v) => setNewLog({...newLog, article: v})}
                                  >
                                      <SelectTrigger>
                                          <SelectValue placeholder="Выберите артикул" />
                                      </SelectTrigger>
                                      <SelectContent>
                                          {getAllArticles().map(article => (
                                              <SelectItem key={article} value={article}>
                                                  {article}
                                              </SelectItem>
                                          ))}
                                          {getAllArticles().length === 0 && (
                                              <SelectItem value="none" disabled>Нет доступных артикулов</SelectItem>
                                          )}
                                      </SelectContent>
                                  </Select>
                              )}
                          </div>
                      )}
                  </div>
                  
                  {newLog.materialType === 'Кашпо' && (
                      <div className="space-y-2">
                          <div className="flex items-center justify-between">
                              <Label>Артикул</Label>
                              <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-xs h-auto p-1"
                                  onClick={() => {
                                      setIsManualArticleInput(!isManualArticleInput);
                                      setNewLog({...newLog, article: ''});
                                  }}
                              >
                                  {isManualArticleInput ? '← Выбрать из списка' : '+ Новый артикул'}
                              </Button>
                          </div>
                          {isManualArticleInput ? (
                              <Input 
                                  placeholder="Например: RED-001"
                                  value={newLog.article}
                                  onChange={(e) => setNewLog({...newLog, article: e.target.value})}
                              />
                          ) : (
                              <Select 
                                  value={newLog.article}
                                  onValueChange={(v) => setNewLog({...newLog, article: v})}
                              >
                                  <SelectTrigger>
                                      <SelectValue placeholder="Выберите артикул" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {getAllArticles().map(article => (
                                          <SelectItem key={article} value={article}>
                                              {article}
                                          </SelectItem>
                                      ))}
                                      {getAllArticles().length === 0 && (
                                          <SelectItem value="none" disabled>Нет доступных артикулов</SelectItem>
                                      )}
                                  </SelectContent>
                              </Select>
                          )}
                      </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Сотрудник</Label>
                          <Select 
                              value={newLog.worker} 
                              onValueChange={(v) => setNewLog({...newLog, worker: v})}
                          >
                              <SelectTrigger>
                                  <SelectValue placeholder="Выберите..." />
                              </SelectTrigger>
                              <SelectContent>
                                  {employees.filter(e => e.active).map(e => (
                                      <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                      
                      {newLog.materialType === 'Крученый ротанг' && (
                          <div className="space-y-2">
                              <Label>Кто крутил?</Label>
                              <Select 
                                  value={newLog.twistedWorker} 
                                  onValueChange={(v) => setNewLog({...newLog, twistedWorker: v})}
                              >
                                  <SelectTrigger>
                                      <SelectValue placeholder="Выберите..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {employees.filter(e => e.active).map(e => (
                                          <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>
                      )}
                  </div>

                  <div className="space-y-2">
                      <Label>Дата и время</Label>
                      <Input 
                          type="datetime-local"
                          value={newLog.date}
                          onChange={(e) => setNewLog({...newLog, date: e.target.value})}
                      />
                  </div>
                  
                  <div className="space-y-2">
                      <Label>Примечание</Label>
                      <Input 
                          placeholder="Дополнительная информация..."
                          value={newLog.note}
                          onChange={(e) => setNewLog({...newLog, note: e.target.value})}
                      />
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
                  <Button onClick={handleManualAdd} disabled={savingManual}>
                      {savingManual ? 'Сохранение...' : (editingLogId ? 'Обновить' : 'Добавить')}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Склад и производство</h1>
          <p className="text-slate-500">Учет остатков и поступлений продукции</p>
        </div>
        <div className="flex gap-2 md:gap-3">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={openAddDialog}>
                    {isMobile ? <Plus className="h-5 w-5"/> : <><Plus className="mr-2 h-4 w-4"/> Добавить поступление</>}
                  </Button>
              </DialogTrigger>
          </Dialog>
          
          <Button variant="outline" onClick={handleOpenShipment} className="border-slate-300 text-slate-700">
             <Truck className="h-4 w-4 mr-2" /> {isMobile ? '' : 'Отгрузка'}
          </Button>

          <Button variant="outline" onClick={() => setIsTransferOpen(true)} className="border-slate-300 text-slate-700">
             <ArrowUpCircle className="h-4 w-4 mr-2" /> {isMobile ? '' : 'Переместить'}
          </Button>

          <Button variant="outline" size="icon" onClick={() => setIsEmployeesOpen(true)} title="Сотрудники">
              <Settings className="h-4 w-4 text-slate-500" />
          </Button>
          
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} title="Обновить">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button variant="ghost" size="icon" onClick={handleSync} disabled={syncing} title="Синхронизация с Google Sheets">
             <RefreshCcw className={`h-4 w-4 text-green-600 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button variant="ghost" size="icon" onClick={handleInventoryReset} title="Инвентаризация (Обнулить склад)" className="text-orange-600 hover:text-orange-800 hover:bg-orange-50">
              <Archive className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info Banners */}
      <div className="space-y-3">
        {integrations.google && (
           <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">Интеграция с Google Sheets активна</span>
                  <span className="sm:hidden">Google Sheets активен</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-green-800 hover:text-red-600 hover:bg-green-100" onClick={handleDisableGoogleSync}>
                  Отключить
              </Button>
           </div>
        )}
        
        {/* Quick Tips Banner - can be dismissed */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm"
        >
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold mb-1">Совет:</p>
              <p className="text-xs sm:text-sm text-blue-700">
                <span className="hidden sm:inline">Нажмите на карточку товара чтобы добавить фото или скорректировать остатки. Перетащите изображение для быстрой загрузки.</span>
                <span className="sm:hidden">Нажмите на товар для редактирования и добавления фото</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6 h-auto">
          <TabsTrigger value="AIKO" className="text-xs sm:text-sm py-2 px-2 sm:px-4">
            <Database className="h-4 w-4 mr-1 hidden sm:block" />
            AIKO
          </TabsTrigger>
          <TabsTrigger value="BTT" className="text-xs sm:text-sm py-2 px-2 sm:px-4">
            <Database className="h-4 w-4 mr-1 hidden sm:block" />
            BTT
          </TabsTrigger>
          <TabsTrigger value="Bizly" className="text-xs sm:text-sm py-2 px-2 sm:px-4">
            <Database className="h-4 w-4 mr-1 hidden sm:block" />
            Bizly
          </TabsTrigger>
          <TabsTrigger value="SHIPMENTS" className="text-xs sm:text-sm py-2 px-2 sm:px-4">
            <Truck className="h-4 w-4 mr-1 hidden sm:block" />
            Отгрузки
          </TabsTrigger>
          <TabsTrigger value="Analytics" className="text-xs sm:text-sm py-2 px-2 sm:px-4">
            <Boxes className="h-4 w-4 mr-1 hidden sm:block" />
            Аналитика
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="AIKO" className="space-y-4">
           {loading && !stats ? (
               <div className="space-y-6">
                 {/* Skeleton Loading */}
                 <div className="flex flex-col md:flex-row gap-6">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="flex-1 bg-white rounded-xl border border-slate-200 p-6">
                       <div className="animate-pulse space-y-4">
                         <div className="h-4 w-24 bg-slate-200 rounded" />
                         <div className="h-8 w-32 bg-slate-200 rounded" />
                         <div className="h-3 w-20 bg-slate-200 rounded" />
                       </div>
                     </div>
                   ))}
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                   {[1, 2, 3, 4, 5, 6].map(i => (
                     <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                       <div className="animate-pulse">
                         <div className="h-48 bg-slate-200" />
                         <div className="p-4 space-y-3">
                           <div className="h-4 bg-slate-200 rounded w-3/4" />
                           <div className="h-6 bg-slate-200 rounded w-1/2" />
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
           ) : (
               renderDashboard('AIKO')
           )}
        </TabsContent>
        
        <TabsContent value="BTT" className="space-y-4">
           {loading && !stats ? (
               <div className="space-y-6">
                 {/* Skeleton Loading */}
                 <div className="flex flex-col md:flex-row gap-6">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="flex-1 bg-white rounded-xl border border-slate-200 p-6">
                       <div className="animate-pulse space-y-4">
                         <div className="h-4 w-24 bg-slate-200 rounded" />
                         <div className="h-8 w-32 bg-slate-200 rounded" />
                         <div className="h-3 w-20 bg-slate-200 rounded" />
                       </div>
                     </div>
                   ))}
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                   {[1, 2, 3, 4, 5, 6].map(i => (
                     <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                       <div className="animate-pulse">
                         <div className="h-48 bg-slate-200" />
                         <div className="p-4 space-y-3">
                           <div className="h-4 bg-slate-200 rounded w-3/4" />
                           <div className="h-6 bg-slate-200 rounded w-1/2" />
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
           ) : (
               renderDashboard('BTT')
           )}
        </TabsContent>

        <div className="space-y-4">
            <TabsContent value="Bizly" className="space-y-4">
            {loading && !stats ? (
                <div className="space-y-6">
                  {/* Skeleton Loading */}
                  <div className="flex flex-col md:flex-row gap-6">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex-1 bg-white rounded-xl border border-slate-200 p-6">
                        <div className="animate-pulse space-y-4">
                          <div className="h-4 w-24 bg-slate-200 rounded" />
                          <div className="h-8 w-32 bg-slate-200 rounded" />
                          <div className="h-3 w-20 bg-slate-200 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="animate-pulse">
                          <div className="h-48 bg-slate-200" />
                          <div className="p-4 space-y-3">
                            <div className="h-4 bg-slate-200 rounded w-3/4" />
                            <div className="h-6 bg-slate-200 rounded w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            ) : (
                renderDashboard('Bizly')
            )}
         </TabsContent>
             <TabsContent value="SHIPMENTS">
              <Card className={`transition-all duration-300 ${expandedShipmentsLog ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl overflow-hidden flex flex-col' : ''}`}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CardTitle>Журнал отгрузок</CardTitle>
                    {selectedShipments.size > 0 && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-300">
                            <span className="text-sm text-slate-500 hidden sm:inline">Выбрано: {selectedShipments.size}</span>
                            <Button 
                                size="sm" 
                                variant="default" 
                                className="bg-slate-800 text-white gap-2"
                                onClick={printCombinedWaybill}
                            >
                                <Printer className="h-4 w-4" />
                                Печать общей накладной
                            </Button>
                        </div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => setExpandedShipmentsLog(!expandedShipmentsLog)}>
                       {expandedShipmentsLog ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                <CardContent className={expandedShipmentsLog ? "flex-1 overflow-auto" : ""}>
                  {loading && shipments.length === 0 ? (
                      <div className="text-center py-10 text-slate-500">Загрузка...</div>
                  ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                            <Checkbox 
                                checked={shipments.length > 0 && selectedShipments.size === shipments.length}
                                onCheckedChange={(checked) => {
                                    if (checked) setSelectedShipments(new Set(shipments.map(s => s.id)));
                                    else setSelectedShipments(new Set());
                                }}
                            />
                        </TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Мешков</TableHead>
                        <TableHead>Позиций</TableHead>
                        <TableHead>Артикулы</TableHead>
                        <TableHead>Общий вес</TableHead>
                        <TableHead>Примечание</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shipments.length === 0 ? (
                         <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Нет отгрузок</TableCell>
                         </TableRow>
                      ) : (
                         shipments.map(s => (
                            <TableRow key={s.id}>
                               <TableCell>
                                   <Checkbox 
                                        checked={selectedShipments.has(s.id)}
                                        onCheckedChange={() => handleToggleShipmentSelection(s.id)}
                                   />
                               </TableCell>
                               <TableCell>{new Date(s.date).toLocaleDateString()} {new Date(s.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</TableCell>
                               <TableCell>
                                  <Badge variant={s.status === 'completed' ? 'default' : 'outline'}>
                                     {s.status === 'completed' ? 'Завершена' : 'Черновик'}
                                  </Badge>
                               </TableCell>
                               <TableCell>{s.totalBags || '—'}</TableCell>
                               <TableCell>{s.items?.length || 0}</TableCell>
                               <TableCell>
                                  <div className="max-w-[200px] truncate text-xs text-slate-600" title={Array.from(new Set(s.items.map(i => i.stickerArticle || i.article))).join(', ')}>
                                      {Array.from(new Set(s.items.map(i => i.stickerArticle || i.article))).join(', ')}
                                  </div>
                               </TableCell>
                               <TableCell className="font-bold">
                                  {s.items?.reduce((acc, i) => acc + i.weight, 0).toLocaleString()} кг
                               </TableCell>
                               <TableCell>{s.note}</TableCell>
                               <TableCell className="text-right">
                                  <Button variant="ghost" size="sm" onClick={() => handleEditShipment(s)}>
                                      <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteShipment(s.id)}>
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                               </TableCell>
                            </TableRow>
                         ))
                      )}
                    </TableBody>
                  </Table>
                  )}
                </CardContent>
              </Card>

              <Dialog open={isShipmentOpen} onOpenChange={setIsShipmentOpen}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                          <DialogTitle>Управление отгрузкой</DialogTitle>
                          <DialogDescription>
                              Добавляйте позиции в отгрузку. Артикул и вес обязательны. Опционально укажите артикул для стикера — он заменит основной артикул при печати.
                          </DialogDescription>
                      </DialogHeader>
                      
                      <div className="grid gap-4 py-2">
                         <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
                            <div className="grid gap-2 w-full md:w-1/4">
                                <Label>Склад отгрузки</Label>
                                <Select 
                                    value={currentShipment?.warehouse || 'AIKO'} 
                                    onValueChange={(v) => setCurrentShipment(prev => prev ? {...prev, warehouse: v} : null)}
                                    disabled={currentShipment?.items.length > 0} 
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="AIKO">AIKO</SelectItem>
                                        <SelectItem value="BTT">BTT</SelectItem>
                                        <SelectItem value="Bizly">Bizly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2 w-full md:w-1/4">
                                <Label>Направление</Label>
                                <Input 
                                    placeholder="Куда едет (Ташкент-Ош)" 
                                    value={currentShipment?.destination || ''} 
                                    onChange={e => setCurrentShipment(prev => prev ? {...prev, destination: e.target.value} : null)} 
                                />
                             </div>
                             <div className="grid gap-2 w-full md:w-1/4">
                                 <Label>Клиент / Примечание</Label>
                                 <Input 
                                     placeholder="Кому отгружаем" 
                                     value={currentShipment?.note || ''} 
                                     onChange={e => setCurrentShipment(prev => prev ? {...prev, note: e.target.value} : null)} 
                                 />
                             </div>
                             <div className="grid gap-2 w-full md:w-1/4">
                                 <Label>Фирма на стикер</Label>
                                 <Input 
                                     placeholder="Опционально" 
                                     value={currentShipment?.stickerClient || ''} 
                                     onChange={e => setCurrentShipment(prev => prev ? {...prev, stickerClient: e.target.value} : null)} 
                                 />
                            </div>
                            <div className="grid gap-2 w-full md:w-1/4">
                                <Label>Всего мешков (шт)</Label>
                                <Input 
                                    type="number"
                                    placeholder="Итого..." 
                                    value={currentShipment?.totalBags || ''} 
                                    onChange={e => setCurrentShipment(prev => prev ? {...prev, totalBags: e.target.value ? parseInt(e.target.value) : undefined} : null)} 
                                />
                             </div>
                             <div className="text-sm text-muted-foreground md:mt-6">
                                {currentShipment?.items.length > 0 && "Склад нельзя изменить, пока есть добавленные позиции."}
                            </div>
                         </div>

                         <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg border">
                            <div className="grid gap-2 w-full md:w-1/4">
                                <Label>Артикул (система)</Label>
                                <Select 
                                    value={newItem.article} 
                                    onValueChange={(v) => setNewItem({...newItem, article: v})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Выберите артикул" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getAvailableArticles(currentShipment?.warehouse || 'AIKO').map(({article, qty}) => (
                                            <SelectItem key={article} value={article}>
                                                <div className="flex justify-between w-full gap-4">
                                                    <span>{article}</span>
                                                    <span className="text-slate-400 font-mono text-xs">{qty} кг</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                        {getAvailableArticles(currentShipment?.warehouse || 'AIKO').length === 0 && (
                                            <SelectItem value="none" disabled>Нет товаров на остатке</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2 w-full md:w-1/4">
                                <Label className="flex items-center gap-1">
                                    Артикул на стикере
                                    <span className="text-xs text-slate-400">(опц.)</span>
                                </Label>
                                <Input 
                                    type="text"
                                    placeholder="Для печати..." 
                                    value={newItem.stickerArticle}
                                    onChange={e => setNewItem({...newItem, stickerArticle: e.target.value})}
                                />
                                {newItem.article && newItem.stickerArticle && (
                                    <p className="text-xs text-blue-600 -mt-1">
                                        📄 На стикере: {newItem.stickerArticle}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-2 w-full md:w-1/6">
                                {/* <Label>Мешков</Label>
                                <Input 
                                    type="number"
                                    placeholder="0" 
                                    value={newItem.bags}
                                    onChange={e => setNewItem({...newItem, bags: e.target.value})}
                                /> */}
                            </div>
                            <div className="grid gap-2 w-full md:w-1/5">
                                <Label>Вес (кг)</Label>
                                <Input 
                                    id="weight-input"
                                    type="number"
                                    step="any" 
                                    inputMode="decimal"
                                    placeholder="0.0" 
                                    value={newItem.weight}
                                    onChange={e => setNewItem({...newItem, weight: e.target.value})}
                                    onKeyDown={e => { if(e.key === 'Enter') handleAddItem(); }}
                                />
                            </div>
                            <div className="grid gap-2 w-full md:w-1/5">
                                <Label>Дата упаковки</Label>
                                <Input 
                                    type="date" 
                                    value={newItem.date}
                                    onChange={e => setNewItem({...newItem, date: e.target.value})}
                                />
                            </div>
                            <Button onClick={handleAddItem} className="w-full md:w-1/5 bg-blue-600 hover:bg-blue-700">
                                <Plus className="mr-2 h-4 w-4" /> Добавить
                            </Button>
                        </div>
                      </div>

                      <div className="mt-4">
                          {isMobile ? (
                              <div className="space-y-3">
                                  {currentShipment?.items.length === 0 ? (
                                      <div className="text-center py-4 text-muted-foreground">
                                          Список пуст. Добавьте позиции сверху.
                                      </div>
                                  ) : (
                                      currentShipment?.items.map(item => (
                                          <div key={item.id} className="border p-3 rounded-md space-y-3 bg-white shadow-sm">
                                              <div className="flex justify-between items-start">
                                                  <div>
                                                      <div className="font-medium text-lg">
                                                          {item.stickerArticle ? (
                                                              <>
                                                                  {item.article} <span className="text-blue-600">→ {item.stickerArticle}</span>
                                                              </>
                                                          ) : (
                                                              item.article
                                                          )}
                                                      </div>
                                                      <div className="text-sm font-bold text-slate-700">{item.weight} кг</div>
                                                      {item.stickerArticle && (
                                                          <div className="text-xs text-slate-500 mt-1">
                                                              На стикере: {item.stickerArticle}
                                                          </div>
                                                      )}
                                                  </div>
                                                  <div className="flex gap-2">
                                                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => printLabel(item, currentShipment?.stickerClient)}>
                                                          <Printer className="h-4 w-4" />
                                                      </Button>
                                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleRemoveItem(item.id)}>
                                                          <X className="h-4 w-4" />
                                                      </Button>
                                                  </div>
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                          ) : (
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>Артикул (система)</TableHead>
                                      <TableHead>Печать (система → стикер)</TableHead>
                                      <TableHead>Вес</TableHead>
                                      <TableHead className="text-right">Действия</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {currentShipment?.items.map(item => (
                                      <TableRow key={item.id}>
                                          <TableCell className="font-medium">{item.article}</TableCell>
                                          <TableCell>
                                              {item.stickerArticle ? (
                                                  <span className="text-blue-600 font-medium">
                                                      {item.article} - {item.stickerArticle}
                                                  </span>
                                              ) : (
                                                  <span className="text-slate-400 text-sm">—</span>
                                              )}
                                          </TableCell>
                                          <TableCell>{item.weight} кг</TableCell>
                                          <TableCell className="text-right">
                                              <div className="flex justify-end gap-2">
                                                  <Button variant="outline" size="sm" onClick={() => printLabel(item, currentShipment?.stickerClient)}>
                                                      <Printer className="h-4 w-4" />
                                                  </Button>
                                                  <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(item.id)}>
                                                      <X className="h-4 w-4 text-red-500" />
                                                  </Button>
                                              </div>
                                          </TableCell>
                                      </TableRow>
                                  ))}
                                  {currentShipment?.items.length === 0 && (
                                      <TableRow>
                                          <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                              Список пуст. Добавьте позиции сверху.
                                          </TableCell>
                                      </TableRow>
                                  )}
                              </TableBody>
                          </Table>
                          )}
                      </div>

                      <DialogFooter className="flex justify-between items-center sm:justify-between gap-4">
                          <div className="text-sm font-bold text-slate-700 hidden sm:block">
                              Итого: {currentShipment?.items.length || 0} мест, {currentShipment?.items.reduce((acc, i) => acc + i.weight, 0).toFixed(2)} кг
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto justify-end">
                              <Button variant="outline" onClick={printWaybill} className="mr-auto sm:mr-0">
                                  <FileText className="h-4 w-4 mr-2" /> Накладная
                              </Button>
                              <DialogClose asChild>
                                  <Button variant="outline">Отмена</Button>
                              </DialogClose>
                              {currentShipment?.status !== 'completed' ? (
                                <>
                                    <Button variant="secondary" onClick={() => handleSaveShipment('draft')}>
                                        Черновик
                                    </Button>
                                    <Button onClick={() => handleSaveShipment('completed')} className="bg-green-600 hover:bg-green-700">
                                        Завершить
                                    </Button>
                                </>
                              ) : (
                                <Button onClick={() => handleSaveShipment('completed')} className="bg-blue-600 hover:bg-blue-700">
                                    Сохранить изменения
                                </Button>
                              )}
                          </div>
                      </DialogFooter>
                  </DialogContent>
              </Dialog>

              {/* Transfers History */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowUpCircle className="h-4 w-4 text-slate-400" />
                    История перемещений
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {transfers.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">Нет перемещений</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Дата</TableHead>
                          <TableHead>Откуда</TableHead>
                          <TableHead>Куда</TableHead>
                          <TableHead>Артикул</TableHead>
                          <TableHead>Количество</TableHead>
                          <TableHead>Примечание</TableHead>
                          <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfers.map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                {t.fromWarehouse}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                {t.toWarehouse}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{t.article}</TableCell>
                            <TableCell className="font-bold">{t.quantity} кг</TableCell>
                            <TableCell className="text-xs text-slate-500">{t.note || '—'}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteTransfer(t.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* New Analytics Tab */}
            <TabsContent value="Analytics">
              <div className="space-y-6">
                {/* Filters */}
                <WarehouseFiltersComponent
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  onReset={handleResetFilters}
                  availableWarehouses={['AIKO', 'BTT', 'Bizly']}
                  availableArticles={availableArticles}
                />

                {/* Monthly Statistics */}
                <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-4">Статистика по месяцам</h2>
                  {loadingMonthlyStats ? (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-500 mx-auto mb-3"></div>
                          <p className="text-sm text-slate-500">Загрузка статистики...</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <WarehouseMonthlyStats 
                      data={monthlyStats}
                      selectedWarehouse={filters.warehouses.length === 1 ? filters.warehouses[0] : 'all'}
                    />
                  )}
                </div>

                {/* Movements History */}
                <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-4">История всех движений</h2>
                  <WarehouseMovementsTable 
                    movements={movements}
                    loading={loadingMovements}
                  />
                </div>
              </div>
            </TabsContent>
        </div>
      </Tabs>

    </div>
  );
}