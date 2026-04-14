import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tag, TrendingUp, AlertCircle } from 'lucide-react';

interface CampaignData {
  campaignName: string;
  revenue: number;
  spend: number;
}

interface SmartAnalysisProps {
  data: CampaignData[];
}

export function SmartAnalysis({ data }: SmartAnalysisProps) {
  
  const tagsAnalysis = useMemo(() => {
    const stats: Record<string, { revenue: number, spend: number, count: number }> = {};
    const stopWords = ['реклама', 'тест', 'акция', 'запуск', 'новый', 'копия', 'target', 'promo', 'ads', 'test', '-', '|', ' '];

    data.forEach(item => {
        // Normalize: lowercase, remove punctuation
        const words = item.campaignName
            .toLowerCase()
            .replace(/[^\w\sа-яё]/g, ' ')
            .split(/\s+/);

        const uniqueWords = new Set(words); // Count word once per campaign to avoid skewing

        uniqueWords.forEach(word => {
            if (word.length < 3 || stopWords.includes(word)) return;
            
            if (!stats[word]) stats[word] = { revenue: 0, spend: 0, count: 0 };
            stats[word].revenue += item.revenue;
            stats[word].spend += item.spend;
            stats[word].count += 1;
        });
    });

    return Object.entries(stats)
        .map(([tag, stat]) => ({
            tag,
            ...stat,
            roas: stat.spend > 0 ? (stat.revenue / stat.spend) * 100 : 0
        }))
        .filter(t => t.count >= 2) // Only show tags that appear in at least 2 campaigns (statistically significant)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5); // Top 5
  }, [data]);

  if (tagsAnalysis.length === 0) {
      return (
          <Card className="bg-slate-50 border-dashed py-10">
             <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-500 justify-center">
                    <Tag className="w-5 h-5" /> Умный анализ тегов
                </CardTitle>
             </CardHeader>
             <CardContent className="text-center text-slate-400 text-sm">
                 Недостаточно данных для анализа. <br/>
                 Используйте одинаковые слова в названиях разных кампаний (например, "Нитки", "Опт"), чтобы система нашла закономерности.
             </CardContent>
          </Card>
      )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
           <Tag className="w-5 h-5 text-purple-500" /> 
           Эффективность ключевых слов
        </CardTitle>
        <CardDescription>
            Система проанализировала ключевые слова в названиях кампаний
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            {tagsAnalysis.map((item, idx) => (
                <div key={item.tag} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white border text-xs font-bold text-slate-500">
                            {idx + 1}
                        </div>
                        <div>
                            <div className="font-semibold capitalize text-slate-800">{item.tag}</div>
                            <div className="text-xs text-slate-500">{item.count} кампаний</div>
                        </div>
                    </div>
                    
                    <div className="text-right">
                        <div className={cn(
                            "font-bold text-sm",
                            item.roas > 400 ? "text-green-600" : item.roas > 200 ? "text-blue-600" : "text-slate-600"
                        )}>
                            ROAS {item.roas.toFixed(0)}%
                        </div>
                        <div className="text-xs text-slate-400">
                           {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(item.revenue)}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
