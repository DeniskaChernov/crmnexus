import React, { useEffect, useState } from 'react';
import { crm } from "@/lib/crmClient.ts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ShoppingBag, User, Phone, Calendar, ArrowUpRight, HelpCircle } from 'lucide-react';
import { Separator } from '../ui/separator';

interface ClientDetailsSheetProps {
  contactId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClientStats {
  totalSpent: number;
  successfulDeals: number;
}

export function ClientDetailsSheet({ contactId, open, onOpenChange }: ClientDetailsSheetProps) {
  const [contact, setContact] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [stats, setStats] = useState<ClientStats>({ totalSpent: 0, successfulDeals: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && contactId) {
      fetchClientDetails();
    }
  }, [open, contactId]);

  const fetchClientDetails = async () => {
    setLoading(true);
    try {
      // Fetch contact info
      const { data: contactData, error: contactError } = await crm
        .from('contacts')
        .select('*, companies(name, id)')
        .eq('id', contactId)
        .single();

      if (contactError) throw contactError;
      setContact(contactData);

      // Fetch ALL deals related to this contact
      // This includes:
      // 1. Deals directly linked to this contact (contact_id)
      // 2. Deals linked to the company this contact belongs to (company_id)
      let dealsData: any[] = [];
      
      // Query 1: Get deals by contact_id
      const { data: contactDeals, error: contactDealsError } = await crm
        .from('deals')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (contactDealsError) throw contactDealsError;
      
      if (contactDeals) {
        dealsData = [...contactDeals];
      }

      // Query 2: If contact has a company, also get deals by company_id
      if (contactData?.company_id) {
        const { data: companyDeals, error: companyDealsError } = await crm
          .from('deals')
          .select('*')
          .eq('company_id', contactData.company_id)
          .order('created_at', { ascending: false });

        if (companyDealsError) throw companyDealsError;
        
        if (companyDeals) {
          // Merge and deduplicate deals (in case a deal has both contact_id and company_id)
          const dealIds = new Set(dealsData.map(d => d.id));
          companyDeals.forEach(deal => {
            if (!dealIds.has(deal.id)) {
              dealsData.push(deal);
              dealIds.add(deal.id);
            }
          });
          
          // Re-sort by created_at descending
          dealsData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
      }

      setDeals(dealsData);

      // Calculate stats
      const successfulDeals = dealsData.filter((d: any) => d.status === 'won');
      const totalSpent = successfulDeals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
      
      setStats({
        totalSpent,
        successfulDeals: successfulDeals.length
      });

    } catch (error) {
      console.error('Error fetching client details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-slate-50 p-0">
        <SheetHeader className="p-6 bg-white border-b space-y-0 text-left">
          <SheetTitle className="text-2xl font-bold text-slate-900">
            {contact ? `${contact.first_name} ${contact.last_name}` : 'Карточка клиента'}
          </SheetTitle>
          <SheetDescription className="text-slate-500">
            Карточка клиента
          </SheetDescription>
        </SheetHeader>

        {loading ? (
            <div className="flex items-center justify-center h-full p-6">
                <span className="text-muted-foreground">Загрузка...</span>
            </div>
        ) : contact ? (
            <div className="flex flex-col">
                <div className="p-6 space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="p-4 bg-white border shadow-sm">
                            <div className="text-2xl font-bold text-green-600 mb-1">
                                {formatCurrency(stats.totalSpent)}
                            </div>
                            <div className="text-xs text-muted-foreground">LTV (Всего покупок)</div>
                        </Card>
                        <Card className="p-4 bg-white border shadow-sm">
                            <div className="text-2xl font-bold text-slate-900 mb-1">
                                {stats.successfulDeals}
                            </div>
                            <div className="text-xs text-muted-foreground">Успешных сделок</div>
                        </Card>
                    </div>

                    {/* Contacts Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <User className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-900">Контакты</h3>
                        </div>
                        <Card className="p-4 bg-white border shadow-sm">
                            <div className="flex justify-between items-center py-2">
                                <span className="text-slate-500">Телефон:</span>
                                <span className="font-medium">{contact.phone || '-'}</span>
                            </div>
                            <Separator className="my-2" />
                            <div className="flex justify-between items-center py-2">
                                <span className="text-slate-500">Email:</span>
                                <span className="font-medium">{contact.email || '-'}</span>
                            </div>
                            <Separator className="my-2" />
                             <div className="flex justify-between items-center py-2">
                                <span className="text-slate-500">Компания:</span>
                                <span className="font-medium">{contact.companies?.name || '-'}</span>
                            </div>
                        </Card>
                    </div>

                    {/* Order History */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <ShoppingBag className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-900">История заказов</h3>
                        </div>
                        <div className="space-y-3">
                            {deals.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm bg-white rounded-lg border border-dashed">
                                    Нет истории заказов
                                </div>
                            ) : (
                                deals.map((deal) => (
                                    <Card key={deal.id} className="p-4 bg-white border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-medium text-slate-900">{deal.title}</div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {formatDate(deal.created_at)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-slate-900">
                                                    {formatCurrency(deal.amount)}
                                                </div>
                                                <Badge 
                                                    variant="outline" 
                                                    className={`mt-1 text-[10px] px-1.5 py-0 ${
                                                        deal.status === 'won' 
                                                            ? 'text-green-600 border-green-200 bg-green-50' 
                                                            : deal.status === 'lost'
                                                            ? 'text-red-600 border-red-200 bg-red-50'
                                                            : 'text-blue-600 border-blue-200 bg-blue-50'
                                                    }`}
                                                >
                                                    {deal.status === 'won' ? 'Успех' : deal.status === 'lost' ? 'Отмена' : 'В работе'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Floating Help Button (from design) */}
                <div className="absolute bottom-6 right-6">
                    <Button size="icon" className="rounded-full h-10 w-10 bg-slate-900 hover:bg-slate-800 shadow-lg">
                        <HelpCircle className="h-5 w-5 text-white" />
                    </Button>
                </div>
            </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}