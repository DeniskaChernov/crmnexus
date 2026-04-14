import React, { useEffect, useState } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '../components/ui/dialog';
import { 
  Plus, 
  Search, 
  Thermometer, 
  Edit, 
  Trash2,
  ChefHat,
  Palette,
  PackageOpen,
  Settings2,
  RefreshCw,
  Gauge,
  Image as ImageIcon,
  Upload,
  X
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface Recipe {
  id: string;
  name: string; // Артикул (2312ПЛ)
  description: string;
  base: string; // Основа
  dye: string; // Краска
  temperature: string; // Градус
  screwSpeed: string; // Скорость шнека
  dyeSpeed: string; // Скорость прокраски
  winding: string; // Намотка
  image: string | null; // URL изображения
  updatedAt: string;
}

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Detail view state
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base: '',
    dye: '',
    temperature: '',
    screwSpeed: '',
    dyeSpeed: '',
    winding: '',
    image: '' as string | null
  });

  // Helper to safely render string or object values
  const toDisplayString = (val: any): string => {
    if (!val) return '—';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return Object.entries(val)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    }
    return String(val);
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${crmUrl('/recipes')}`,
        {
          headers: { ...authHeaders(false) }
        }
      );
      
      if (!response.ok) throw new Error('Failed to load recipes');
      
      const data = await response.json();
      console.log('Loaded recipes from server:', data);
      
      // Remove duplicates based on ID
      const uniqueRecipes = data.filter((recipe: Recipe, index: number, self: Recipe[]) => 
        index === self.findIndex((r) => r.id === recipe.id)
      );
      
      console.log('Unique recipes after filtering:', uniqueRecipes);
      
      setRecipes(uniqueRecipes);
    } catch (error) {
      console.error('Error loading recipes:', error);
      toast.error('Ошибка загрузки рецептов');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (recipe?: Recipe) => {
    if (recipe) {
      setCurrentRecipe(recipe);
      setFormData({
        name: recipe.name,
        description: recipe.description,
        base: toDisplayString(recipe.base),
        dye: toDisplayString(recipe.dye),
        temperature: toDisplayString(recipe.temperature),
        screwSpeed: toDisplayString(recipe.screwSpeed),
        dyeSpeed: toDisplayString(recipe.dyeSpeed),
        winding: toDisplayString(recipe.winding),
        image: recipe.image || null
      });
    } else {
      setCurrentRecipe(null);
      setFormData({
        name: '',
        description: '',
        base: '',
        dye: '',
        temperature: '',
        screwSpeed: '',
        dyeSpeed: '',
        winding: '',
        image: null
      });
    }
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Файл слишком большой (макс. 5MB)');
      return;
    }

    try {
      setUploading(true);
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
      
      setFormData(prev => ({ ...prev, image: data.url }));
      toast.success('Фото загружено');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Ошибка загрузки фото');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Введите название нити');
      return;
    }

    try {
      const payload = {
        ...formData,
        id: currentRecipe?.id
      };

      console.log('Saving recipe with payload:', payload);

      const response = await fetch(
        `${crmUrl('/recipes')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(false),
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) throw new Error('Failed to save recipe');

      const result = await response.json();
      console.log('Recipe saved successfully:', result);

      await loadRecipes();
      setIsDialogOpen(false);
      toast.success(currentRecipe ? 'Рецепт обновлен' : 'Рецепт создан');
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Ошибка сохранения');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот рецепт?')) return;

    try {
      const encodedId = encodeURIComponent(id);
      
      const response = await fetch(
        `${crmUrl(`/recipes/${encodedId}`)}`,
        {
          method: 'DELETE',
          headers: { ...authHeaders(false) }
        }
      );

      if (!response.ok) throw new Error('Failed to delete recipe');

      setRecipes(recipes.filter(r => r.id !== id));
      toast.success('Рецепт удален');
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast.error('Ошибка удаления');
    }
  };

  const filteredRecipes = recipes.filter(r => {
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = r.name.toLowerCase().includes(searchLower);
    const baseStr = toDisplayString(r.base).toLowerCase();
    const baseMatch = baseStr.includes(searchLower);
    return nameMatch || baseMatch;
  });

  return (
    <div className="space-y-6 p-6 pb-20 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ChefHat className="h-8 w-8 text-blue-600" />
            Библиотека Рецептов
          </h1>
          <p className="text-slate-500 mt-1">
            Технологические карты производства нитей
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 shadow-md transition-all hover:scale-105">
          <Plus className="mr-2 h-4 w-4" /> Добавить рецепт
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input 
          placeholder="Поиск по артикулу или составу..." 
          className="pl-10 max-w-md border-slate-200 focus:border-blue-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <ChefHat className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Рецептов пока нет</h3>
          <p className="text-slate-500 mb-6">Создайте первую технологическую карту для производства</p>
          <Button onClick={() => handleOpenDialog()} variant="outline">
            Создать рецепт
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRecipes.map((recipe) => (
            <Card 
              key={recipe.id} 
              className="group hover:shadow-lg transition-all duration-300 border-slate-200 overflow-hidden flex flex-col cursor-pointer"
              onClick={() => {
                setViewRecipe(recipe);
                setIsViewDialogOpen(true);
              }}
            >
              
              {/* Image Preview in Card */}
              {recipe.image ? (
                <div className="w-full h-48 overflow-hidden bg-slate-100 relative">
                   <img 
                     src={recipe.image} 
                     alt={recipe.name}
                     className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-60" />
                   <div className="absolute bottom-3 left-4 right-4">
                     <h3 className="text-white font-bold text-xl drop-shadow-md truncate">{recipe.name}</h3>
                   </div>
                </div>
              ) : (
                <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-2xl font-bold text-slate-800 line-clamp-1" title={recipe.name}>
                      {recipe.name}
                    </CardTitle>
                  </div>
                  {recipe.description && (
                    <CardDescription className="line-clamp-2">
                      {recipe.description}
                    </CardDescription>
                  )}
                </CardHeader>
              )}
              
              <CardContent className="space-y-4 pt-4 flex-grow">
                {/* Ingredients Section */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                       <PackageOpen className="h-3 w-3" /> ОСНОВА
                    </span>
                    <div className="text-sm text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-100 min-h-[80px] whitespace-pre-line leading-relaxed">
                      {toDisplayString(recipe.base)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                       <Palette className="h-3 w-3" /> КРАСКА
                    </span>
                    <div className="text-sm text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-100 min-h-[80px] whitespace-pre-line leading-relaxed">
                      {toDisplayString(recipe.dye)}
                    </div>
                  </div>
                </div>

                {/* Technical Parameters */}
                <div className="space-y-3 pt-2">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 mb-1.5">
                       <Thermometer className="h-4 w-4 text-orange-500" />
                       <span className="text-xs font-bold text-slate-500 uppercase">Градус (Зоны)</span>
                    </div>
                    <div className="text-sm font-mono text-slate-900 break-all leading-tight">
                      {toDisplayString(recipe.temperature)}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                       <div className="flex justify-center mb-1">
                          <Settings2 className="h-4 w-4 text-blue-500" />
                       </div>
                       <div className="text-[10px] text-slate-500 leading-none mb-1">Шнек</div>
                       <div className="font-bold text-slate-900 text-sm">{toDisplayString(recipe.screwSpeed)}</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                       <div className="flex justify-center mb-1">
                          <Gauge className="h-4 w-4 text-purple-500" />
                       </div>
                       <div className="text-[10px] text-slate-500 leading-none mb-1">Краска</div>
                       <div className="font-bold text-slate-900 text-sm">{toDisplayString(recipe.dyeSpeed)}</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                       <div className="flex justify-center mb-1">
                          <RefreshCw className="h-4 w-4 text-emerald-500" />
                       </div>
                       <div className="text-[10px] text-slate-500 leading-none mb-1">Намотка</div>
                       <div className="font-bold text-slate-900 text-sm">{toDisplayString(recipe.winding)}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="pt-2 border-t border-slate-50 flex justify-between gap-2 bg-slate-50/30">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full hover:bg-blue-50 hover:text-blue-600 border-slate-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDialog(recipe);
                  }}
                >
                  <Edit className="h-3.5 w-3.5 mr-2" /> Изменить
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 px-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(recipe.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {currentRecipe ? 'Редактировать рецепт' : 'Новый рецепт'}
            </DialogTitle>
            <DialogDescription>
              Заполните технологическую карту согласно стандарту
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            {/* Image Upload */}
            <div className="flex justify-center mb-2">
               {formData.image ? (
                 <div className="relative w-full h-48 bg-slate-100 rounded-lg overflow-hidden group">
                   <img src={formData.image} alt="Preview" className="w-full h-full object-contain" />
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button 
                        variant="destructive" 
                        size="icon"
                        onClick={() => setFormData({ ...formData, image: null })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                   </div>
                 </div>
               ) : (
                 <div className="w-full">
                   <Label 
                     htmlFor="image-upload" 
                     className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
                   >
                     <div className="flex flex-col items-center justify-center pt-5 pb-6">
                       {uploading ? (
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" />
                       ) : (
                         <>
                           <Upload className="w-8 h-8 mb-3 text-slate-400" />
                           <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Нажмите для загрузки фото</span></p>
                           <p className="text-xs text-slate-500">PNG, JPG (MAX. 5MB)</p>
                         </>
                       )}
                     </div>
                     <Input 
                       id="image-upload" 
                       type="file" 
                       className="hidden" 
                       accept="image/*"
                       onChange={handleImageUpload}
                       disabled={uploading}
                     />
                   </Label>
                 </div>
               )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name" className="text-slate-900 font-bold">Артикул / Название (Code)</Label>
              <Input
                id="name"
                placeholder="Например: 2312ПЛ"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="text-lg font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="base" className="flex items-center gap-2 font-semibold text-slate-700">
                  <PackageOpen className="h-4 w-4 text-blue-500" /> Основа (Base)
                </Label>
                <Textarea
                  id="base"
                  placeholder="Дробленка родная...&#10;0320 25кг...&#10;Белый мастербач 1кг"
                  value={formData.base}
                  onChange={(e) => setFormData({ ...formData, base: e.target.value })}
                  className="min-h-[120px] font-mono text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dye" className="flex items-center gap-2 font-semibold text-slate-700">
                  <Palette className="h-4 w-4 text-purple-500" /> Краска (Paint)
                </Label>
                <Textarea
                  id="dye"
                  placeholder="0320 4кг...&#10;Графит 24гр..."
                  value={formData.dye}
                  onChange={(e) => setFormData({ ...formData, dye: e.target.value })}
                  className="min-h-[120px] font-mono text-sm"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
               <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                 <Settings2 className="h-4 w-4" /> Параметры линии
               </h4>
               
               <div className="grid gap-2">
                 <Label htmlFor="temp" className="text-xs uppercase text-slate-500 font-bold">Градус (Зоны)</Label>
                 <Input
                   id="temp"
                   placeholder="220 200 200 0 0 0 250 250 210 210 210"
                   value={formData.temperature}
                   onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                   className="font-mono"
                 />
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                 <div className="grid gap-2">
                   <Label htmlFor="screw" className="text-xs uppercase text-slate-500 font-bold">Скор. шнека</Label>
                   <Input
                     id="screw"
                     placeholder="45.00"
                     value={formData.screwSpeed}
                     onChange={(e) => setFormData({ ...formData, screwSpeed: e.target.value })}
                   />
                 </div>
                 <div className="grid gap-2">
                   <Label htmlFor="dyeSpeed" className="text-xs uppercase text-slate-500 font-bold">Скор. прокраски</Label>
                   <Input
                     id="dyeSpeed"
                     placeholder="30.10"
                     value={formData.dyeSpeed}
                     onChange={(e) => setFormData({ ...formData, dyeSpeed: e.target.value })}
                   />
                 </div>
                 <div className="grid gap-2">
                   <Label htmlFor="winding" className="text-xs uppercase text-slate-500 font-bold">Намотка</Label>
                   <Input
                     id="winding"
                     placeholder="10.60 - 22.20"
                     value={formData.winding}
                     onChange={(e) => setFormData({ ...formData, winding: e.target.value })}
                   />
                 </div>
               </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="desc">Заметки (необязательно)</Label>
              <Textarea
                id="desc"
                placeholder="Дополнительные комментарии..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="h-20"
              />
            </div>
          </div>

          <DialogFooter>
             <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
             <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <ChefHat className="h-6 w-6 text-blue-600" />
              {viewRecipe?.name}
            </DialogTitle>
            <DialogDescription className="text-base">
              {viewRecipe?.description || 'Подробная информация о рецепте'}
            </DialogDescription>
          </DialogHeader>
          
          {viewRecipe && (
            <div className="space-y-6 py-4">
              {/* Image */}
              {viewRecipe.image && (
                <div className="w-full h-64 bg-slate-100 rounded-lg overflow-hidden">
                  <img 
                    src={viewRecipe.image} 
                    alt={viewRecipe.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Ingredients */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
                    <PackageOpen className="h-5 w-5 text-blue-500" />
                    Основа (Base)
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-line text-slate-800 min-h-[120px]">
                    {toDisplayString(viewRecipe.base)}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
                    <Palette className="h-5 w-5 text-purple-500" />
                    Краска (Paint)
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-line text-slate-800 min-h-[120px]">
                    {toDisplayString(viewRecipe.dye)}
                  </div>
                </div>
              </div>

              {/* Technical Parameters */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
                  <Settings2 className="h-5 w-5 text-blue-600" />
                  Параметры линии
                </h3>
                
                <div className="bg-gradient-to-br from-orange-50 to-red-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="h-5 w-5 text-orange-600" />
                    <span className="font-bold text-slate-700">Градус (Зоны температуры)</span>
                  </div>
                  <div className="font-mono text-lg text-slate-900 bg-white/70 p-3 rounded">
                    {toDisplayString(viewRecipe.temperature)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
                    <div className="flex justify-center mb-2">
                      <Settings2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="text-xs text-slate-600 uppercase font-bold mb-2">Скорость шнека</div>
                    <div className="text-2xl font-bold text-blue-900">{toDisplayString(viewRecipe.screwSpeed)}</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 text-center">
                    <div className="flex justify-center mb-2">
                      <Gauge className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="text-xs text-slate-600 uppercase font-bold mb-2">Скорость прокраски</div>
                    <div className="text-2xl font-bold text-purple-900">{toDisplayString(viewRecipe.dyeSpeed)}</div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 text-center">
                    <div className="flex justify-center mb-2">
                      <RefreshCw className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="text-xs text-slate-600 uppercase font-bold mb-2">Намотка</div>
                    <div className="text-2xl font-bold text-emerald-900">{toDisplayString(viewRecipe.winding)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Закрыть
            </Button>
            <Button 
              onClick={() => {
                setIsViewDialogOpen(false);
                if (viewRecipe) {
                  handleOpenDialog(viewRecipe);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Edit className="h-4 w-4 mr-2" />
              Редактировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}