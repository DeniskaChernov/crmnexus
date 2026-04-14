import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import Clients from './Clients';
import Companies from './Companies';
import Contacts from './Contacts';
import { Users, Building2, UserCircle, Database as DatabaseIcon, Upload } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../components/ui/use-mobile';

export default function Database() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('crm_database_tab') || 'clients';
  });

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem('crm_database_tab', value);
  };

  return (
    <div className="space-y-6 animate-in-fade">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                    <DatabaseIcon className="w-4 h-4 text-slate-600" />
                </div>
                База данных
            </h1>
            <p className="text-slate-500 text-sm mt-1 ml-11">Управление клиентами и контрагентами</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/import')} className="w-full md:w-auto">
            <Upload className="w-4 h-4 mr-2" />
            Импорт данных
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
        <div className="flex items-center w-full overflow-x-auto pb-2 md:pb-0">
          <TabsList className="bg-slate-100/50 p-1 rounded-xl border border-slate-200/60 inline-flex h-auto w-full md:w-auto gap-1">
            <TabsTrigger 
              value="clients" 
              className="flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 text-slate-500 hover:text-slate-700"
            >
              <UserCircle className="w-4 h-4 mr-2" />
              <span className={isMobile ? "text-xs" : ""}>Клиенты</span>
            </TabsTrigger>
            <TabsTrigger 
              value="companies" 
              className="flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 text-slate-500 hover:text-slate-700"
            >
              <Building2 className="w-4 h-4 mr-2" />
              <span className={isMobile ? "text-xs" : ""}>Компании</span>
            </TabsTrigger>
            <TabsTrigger 
              value="contacts" 
              className="flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 text-slate-500 hover:text-slate-700"
            >
              <Users className="w-4 h-4 mr-2" />
              <span className={isMobile ? "text-xs" : ""}>Контакты</span>
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="clients" className="mt-0 focus-visible:ring-0">
           <Clients /> 
        </TabsContent>
        <TabsContent value="companies" className="mt-0 focus-visible:ring-0">
           <Companies />
        </TabsContent>
        <TabsContent value="contacts" className="mt-0 focus-visible:ring-0">
           <Contacts />
        </TabsContent>
      </Tabs>
    </div>
  );
}
