import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Package, RefreshCw, Database, Info, FileSpreadsheet, Plus, ArrowUpCircle, ArrowDownCircle, Boxes, Pencil, Trash2, Settings, RefreshCcw, Printer, Truck, X, Search, Clock, ChevronDown, ChevronUp, Maximize2, Minimize2, Archive, Upload, Grid, List, Camera, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner@2.0.3';
import { crm } from "@/lib/crmClient.ts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from './ui/dialog';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { EmployeesDialog } from './EmployeesDialog';
import { useIsMobile } from './ui/use-mobile';

// Enhanced Image Upload Zone Component
const ImageUploadZone = ({ 
  imageUrl, 
  onUpload, 
  uploading,
  articleName 
}: { 
  imageUrl?: string; 
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  uploading: boolean;
  articleName: string;
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const fileInput = document.getElementById('article-image-upload') as HTMLInputElement;
      if (fileInput) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(files[0]);
        fileInput.files = dataTransfer.files;
        
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Фото товара
        </Label>
        {imageUrl && (
          <span className="text-xs text-emerald-600 font-medium">✓ Загружено</span>
        )}
      </div>
      
      {imageUrl ? (
        <div className="relative w-full h-56 sm:h-64 bg-slate-100 rounded-xl overflow-hidden group border-2 border-slate-200">
          <img 
            src={imageUrl} 
            alt={articleName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <Label 
              htmlFor="article-image-upload"
              className="cursor-pointer bg-white text-slate-800 px-4 py-2.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2 font-medium shadow-lg"
            >
              <Upload className="h-4 w-4" />
              Изменить фото
            </Label>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative transition-all duration-200 ${isDragging ? 'scale-102' : ''}`}
        >
          <Label 
            htmlFor="article-image-upload"
            className={`flex flex-col items-center justify-center w-full h-48 sm:h-56 border-2 ${
              isDragging 
                ? 'border-blue-400 bg-blue-50 border-solid' 
                : 'border-slate-300 border-dashed bg-slate-50'
            } rounded-xl cursor-pointer hover:bg-slate-100 transition-all group`}
          >
            <div className="flex flex-col items-center justify-center p-6 text-center">
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-500 mb-3" />
                  <p className="text-sm text-slate-600 font-medium">Загрузка...</p>
                </>
              ) : (
                <>
                  <div className="bg-blue-100 rounded-full p-4 mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="text-sm sm:text-base text-slate-700 font-semibold mb-1">
                    {isDragging ? 'Отпустите для загрузки' : 'Нажмите или перетащите фото'}
                  </p>
                  <p className="text-xs text-slate-500">PNG, JPG, WEBP (макс. 5MB)</p>
                </>
              )}
            </div>
          </Label>
        </div>
      )}
      
      <Input 
        id="article-image-upload"
        type="file"
        className="hidden"
        accept="image/*"
        onChange={onUpload}
        disabled={uploading}
      />
    </div>
  );
};

export { ImageUploadZone };
