import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
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

/** Экранируем спецсимволы шаблона LIKE на стороне клиента (сервер всё равно параметризует). */
function searchPattern(query: string): string | null {
  const raw = query.trim().slice(0, 120).replace(/[%_\\]/g, '');
  if (raw.length < 2) return null;
  return `%${raw}%`;
}

function dedupeById<T extends { id: string }>(rows: (T | null | undefined)[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (r?.id && !seen.has(r.id)) {
      seen.add(r.id);
      out.push(r);
    }
  }
  return out;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const deferredSearch = useDeferredValue(search);
  const cacheRef = useRef<Map<string, SearchResult[]>>(new Map());
  const requestIdRef = useRef(0);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    const openFromChrome = () => setOpen(true);
    window.addEventListener('crm-open-global-search', openFromChrome);
    return () => window.removeEventListener('crm-open-global-search', openFromChrome);
  }, []);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      return;
    }

    const searchData = async () => {
      const query = deferredSearch.trim().toLowerCase();
      const pattern = searchPattern(query);
      if (!pattern) {
        setResults([]);
        return;
      }

      if (cacheRef.current.has(query)) {
        setResults(cacheRef.current.get(query) || []);
        return;
      }

      const reqId = ++requestIdRef.current;
      setLoading(true);
      const searchResults: SearchResult[] = [];

      try {
        const [
          dealsRes,
          companiesNameRes,
          companiesIndustryRes,
          contactsFn,
          contactsLn,
          contactsEmail,
          tasksTitleRes,
          tasksDescRes,
        ] = await Promise.all([
          crm
            .from('deals')
            .select('id, title, amount, status, companies(name)')
            .ilike('title', pattern)
            .limit(5),
          crm.from('companies').select('id, name, industry').ilike('name', pattern).limit(5),
          crm.from('companies').select('id, name, industry').ilike('industry', pattern).limit(5),
          crm
            .from('contacts')
            .select('id, first_name, last_name, email, position, companies(name)')
            .ilike('first_name', pattern)
            .limit(5),
          crm
            .from('contacts')
            .select('id, first_name, last_name, email, position, companies(name)')
            .ilike('last_name', pattern)
            .limit(5),
          crm
            .from('contacts')
            .select('id, first_name, last_name, email, position, companies(name)')
            .ilike('email', pattern)
            .limit(5),
          crm.from('tasks').select('id, title, status, priority').ilike('title', pattern).limit(5),
          crm.from('tasks').select('id, title, status, priority').ilike('description', pattern).limit(5),
        ]);

        const deals = Array.isArray(dealsRes.data) ? dealsRes.data : [];
        deals.forEach((deal: any) => {
          searchResults.push({
            id: deal.id,
            type: 'deal',
            title: deal.title,
            subtitle: deal.companies?.name,
            status: deal.status,
            amount: deal.amount,
            url: '/deals',
          });
        });

        const companies = dedupeById([
          ...(Array.isArray(companiesNameRes.data) ? companiesNameRes.data : []),
          ...(Array.isArray(companiesIndustryRes.data) ? companiesIndustryRes.data : []),
        ]);
        companies.forEach((company: any) => {
          searchResults.push({
            id: company.id,
            type: 'company',
            title: company.name,
            subtitle: company.industry,
            url: '/database',
          });
        });

        const contactRows = dedupeById([
          ...(Array.isArray(contactsFn.data) ? contactsFn.data : []),
          ...(Array.isArray(contactsLn.data) ? contactsLn.data : []),
          ...(Array.isArray(contactsEmail.data) ? contactsEmail.data : []),
        ]);
        contactRows.forEach((contact: any) => {
          const displayName =
            [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
            contact.name ||
            contact.email ||
            'Контакт';
          searchResults.push({
            id: contact.id,
            type: 'contact',
            title: displayName,
            subtitle: contact.companies?.name || contact.email,
            url: '/database',
          });
        });

        const tasks = dedupeById([
          ...(Array.isArray(tasksTitleRes.data) ? tasksTitleRes.data : []),
          ...(Array.isArray(tasksDescRes.data) ? tasksDescRes.data : []),
        ]);
        tasks.forEach((task: any) => {
          searchResults.push({
            id: task.id,
            type: 'task',
            title: task.title,
            status: task.status,
            url: '/tasks',
          });
        });

        if (reqId !== requestIdRef.current) return;

        const rankedResults = searchResults
          .sort((a, b) => {
            const typePriority = { deal: 1, company: 2, contact: 3, task: 4 } as const;
            return typePriority[a.type] - typePriority[b.type];
          })
          .slice(0, 24);

        if (cacheRef.current.size > 60) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest) cacheRef.current.delete(oldest);
        }
        cacheRef.current.set(query, rankedResults);
        setResults(rankedResults);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };

    const debounce = setTimeout(searchData, 300);
    return () => clearTimeout(debounce);
  }, [deferredSearch, open]);

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
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
      title="Глобальный поиск"
      description="Поиск сделок, компаний, контактов и задач в CRM"
    >
      <CommandInput 
        placeholder="Сделки, компании, контакты, задачи…" 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {!search && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Начните вводить запрос (от 2 символов)…
            <div className="mt-2 flex items-center justify-center gap-1 text-xs">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
              <span>или</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                Ctrl+K
              </kbd>
            </div>
          </div>
        )}

        {search && results.length === 0 && !loading && (
          <CommandEmpty>Ничего не найдено</CommandEmpty>
        )}

        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Поиск…
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
                    {result.amount != null && (
                      <div className="text-xs text-green-600 font-medium">
                        {Number(result.amount).toLocaleString('uz-UZ')} UZS
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
