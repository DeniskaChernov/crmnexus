import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { crm } from "@/lib/crmClient.ts";
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner@2.0.3';
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle2, Loader2, AlertCircle, Database, Calendar, Phone, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Progress } from '../components/ui/progress';

export default function ImportWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  // Mapping state
  const [mapping, setMapping] = useState({
    title: '',
    // amount is handled by amountColumns array
    contact_name: '',
    contact_phone: '',
    company_name: '',
    created_at: '',
  });

  const [amountColumns, setAmountColumns] = useState<string[]>([]);

  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [defaultStageId, setDefaultStageId] = useState<string>('');
  const [autoStatus, setAutoStatus] = useState(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0 });

  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    const { data } = await crm.from('pipelines').select('*').order('is_default', { ascending: false });
    if (data && data.length > 0) {
      setPipelines(data);
      setSelectedPipelineId(data[0].id);
      fetchStages(data[0].id);
    }
  };

  const fetchStages = async (pipelineId: string) => {
    const { data } = await crm.from('stages').select('*').eq('pipeline_id', pipelineId).order('order_index');
    if (data) {
      setStages(data);
      if (data.length > 0) setDefaultStageId(data[0].id);
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setFile(file);
    parseCSV(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles: 1 
  });

  const findBestMatch = (headers: string[], keywords: string[]): string => {
    // Exact match case-insensitive
    const exact = headers.find(h => keywords.some(k => h.toLowerCase().trim() === k.toLowerCase()));
    if (exact) return exact;

    // Partial match
    const partial = headers.find(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));
    if (partial) return partial;

    return '';
  };

    const autoMapHeaders = (headers: string[], sampleRows: any[]) => {
      const newMapping = { ...mapping };
      const newAmountCols: string[] = [];
      const usedColumns = new Set<string>();

      // Helper to check content type
      const checkColumnType = (col: string, type: 'date' | 'phone' | 'amount' | 'text') => {
          let score = 0;
          let count = 0;
          for (const row of sampleRows) {
              if (count >= 5) break;
              const val = row[col];
              if (!val) continue;
              
              const strVal = val.toString().trim();
              if (strVal.length === 0) continue;
              count++;

              if (type === 'date') {
                  // Basic date check
                  if (!isNaN(Date.parse(strVal)) || strVal.match(/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/)) score++;
              } else if (type === 'phone') {
                  // Phone check: mostly digits, optional +, length 7-20
                  const clean = strVal.replace(/[^0-9+]/g, '');
                  if (clean.length >= 7 && clean.length <= 15 && strVal.match(/[0-9]/)) score++;
              } else if (type === 'amount') {
                  // Amount check: numeric, maybe with spaces/dots/commas
                  // Remove spaces, replace comma with dot if needed
                  const clean = strVal.replace(/\s/g, '').replace(',', '.');
                  const num = parseFloat(clean);
                  
                  // Check if it looks like a phone number (e.g. starts with + or length > 10 and no decimal point in original)
                  const isPhoneLike = strVal.includes('+') || (clean.length > 9 && !strVal.includes('.') && !strVal.includes(','));
                  
                  if (!isNaN(num) && isFinite(num) && !isPhoneLike) score++;
              } else if (type === 'text') {
                  if (strVal.length > 2) score++;
              }
          }
          return count > 0 ? score / count : 0;
      };

      // 1. Date
      const dateKeywords = ["Дата", "Date", "Period", "Период", "Time", "Время", "Создан", "Created", "Data", "День"];
      let dateCol = findBestMatch(headers, dateKeywords);
      // Fallback: Check content
      if (!dateCol) {
          const candidates = headers.filter(h => checkColumnType(h, 'date') > 0.8);
          if (candidates.length > 0) dateCol = candidates[0];
      }
      if (dateCol) { newMapping.created_at = dateCol; usedColumns.add(dateCol); }

      // 2. Amount (Crucial) - REVISED LOGIC BY USER REQUEST
      // Priority 1: Payment components (Advance + Cash + Cashless)
      const specificPaymentCols = ["Аванс", "Наличные", "наличные", "Безнал", "безнал", "Оплата", "Card", "Cash", "Терминал", "Перечисление"];
      const foundPaymentCols = headers.filter(h => specificPaymentCols.some(k => h.toLowerCase().includes(k.toLowerCase())));
      
      if (foundPaymentCols.length > 0) {
          foundPaymentCols.forEach(c => {
              if (!newAmountCols.includes(c)) newAmountCols.push(c);
              usedColumns.add(c);
          });
      } else {
          // Priority 2: explicit "Total" / "Sum" columns.
          const totalKeywords = ["Итого", "Total", "Сумма", "Sum", "Grand Total", "Общая сумма", "Всего", "Amount", "Оборот", "Выручка"];
          const totalCol = findBestMatch(headers, totalKeywords);

          if (totalCol) {
              newAmountCols.push(totalCol);
              usedColumns.add(totalCol);
          } else {
              // Priority 3: Price / Cost
              const priceKeywords = ["Стоимость", "Цена", "Price", "Cost", "Budget", "Продажа"];
              const priceCol = findBestMatch(headers, priceKeywords);
              if (priceCol) {
                  newAmountCols.push(priceCol);
                  usedColumns.add(priceCol);
              } else {
                  // Priority 4: Any numeric column
                  const numericCols = headers.filter(h => !usedColumns.has(h) && checkColumnType(h, 'amount') > 0.8);
                  if (numericCols.length > 0) {
                       newAmountCols.push(numericCols[0]);
                       usedColumns.add(numericCols[0]);
                  }
              }
          }
      }

      // 3. Phone - Priority to "Адрес/контакты" or "Телефон"
      const phoneKeywords = ["Адрес/контакты", "Телефон", "Phone", "Tel", "Mob", "Mobile", "Сот", "Контакты", "Связь", "Номер", "Cell"];
      let phoneCol = findBestMatch(headers, phoneKeywords);
      if (!phoneCol) {
          const candidates = headers.filter(h => !usedColumns.has(h) && checkColumnType(h, 'phone') > 0.8);
          if (candidates.length > 0) phoneCol = candidates[0];
      }
      if (phoneCol) { newMapping.contact_phone = phoneCol; usedColumns.add(phoneCol); }

      // 4. Client / Contact / Company - Priority to "Имя клиента"
      const nameKeywords = ["Имя клиента", "Клиент", "ФИО", "Имя", "Name", "Client", "Customer", "Лид", "Контакт", "Покупатель", "Partner", "Партнер", "Контрагент", "Заказчик", "Плательщик", "Получатель", "Ф.И.О.", "Owner", "Person"];
      let nameCol = findBestMatch(headers, nameKeywords);
      
      // Fallback: If no name column, find any text column that isn't Date/Phone/Amount/Title
      if (!nameCol) {
           // We'll leave it empty for now and try to find it after Title
      } else {
           newMapping.contact_name = nameCol;
           usedColumns.add(nameCol);
      }

      // 5. Title / Product - Priority to "Вид продажи"
      const titleKeywords = ["Вид продажи", "Название", "Сделка", "Deal", "Title", "Продукт", "Товар", "Услуга", "Service", "Product", "Item", "Наименование", "Номенклатура", "Позиция", "Назначение", "Description", "Goods"];
      let titleCol = findBestMatch(headers, titleKeywords);
      if (titleCol) { newMapping.title = titleCol; usedColumns.add(titleCol); }

      // Late fallback for Name if still missing
      if (!newMapping.contact_name) {
           // Find a text column that is NOT the title
           const textCols = headers.filter(h => !usedColumns.has(h) && checkColumnType(h, 'text') > 0.5);
           if (textCols.length > 0) {
               newMapping.contact_name = textCols[0];
               usedColumns.add(textCols[0]);
           }
      }

      // Late fallback for Title if still missing
      if (!newMapping.title) {
           // Find another text column?
           const textCols = headers.filter(h => !usedColumns.has(h) && checkColumnType(h, 'text') > 0.5);
           if (textCols.length > 0) {
               newMapping.title = textCols[0];
               usedColumns.add(textCols[0]);
           }
      }

      // Update state for UI
      setMapping(newMapping);
      setAmountColumns(newAmountCols);

      return { newMapping, newAmountCols };
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        // Filter out empty headers to avoid SelectItem error
        const validHeaders = (results.meta.fields || []).filter(h => h && h.trim().length > 0);
        setHeaders(validHeaders);
        
        // Auto-detect mapping!
        const autoConfig = autoMapHeaders(validHeaders, results.data.slice(0, 10)); // Pass first 10 rows for analysis
        
        // AUTO-PILOT: Directly start processing!
        toast.info(`v3.4 Импорт: Клиент=${autoConfig.newMapping.contact_name || 'Не определено'}, Сумма=${autoConfig.newAmountCols.join('+') || 'Не определено'}`);
        
        // Use a small timeout to let state updates settle if needed, or pass directly
        // We pass directly to avoid race conditions
        processImport(results.data, autoConfig.newMapping, autoConfig.newAmountCols);
      },
      error: (error) => {
        toast.error('Ошибка чтения CSV: ' + error.message);
      }
    });
  };

  const handleMapChange = (field: string, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value === '__none__' ? '' : value }));
  };

  const toggleColumn = (column: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(column)) {
      setList(list.filter(c => c !== column));
    } else {
      setList([...list, column]);
    }
  };

  const parseDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString();
    
    // Normalize separator
    const cleanStr = dateStr.trim().replace(/[/\-]/g, '.');
    
    // Try to parse DD.MM.YYYY
    const parts = cleanStr.split('.');
    if (parts.length === 3) {
      // Check if first part looks like year (4 digits) -> YYYY.MM.DD
      if (parts[0].length === 4) {
         const year = parseInt(parts[0], 10);
         const month = parseInt(parts[1], 10) - 1;
         const day = parseInt(parts[2], 10);
         const date = new Date(year, month, day);
         if (!isNaN(date.getTime())) return date.toISOString();
      } else {
         // Assume DD.MM.YYYY
         const day = parseInt(parts[0], 10);
         const month = parseInt(parts[1], 10) - 1; // JS months are 0-based
         const year = parseInt(parts[2], 10);
         
         // Handle 2-digit year
         const fullYear = year < 100 ? 2000 + year : year;
         
         const date = new Date(fullYear, month, day);
         if (!isNaN(date.getTime())) {
           return date.toISOString();
         }
      }
    }
    
    // Fallback to standard parse
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString();
  };

  const parseAmount = (row: any, cols: string[]): number => {
    let total = 0;
    cols.forEach(col => {
      const val = row[col];
      if (val) {
        let cleanVal = val.toString().trim();
        
        // Remove spaces (thousand separators) and non-numeric chars except . , -
        cleanVal = cleanVal.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
        
        // Handle comma vs dot
        if (cleanVal.includes(',') && !cleanVal.includes('.')) {
             // Ambiguous: 100,200 (100k) or 100,20 (100.20)?
             // Heuristic: Check digits after comma
             const parts = cleanVal.split(',');
             if (parts.length === 2 && parts[1].length === 2) {
                 // Likely decimal: 100,20 -> 100.20
                 cleanVal = cleanVal.replace(',', '.');
             } else if (parts.length === 2 && parts[1].length === 3) {
                 // Likely thousand separator: 100,200 -> 100200
                 cleanVal = cleanVal.replace(',', '');
             } else {
                 // Default to decimal for safety in RU context
                 cleanVal = cleanVal.replace(',', '.');
             }
        } else if (cleanVal.includes(',') && cleanVal.includes('.')) {
             const lastDot = cleanVal.lastIndexOf('.');
             const lastComma = cleanVal.lastIndexOf(',');
             if (lastComma > lastDot) {
                 // 1.000,00 -> remove dots, replace comma with dot
                 cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
             } else {
                 // 1,000.00 -> remove commas
                 cleanVal = cleanVal.replace(/,/g, '');
             }
        }

        const num = parseFloat(cleanVal);
        if (!isNaN(num)) {
          total += num;
        }
      }
    });
    return total;
  };

  const parsePhone = (raw: string): { phone: string, address: string } => {
    if (!raw) return { phone: '', address: '' };
    // Try to find a phone number pattern: +998... or 998... or just digits > 7
    // Regex for phone: (\+?\d[\d\-\s]{7,})
    const phoneMatch = raw.match(/(\+?[0-9][0-9\-\s()]{6,})/);
    
    if (phoneMatch) {
        const phone = phoneMatch[0].replace(/[^0-9+]/g, '');
        // The address is everything else
        const address = raw.replace(phoneMatch[0], '').trim().replace(/^[,;\s]+|[,;\s]+$/g, '');
        return { phone, address };
    }
    
    return { phone: '', address: raw };
  };

  const processImport = async (
      dataToProcess = csvData, 
      mappingConfig = mapping, 
      amtCols = amountColumns
    ) => {
    
    // Ensure we have a stage
    // For WON deals, try to put them in the LAST stage if possible, or "Won" stage if exists
    let activeStageId = defaultStageId;
    if (stages.length > 0) {
         // Try to find a stage named "Won", "Completed", "Done"
         const wonStage = stages.find(s => ['won', 'completed', 'done', 'closed', 'завершено', 'успешно'].some(k => s.name.toLowerCase().includes(k)));
         if (wonStage) {
             activeStageId = wonStage.id;
         } else {
             // Fallback to the LAST stage
             activeStageId = stages[stages.length - 1].id;
         }
    }

    if (!activeStageId) {
      toast.error('Ошибка: Не найдены этапы воронки. Пожалуйста, создайте воронку.');
      return;
    }

    setIsProcessing(true);
    setStep(3);
    
    let successCount = 0;
    let failCount = 0;
    const total = dataToProcess.length;

    // FIND COLUMNS FOR EXTRA DATA based on User Request
    // "Источник", "Характеристика", "Кол-во"
    const headers = Object.keys(dataToProcess[0] || {});
    const sourceCol = headers.find(h => h.toLowerCase().includes("источник"));
    const skuCol = headers.find(h => h.toLowerCase().includes("характеристика") || h.toLowerCase().includes("артикул"));
    const qtyCol = headers.find(h => h.toLowerCase().includes("кол-во") || h.toLowerCase().includes("количество") || h.toLowerCase().includes("qty"));
    
    // Since mappingConfig.contact_phone might be "Адрес/контакты", we use it for extraction
    
    for (let i = 0; i < total; i++) {
      const row = dataToProcess[i];
      try {
        // 1. Handle Contact & Address extraction
        // If the mapped phone column is the "Address/Contacts" combined column, parse it
        let contactPhone = '';
        let contactAddress = '';
        
        const rawPhoneField = row[mappingConfig.contact_phone];
        if (rawPhoneField) {
            const parsed = parsePhone(rawPhoneField);
            contactPhone = parsed.phone;
            contactAddress = parsed.address;
        }

        // 2. Handle Company
        let companyId = null;
        let companyName = row[mappingConfig.company_name];
        
        // Fallback: If no company name is mapped/present, use Contact Name as Company Name (Individual Client)
        if (!companyName && row[mappingConfig.contact_name]) {
            companyName = row[mappingConfig.contact_name];
        }

        if (companyName) {
          const { data: existingCompany } = await crm
            .from('companies')
            .select('id')
            .ilike('name', companyName.trim())
            .maybeSingle();
          
          if (existingCompany) {
            companyId = existingCompany.id;
          } else {
            const { data: newCompany, error: companyError } = await crm
              .from('companies')
              .insert({ name: companyName.trim() })
              .select('id')
              .single();
            if (companyError) {
                 console.error("Company create error", companyError);
                 // Don't throw, try to continue without linking or fallback
            } else {
                 companyId = newCompany.id;
            }
          }
        }

        // 3. Handle Contact
        let contactId = null;
        const contactName = row[mappingConfig.contact_name];
        
        // Strategy: search by phone first, then by name
        if (contactName || contactPhone) {
           let existingContact = null;
           
           if (contactPhone) {
             const { data } = await crm.from('contacts').select('id').eq('phone', contactPhone).maybeSingle();
             existingContact = data;
           }

           if (!existingContact && contactName) {
                // Fallback: Search by Name (First + Last or just First)
                const parts = contactName.trim().split(' ');
                if (parts.length >= 2) {
                    const fName = parts[0];
                    const lName = parts.slice(1).join(' ');
                    const { data } = await crm.from('contacts')
                        .select('id')
                        .ilike('first_name', fName)
                        .ilike('last_name', lName)
                        .maybeSingle();
                    existingContact = data;
                } else {
                    const { data } = await crm.from('contacts')
                        .select('id')
                        .ilike('first_name', parts[0])
                        .maybeSingle();
                     existingContact = data;
                }
           }
           
           if (existingContact) {
             contactId = existingContact.id;
           } else {
             // Create new contact
             const [firstName, ...lastNameParts] = (contactName || 'Client').trim().split(' ');
             const lastName = lastNameParts.join(' ');
             
             // Prepare contact payload
             const contactPayload: any = {
                 first_name: firstName || 'Client',
                 last_name: lastName || '',
                 phone: contactPhone || null,
                 company_id: companyId
             };
             
             // NOTE: Address is NOT supported in 'contacts' table schema.
             // We have moved address info to the deal title.

             const { data: newContact, error: contactError } = await crm
               .from('contacts')
               .insert(contactPayload)
               .select('id')
               .single();
               
              if (contactError) {
                  console.error("Contact create error", contactError);
              } else {
                  contactId = newContact ? newContact.id : null;
              }
           }
        }

        // 4. Create Deal
        const title = row[mappingConfig.title] || (companyName ? `Продажа: ${companyName}` : `Сделка #${i+1}`);
        const amount = parseAmount(row, amtCols);
        const createdAt = parseDate(row[mappingConfig.created_at]);
        
        // Prepare Description / Note
        // Since 'description' column might not exist, we append details to the Title or just log it.
        // We will format the title to include key info.
        const descParts = [];
        if (sourceCol && row[sourceCol]) descParts.push(`Ист: ${row[sourceCol]}`);
        if (skuCol && row[skuCol]) descParts.push(`Арт: ${row[skuCol]}`);
        if (qtyCol && row[qtyCol]) descParts.push(`Кол: ${row[qtyCol]}`);
        if (contactAddress) descParts.push(`Адр: ${contactAddress}`);
        
        const extraInfo = descParts.join(', ');
        const fullTitle = extraInfo ? `${title} (${extraInfo})` : title;

        // Determine status
        // Force WON if amount > 0
        let status = 'won'; 
        
        // CHECK FOR DUPLICATE DEAL
        const { data: duplicateDeal } = await crm.from('deals')
            .select('id')
            .eq('title', fullTitle)
            .eq('contact_id', contactId)
            .eq('amount', amount)
            .eq('created_at', createdAt)
            .maybeSingle();

        if (duplicateDeal) {
            console.log(`Skipping duplicate deal: ${fullTitle}`);
            successCount++; 
            continue;
        }

        const dealPayload: any = {
          title: fullTitle, // Use the enriched title
          amount: amount,
          stage_id: activeStageId,
          status: status,
          company_id: companyId,
          contact_id: contactId,
          created_at: createdAt,
          close_date: status === 'won' ? createdAt : null
        };
        
        // NOTE: Description is NOT supported in 'deals' table schema.
        // We have moved description info to the deal title.

        const { error: dealError } = await crm.from('deals').insert(dealPayload);

        if (dealError) throw dealError;
        successCount++;

      } catch (error) {
        console.error('Row error:', error);
        failCount++;
      }

      // Update progress
      if (i % 5 === 0) { 
        setProgress(Math.round(((i + 1) / total) * 100));
      }
    }

    setImportStats({ total, success: successCount, failed: failCount });
    setIsProcessing(false);
    toast.success('Импорт завершен');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in-fade pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Умный импорт</h1>
          <p className="text-slate-500 text-sm mt-1">Загрузите исторические данные для построения аналитики</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/database')}>
          Назад к базе
        </Button>
      </div>

      {/* Steps Indicator - Hidden or Simplified since user wants 0-click */}
      <div className="flex items-center justify-center gap-4 text-sm font-medium text-slate-500 opacity-50">
        {step < 3 && <p>Автоматический режим</p>}
      </div>

      {step === 1 && (
        <Card className="border-dashed border-2 shadow-none bg-slate-50/50">
          <CardContent className="p-12">
            <div {...getRootProps()} className="flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-100/50 transition-colors rounded-xl p-8">
              <input {...getInputProps()} />
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mb-6">
                 {isDragActive ? <Upload className="w-8 h-8 text-blue-500" /> : <FileSpreadsheet className="w-8 h-8 text-slate-400" />}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {isDragActive ? 'Перетащите файл сюда' : 'Нажмите или перетащите CSV файл'}
              </h3>
              <p className="text-slate-500 text-sm max-w-sm">
                Просто перетащите файл. Система сама найдет клиентов, даты и суммы, и добавит всё в базу.
              </p>
              <Button className="mt-6" variant="secondary">Выбрать файл</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 is now SKIPPED in UI rendering, though state logic exists */}

      {step === 3 && (
        <Card className="text-center py-16">
          <CardContent className="space-y-6 max-w-md mx-auto">
             {!isProcessing ? (
               <>
                 <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900">Готово!</h2>
                 <p className="text-slate-500">Данные успешно добавлены в историю продаж.</p>
                 <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-slate-50 p-3 rounded-lg">
                       <div className="text-2xl font-bold text-slate-900">{importStats.total}</div>
                       <div className="text-xs text-slate-500">Всего</div>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-lg">
                       <div className="text-2xl font-bold text-emerald-600">{importStats.success}</div>
                       <div className="text-xs text-emerald-600">Успешно</div>
                    </div>
                    <div className="bg-rose-50 p-3 rounded-lg">
                       <div className="text-2xl font-bold text-rose-600">{importStats.failed}</div>
                       <div className="text-xs text-rose-600">Ошибки</div>
                    </div>
                 </div>
                 <Button className="w-full mt-4" onClick={() => navigate('/database')}>Перейти к базе данных</Button>
               </>
             ) : (
               <>
                 <div className="w-16 h-16 bg-slate-100 text-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
                    <Loader2 className="w-8 h-8" />
                 </div>
                 <h2 className="text-xl font-bold text-slate-900">Обработка данных...</h2>
                 <p className="text-slate-500">Умный алгоритм раскладывает всё по полочкам</p>
                 <Progress value={progress} className="h-2" />
                 <p className="text-xs text-slate-400">{progress}% завершено</p>
               </>
             )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
