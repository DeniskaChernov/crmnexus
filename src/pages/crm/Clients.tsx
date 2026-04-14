import React, { useEffect, useState } from 'react';
import { crm } from "@/lib/crmClient.ts";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger,
  DialogFooter
} from '../../components/ui/dialog';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '../../components/ui/sheet';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, Search, Phone, Mail, Trash2, Pencil, User, ShoppingBag, Banknote, ArrowUpRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useIsMobile } from '../../components/ui/use-mobile';

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  company_id: string; // Direct link
  createdAt: string;
}

interface Deal {
  id: string;
  title: string;
  amount: number;
  status: 'open' | 'won' | 'lost';
  created_at: string;
  company_id?: string;
  contact_id?: string;
}

type SortField = 'name' | 'orders' | 'ltv';
type SortDirection = 'asc' | 'desc' | null;

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Sort States
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', notes: '' });
  
  // Details Sheet State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const isMobile = useIsMobile();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch companies (clients)
      const { data: companiesData, error: companiesError } = await crm
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (companiesError) throw companiesError;

      // 2. Fetch Contacts to map company relationships
      const { data: contactsData, error: contactsError } = await crm
        .from('contacts')
        .select('id, company_id');

      if (contactsError) throw contactsError;

      // 3. Fetch deals for LTV calc
      const { data: dealsData, error: dealsError } = await crm
        .from('deals')
        .select('id, title, amount, status, created_at, company_id, contact_id');

      if (dealsError) throw dealsError;

      if (companiesData) {
        const mappedClients: Client[] = companiesData.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone || '',
            email: c.email || '', 
            notes: c.notes || '',
            company_id: c.id, // It's the same
            createdAt: c.created_at
        }));
        setClients(mappedClients);
      }
      
      if (contactsData) {
        setContacts(contactsData);
      }
      
      if (dealsData) {
        setDeals(dealsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Не удалось загрузить список клиентов");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Имя клиента обязательно");
      return;
    }

    try {
      const payload = {
          name: formData.name,
          phone: formData.phone,
          // email: formData.email, // Check if table supports this
          // notes: formData.notes
      };
      
      let error;
      
      if (editingClient) {
          const { error: err } = await crm
            .from('companies')
            .update(payload)
            .eq('id', editingClient.id);
          error = err;
      } else {
          const { error: err } = await crm
            .from('companies')
            .insert(payload);
          error = err;
      }

      if (error) throw error;

      toast.success(editingClient ? "Клиент обновлен" : "Клиент создан");
      setIsAddOpen(false);
      setEditingClient(null);
      setFormData({ name: '', phone: '', email: '', notes: '' });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка при сохранении");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены? Удалятся также все сделки этого клиента.")) return;

    try {
      const { error } = await crm
        .from('companies')
        .delete()
        .eq('id', id);
        
      if (error) throw error;

      toast.success("Клиент удален");
      setClients(clients.filter(c => c.id !== id));
      if (selectedClient?.id === id) setSelectedClient(null);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка при удалении");
    }
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email,
      notes: client.notes
    });
    setIsAddOpen(true);
  };

  const openAdd = () => {
    setEditingClient(null);
    setFormData({ name: '', phone: '', email: '', notes: '' });
    setIsAddOpen(true);
  };

  const getClientDeals = (client: Client) => {
    // Get contact IDs that belong to this company
    const companyContactIds = contacts
      .filter(contact => contact.company_id === client.company_id)
      .map(contact => contact.id);

    // Filter deals that match either:
    // 1. company_id matches this client's company_id
    // 2. contact_id matches any contact that belongs to this company
    return deals.filter(deal => 
      deal.company_id === client.company_id || 
      (deal.contact_id && companyContactIds.includes(deal.contact_id))
    );
  };

  const getClientStats = (client: Client) => {
    const clientDeals = getClientDeals(client);
    const wonDeals = clientDeals.filter(d => d.status === 'won');
    
    const totalSpent = wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const lastOrder = wonDeals.length > 0 
      ? new Date(Math.max(...wonDeals.map(d => new Date(d.created_at).getTime()))) 
      : null;

    return { totalDeals: clientDeals.length, wonDeals: wonDeals.length, ltv: totalSpent, lastOrder };
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  const sortedClients = filteredClients.sort((a, b) => {
    if (!sortField) return 0;
    if (sortField === 'name') {
      return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    } else if (sortField === 'orders') {
      const aStats = getClientStats(a);
      const bStats = getClientStats(b);
      return sortDirection === 'asc' ? aStats.wonDeals - bStats.wonDeals : bStats.wonDeals - aStats.wonDeals;
    } else if (sortField === 'ltv') {
      const aStats = getClientStats(a);
      const bStats = getClientStats(b);
      return sortDirection === 'asc' ? aStats.ltv - bStats.ltv : bStats.ltv - aStats.ltv;
    }
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">База Клиентов</h1>
          <p className="text-slate-500">Управление контактами и LTV аналитика</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Добавить клиента
        </Button>
      </div>

      <div className="relative group max-w-sm w-full">
        {/* Декоративная подложка с "дорогой" тенью */}
        <div className="absolute inset-0 bg-white rounded-full shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50 transition-shadow duration-300 group-hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)]"></div>
        
        <div className="relative flex items-center px-4 py-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2 transition-colors group-hover:text-slate-500" />
          <Input 
            placeholder="Поиск по имени, телефону..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-none shadow-none focus-visible:ring-0 h-auto p-0 bg-transparent text-slate-600 placeholder:text-slate-400/80 text-sm font-medium w-full"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        {isMobile ? (
          <div className="space-y-4 p-4">
             {loading ? (
                <div className="text-center py-8 text-slate-500">Загрузка...</div>
             ) : sortedClients.length === 0 ? (
                <div className="text-center py-8 text-slate-500">Клиенты не найдены</div>
             ) : (
                sortedClients.map(client => {
                   const stats = getClientStats(client);
                   return (
                      <Card key={client.id} onClick={() => setSelectedClient(client)} className="shadow-none border border-slate-200">
                         <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                               <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                     {client.name.slice(0,2).toUpperCase()}
                                  </div>
                                  <div>
                                     <div className="font-medium text-slate-900">{client.name}</div>
                                     <div className="text-xs text-slate-500">{client.phone}</div>
                                  </div>
                               </div>
                            </div>
                            <div className="flex justify-between items-center text-sm border-t border-slate-100 pt-3">
                                <div className="flex flex-col">
                                   <span className="text-xs text-slate-500">LTV</span>
                                   <span className="font-bold text-green-700">{stats.ltv.toLocaleString('ru-RU', { notation: "compact" })} UZS</span>
                                </div>
                                <div className="flex gap-2">
                                   <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); openEdit(client); }}>
                                     <Pencil className="w-4 h-4 text-slate-400" />
                                   </Button>
                                   <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }}>
                                     <Trash2 className="w-4 h-4 text-slate-400" />
                                   </Button>
                                </div>
                            </div>
                         </CardContent>
                      </Card>
                   );
                })
             )}
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-slate-50 select-none" 
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Имя Клиента
                  {sortField === 'name' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-4 h-4 text-blue-600" />
                    ) : (
                      <ArrowDown className="w-4 h-4 text-blue-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-4 h-4 text-slate-300" />
                  )}
                </div>
              </TableHead>
              <TableHead>Контакты</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-slate-50 select-none" 
                onClick={() => handleSort('orders')}
              >
                <div className="flex items-center gap-2">
                  Заказов (Успешных)
                  {sortField === 'orders' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-4 h-4 text-blue-600" />
                    ) : (
                      <ArrowDown className="w-4 h-4 text-blue-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-4 h-4 text-slate-300" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-slate-50 select-none" 
                onClick={() => handleSort('ltv')}
              >
                <div className="flex items-center gap-2">
                  LTV (Сумма)
                  {sortField === 'ltv' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-4 h-4 text-blue-600" />
                    ) : (
                      <ArrowDown className="w-4 h-4 text-blue-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-4 h-4 text-slate-300" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                 <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                       Загрузка...
                    </TableCell>
                  </TableRow>
            ) : sortedClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  Клиенты не найдены
                </TableCell>
              </TableRow>
            ) : (
              sortedClients.map(client => {
                const stats = getClientStats(client);
                return (
                  <TableRow key={client.id} className="group cursor-pointer hover:bg-slate-50" onClick={() => setSelectedClient(client)}>
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                          {client.name.slice(0,2).toUpperCase()}
                        </div>
                        {client.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm text-slate-500">
                        {client.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {client.phone}
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {client.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100">
                        {stats.wonDeals} / {stats.totalDeals}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-green-700">
                        {stats.ltv.toLocaleString('ru-RU')} UZS
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(client)}>
                          <Pencil className="w-4 h-4 text-slate-400 hover:text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(client.id)}>
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Редактировать клиента' : 'Новый клиент'}</DialogTitle>
            <DialogDescription>
              {editingClient ? 'Измените данные клиента ниже' : 'Заполните информацию о новом клиенте'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Имя (как в сделках)</Label>
              <Input 
                placeholder="Например: ООО Ромашка" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input 
                placeholder="+998..." 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Details Sheet */}
      <Sheet open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <SheetContent className="w-full sm:max-w-[800px] overflow-y-auto">
          {selectedClient && (() => {
             const stats = getClientStats(selectedClient);
             const clientDeals = getClientDeals(selectedClient).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

             return (
              <div className="space-y-6">
                <SheetHeader>
                  <SheetTitle className="text-xl">{selectedClient.name}</SheetTitle>
                  <SheetDescription>Карточка клиента</SheetDescription>
                </SheetHeader>

                <div className="grid grid-cols-2 gap-4 px-6">
                   <Card>
                     <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-600">{stats.ltv.toLocaleString('ru-RU')} UZS</div>
                        <p className="text-xs text-muted-foreground">LTV (Всего покупок)</p>
                     </CardContent>
                   </Card>
                   <Card>
                     <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{stats.wonDeals}</div>
                        <p className="text-xs text-muted-foreground">Успешных сделок</p>
                     </CardContent>
                   </Card>
                </div>

                <div className="space-y-4 px-6">
                  <h3 className="font-medium flex items-center gap-2"><User className="w-4 h-4" /> Контакты</h3>
                  <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Телефон:</span>
                      <span className="font-medium">{selectedClient.phone || '-'}</span>
                    </div>
                    {/* Add more fields if available in companies table */}
                  </div>
                </div>

                <div className="space-y-4 px-6">
                  <h3 className="font-medium flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> История заказов</h3>
                  <div className="space-y-2">
                    {clientDeals.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">Нет сделок с таким именем</p>
                    ) : (
                      clientDeals.map(deal => (
                        <div key={deal.id} className="border rounded-lg p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                           <div>
                              <div className="font-medium text-sm">{deal.title}</div>
                              <div className="text-xs text-slate-500">{new Date(deal.created_at).toLocaleDateString()}</div>
                           </div>
                           <div className="text-right">
                              <div className="font-bold text-sm">{deal.amount?.toLocaleString('ru-RU')} UZS</div>
                              <Badge variant="outline" className={`text-xs ${
                                deal.status === 'won' ? 'text-green-600 border-green-200 bg-green-50' :
                                deal.status === 'lost' ? 'text-red-600 border-red-200 bg-red-50' :
                                'text-blue-600 border-blue-200 bg-blue-50'
                              }`}>
                                {deal.status === 'won' ? 'Успех' : deal.status === 'lost' ? 'Проигрыш' : 'В работе'}
                              </Badge>
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
             );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}