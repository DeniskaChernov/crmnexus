import React, { useState, useRef, useEffect } from 'react';
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Sparkles, Send, Loader2, User, Bot, Trash2, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import { crm } from "@/lib/crmClient.ts";
import { toast } from 'sonner@2.0.3';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  timestamp: Date;
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Приветствую! Я ваш Виртуальный Директор по Продажам и Маркетингу (CSO & CMO).\n\nЯ подключен к ядру BTT NEXUS и готов масштабировать ваш бизнес. Мои инструменты:\n\n🚀 АНАЛИЗ СДЕЛОК: Найду где теряем деньги\n📈 СТРАТЕГИЯ: Маркетинг план для рынка Узбекистана\n🏭 ПРОИЗВОДСТВО: Загрузим экструдеры заказами\n🎯 ЛИДЫ: Помогу конвертировать холодную базу\n\nЯ вижу все цифры, задачи и клиентов в реальном времени. С чего начнем увеличение прибыли сегодня?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadUserAndHistory();
  }, []);

  const loadUserAndHistory = async () => {
    try {
      setHistoryLoading(true);
      
      const { data: { session } } = await crm.auth.getSession();
      if (!session?.user) {
        console.error('No user session found');
        setHistoryLoading(false);
        return;
      }

      const currentUserId = session.user.id;
      setUserId(currentUserId);

      const response = await fetch(
        `${crmUrl(`/ai-chat-history?userId=${currentUserId}`)}`,
        {
          method: 'GET',
          headers: { ...authHeaders(false) },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const loadedMessages = data.messages.map((msg: any) => {
            let content = msg.content;
            let imageUrl = msg.imageUrl;

            // Handle OpenAI content array format (text + image)
            if (Array.isArray(content)) {
               const textPart = content.find((c: any) => c.type === 'text');
               const imagePart = content.find((c: any) => c.type === 'image_url');
               
               content = textPart ? textPart.text : "";
               if (imagePart) {
                 imageUrl = imagePart.image_url.url;
               }
            }

            return {
              role: msg.role,
              content: content,
              imageUrl: imageUrl,
              timestamp: new Date(msg.timestamp)
            };
          });
          setMessages(loadedMessages);
        }
      }
    } catch (error) {
      console.warn('Error loading chat history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Размер файла не должен превышать 5МБ');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (base64Image: string): Promise<string | null> => {
    try {
      // Convert base64 to file blob
      const res = await fetch(base64Image);
      const blob = await res.blob();
      const file = new File([blob], "image.png", { type: "image/png" });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${crmUrl('/upload')}`,
        {
          method: 'POST',
          headers: { ...authHeaders(false) },
          body: formData,
        }
      );

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Ошибка загрузки изображения');
      return null;
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || loading || !userId) return;

    let imageUrl: string | undefined;

    if (selectedImage) {
      setLoading(true);
      const uploadedUrl = await uploadImage(selectedImage);
      if (!uploadedUrl) {
        setLoading(false);
        return;
      }
      imageUrl = uploadedUrl;
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      imageUrl: imageUrl, // Use the uploaded URL, not base64
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLoading(true);

    try {
      // Prepare content for OpenAI
      let apiContent: any = userMessage.content;
      
      if (userMessage.imageUrl) {
        apiContent = [
          { type: 'text', text: userMessage.content || "Проанализируй это изображение" },
          { type: 'image_url', image_url: { url: userMessage.imageUrl } }
        ];
      }

      const response = await fetch(
        `${crmUrl('/ai-chat')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(false),
          },
          body: JSON.stringify({
            messages: [...messages, { ...userMessage, content: apiContent }].map(m => {
              // Ensure we send correct format to backend
              // Backend expects standard OpenAI message format
              // For history items that might be just strings, we leave them.
              // For the new message with image, we use the array format.
              
              // If we are sending history, we should make sure we don't double encode or break old messages.
              // However, 'messages' in state has 'imageUrl' separate property for UI convenience.
              // We need to map it to OpenAI format here.
              
              if (m.imageUrl && typeof m.content === 'string') {
                 return {
                   role: m.role,
                   content: [
                     { type: 'text', text: m.content || "Image" },
                     { type: 'image_url', image_url: { url: m.imageUrl } }
                   ]
                 };
              }
              
              return {
                role: m.role,
                content: m.content
              };
            }),
            userId: userId
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI Chat Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ Ошибка: ${error.message}\n\nПопробуйте перефразировать вопрос или проверьте консоль.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!userId) return;

    try {
      const response = await fetch(
        `${crmUrl(`/ai-chat-history?userId=${userId}`)}`,
        {
          method: 'DELETE',
          headers: { ...authHeaders(false) },
        }
      );

      if (response.ok) {
        setMessages([
          {
            role: 'assistant',
            content: '👋 Приветствую! Я ваш Виртуальный Директор по Продажам и Маркетингу (CSO & CMO).\n\nЯ подключен к ядру BTT NEXUS и готов масштабировать ваш бизнес. Мои инструменты:\n\n🚀 АНАЛИЗ СДЕЛОК: Найду где теряем деньги\n📈 СТРАТЕГИЯ: Маркетинг план для рынка Узбекистана\n🏭 ПРОИЗВОДСТВО: Загрузим экструдеры заказами\n🎯 ЛИДЫ: Помогу конвертировать холодную базу\n\nЯ вижу все цифры, задачи и клиентов в реальном времени. С чего начнем увеличение прибыли сегодня?',
            timestamp: new Date(),
          },
        ]);
        toast.success('История чата очищена');
      } else {
        throw new Error('Failed to clear history');
      }
    } catch (error: any) {
      console.error('Clear history error:', error);
      toast.error('Не удалось очистить историю');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">AI Эксперт по продажам</h1>
            <p className="text-xs text-slate-500">Ваш личный консультант 24/7</p>
          </div>
        </div>
        <Button
          onClick={clearHistory}
          disabled={historyLoading}
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-red-500 hover:bg-red-50"
          title="Очистить историю"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Очистить
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/30" ref={scrollRef}>
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-4 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex items-start">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 shadow-sm">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
              
              <div
                className={`max-w-[80%] rounded-2xl px-5 py-4 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-100 text-slate-800'
                }`}
              >
                {message.imageUrl && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-white/20">
                    <img 
                      src={message.imageUrl} 
                      alt="Attachment" 
                      className="max-w-full h-auto max-h-60 object-contain bg-black/5" 
                    />
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
                <p className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                }`}>
                  {message.timestamp.toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {message.role === 'user' && (
                <div className="flex items-start">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 shadow-sm">
                    <User className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-4 justify-start">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-sm">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                  <span className="text-sm text-slate-500">
                    Анализирую данные...
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 bg-white border-t">
        <div className="max-w-4xl mx-auto">
          {selectedImage && (
            <div className="mb-3 relative inline-block">
              <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm w-32 h-32 bg-slate-50 flex items-center justify-center relative group">
                <img 
                  src={selectedImage} 
                  alt="Preview" 
                  className="w-full h-full object-cover" 
                />
                <button
                  onClick={clearSelectedImage}
                  className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          
          <div className="flex gap-3">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="icon"
              disabled={loading}
              className="h-12 w-12 border-slate-200 hover:bg-slate-50 text-slate-500 shrink-0"
              title="Прикрепить изображение"
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            <Input
              placeholder="Спросите что-то о продажах или маркетинге..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="flex-1 bg-slate-50 border-slate-200 focus:bg-white transition-colors h-12 text-base shadow-sm"
            />
            <Button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !selectedImage)}
              size="icon"
              className="h-12 w-12 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-md shrink-0"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-center text-slate-400 mt-3">
            AI имеет ПРЯМОЙ доступ к данным вашей CRM и может анализировать сделки, задачи, клиентов в реальном времени
          </p>
        </div>
      </div>
    </div>
  );
}