import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { Search, Briefcase, Building2, Users, CheckSquare, TrendingUp } from 'lucide-react';
import { crm } from "@/lib/crmClient.ts";
import { Badge } from './ui/badge';

interface SearchResult {
  id: string;
  type: 'deal' | 'company' | 'contact' | 'task';
  title: string;
  subtitle?: string;
  status?: string;
  amount?: number;
  url: string;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search across all entities
  useEffect(() => {
    const searchData = async () => {
      if (!search || search.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      const searchResults: SearchResult[] = [];

      try {
        // Search deals
        const { data: deals } = await crm
          .from('deals')
          .select('id, title, amount, status, companies(name)')
          .or(`title.ilike.%${search}%`)
          .limit(5);

        deals?.forEach(deal => {
          searchResults.push({
            id: deal.id,
            type: 'deal',
            title: deal.title,
            subtitle: deal.companies?.name,
            status: deal.status,
            amount: deal.amount,
            url: '/deals'
          });
        });

        // Search companies
        const { data: companies } = await crm
          .from('companies')
          .select('id, name, industry')
          .or(`name.ilike.%${search}%,industry.ilike.%${search}%`)
          .limit(5);

        companies?.forEach(company => {
          searchResults.push({
            id: company.id,
            type: 'company',
            title: company.name,
            subtitle: company.industry,
            url: '/companies'
          });
        });

        // Search contacts
        const { data: contacts } = await crm
          .from('contacts')
          .select('id, first_name, last_name, email, position, companies(name)')
          .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,position.ilike.%${search}%`)
          .limit(5);

        contacts?.forEach(contact => {
          searchResults.push({
            id: contact.id,
            type: 'contact',
            title: `${contact.first_name} ${contact.last_name}`,
            subtitle: contact.companies?.name || contact.email,
            url: '/contacts'
          });
        });

        // Search tasks
        const { data: tasks } = await crm
          .from('tasks')
          .select('id, title, status, priority')
          .or(`title.ilike.%${search}%,description.ilike.%${search}%`)
          .limit(5);

        tasks?.forEach(task => {
          searchResults.push({
            id: task.id,
            type: 'task',
            title: task.title,
            status: task.status,
            url: '/tasks'
          });
        });

        setResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchData, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'deal': return <Briefcase className="h-4 w-4" />;
      case 'company': return <Building2 className="h-4 w-4" />;
      case 'contact': return <Users className="h-4 w-4" />;
      case 'task': return <CheckSquare className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return '';
    
    switch (status) {
      case 'won': return 'bg-green-100 text-green-800';
      case 'lost': return 'bg-red-100 text-red-800';
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'planned': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (type: string, status?: string) => {
    if (!status) return '';
    
    if (type === 'deal') {
      switch (status) {
        case 'won': return 'Выиграна';
        case 'lost': return 'Проиграна';
        case 'open': return 'Открыта';
        default: return status;
      }
    }
    
    if (type === 'task') {
      switch (status) {
        case 'completed': return 'Выполнена';
        case 'in_progress': return 'В работе';
        case 'planned': return 'Запланирована';
        default: return status;
      }
    }
    
    return status;
  };

  const handleSelect = (result: SearchResult) => {
    navigate(result.url);
    setOpen(false);
    setSearch('');
  };

  const groupedResults = {
    deals: results.filter(r => r.type === 'deal'),
    companies: results.filter(r => r.type === 'company'),
    contacts: results.filter(r => r.type === 'contact'),
    tasks: results.filter(r => r.type === 'task'),
  };

  return (
    <CommandDialog 
      open={open} 
      onOpenChange={setOpen}
      title="Глобальный поиск"
      description="Поиск сделок, компаний, контактов и задач в системе CRM"
    >
      <CommandInput 
        placeholder="Поиск сделок, компаний, контактов, задач..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {!search && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Начните вводить для поиска...
            <div className="mt-2 flex items-center justify-center gap-1 text-xs">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
              для быстрого доступа
            </div>
          </div>
        )}

        {search && results.length === 0 && !loading && (
          <CommandEmpty>Ничего не найдено</CommandEmpty>
        )}

        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Поиск...
          </div>
        )}

        {groupedResults.deals.length > 0 && (
          <CommandGroup heading="Сделки">
            {groupedResults.deals.map((result) => (
              <CommandItem
                key={result.id}
                onSelect={() => handleSelect(result)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100">
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{result.title}</span>
                      {result.status && (
                        <Badge variant="outline" className={`text-xs ${getStatusColor(result.status)}`}>
                          {getStatusLabel(result.type, result.status)}
                        </Badge>
                      )}
                    </div>
                    {result.subtitle && (
                      <div className="text-xs text-muted-foreground">{result.subtitle}</div>
                    )}
                    {result.amount && (
                      <div className="text-xs text-green-600 font-medium">
                        {result.amount.toLocaleString('uz-UZ')} UZS
                      </div>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {groupedResults.companies.length > 0 && (
          <CommandGroup heading="Компании">
            {groupedResults.companies.map((result) => (
              <CommandItem
                key={result.id}
                onSelect={() => handleSelect(result)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100">
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-xs text-muted-foreground">{result.subtitle}</div>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {groupedResults.contacts.length > 0 && (
          <CommandGroup heading="Контакты">
            {groupedResults.contacts.map((result) => (
              <CommandItem
                key={result.id}
                onSelect={() => handleSelect(result)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100">
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-xs text-muted-foreground">{result.subtitle}</div>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {groupedResults.tasks.length > 0 && (
          <CommandGroup heading="Задачи">
            {groupedResults.tasks.map((result) => (
              <CommandItem
                key={result.id}
                onSelect={() => handleSelect(result)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100">
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{result.title}</span>
                      {result.status && (
                        <Badge variant="outline" className={`text-xs ${getStatusColor(result.status)}`}>
                          {getStatusLabel(result.type, result.status)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}