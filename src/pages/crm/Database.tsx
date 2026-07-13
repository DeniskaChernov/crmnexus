import React, { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import Clients from './Clients';
import Companies from './Companies';
import Contacts from './Contacts';
import { Users, Building2, UserCircle, Upload } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../components/ui/use-mobile';
import { TaskLabPage } from '../../components/tasklab';

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

  const activeTabContent = useMemo(() => {
    if (activeTab === 'clients') return <Clients />;
    if (activeTab === 'companies') return <Companies />;
    return <Contacts />;
  }, [activeTab]);

  return (
    <TaskLabPage
      tag="Клиенты"
      title="Клиенты"
      subtitle="Компании, контакты и карточки клиентов"
      actions={
        <Button variant="outline" onClick={() => navigate('/import')} className="rounded-[1.75rem] shrink-0">
          <Upload className="w-4 h-4 mr-2" />
          Импорт данных
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-5">
        <div className="flex items-center w-full overflow-x-auto pb-2 md:pb-0">
          <TabsList className="bg-neutral-100/50 p-1 rounded-[1.75rem] border border-neutral-200/60 inline-flex h-auto w-full md:w-auto gap-1">
            <TabsTrigger 
              value="clients" 
              className="flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 text-neutral-500 hover:text-neutral-700"
            >
              <UserCircle className="w-4 h-4 mr-2" />
              <span className={isMobile ? "text-xs" : ""}>Клиенты</span>
            </TabsTrigger>
            <TabsTrigger 
              value="companies" 
              className="flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 text-neutral-500 hover:text-neutral-700"
            >
              <Building2 className="w-4 h-4 mr-2" />
              <span className={isMobile ? "text-xs" : ""}>Компании</span>
            </TabsTrigger>
            <TabsTrigger 
              value="contacts" 
              className="flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 text-neutral-500 hover:text-neutral-700"
            >
              <Users className="w-4 h-4 mr-2" />
              <span className={isMobile ? "text-xs" : ""}>Контакты</span>
            </TabsTrigger>
          </TabsList>
        </div>
        
        <div
          key={activeTab}
          className="mt-0 focus-visible:ring-0 animate-in fade-in slide-in-from-bottom-1 duration-300"
        >
          {activeTabContent}
        </div>
      </Tabs>
    </TaskLabPage>
  );
}
