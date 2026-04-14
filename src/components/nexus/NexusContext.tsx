import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from "sonner@2.0.3";

type NexusState = 'idle' | 'listening' | 'processing' | 'speaking';

interface NexusContextType {
  state: NexusState;
  transcript: string;
  response: string | null;
  startListening: () => void;
  stopListening: () => void;
  processCommand: (command: string) => Promise<void>;
  isSupported: boolean;
  permissionDenied: boolean;
  resetPermissionState: () => void;
}

const NexusContext = createContext<NexusContextType | undefined>(undefined);

export const useNexus = () => {
  const context = useContext(NexusContext);
  if (!context) {
    throw new Error('useNexus must be used within a NexusProvider');
  }
  return context;
};

interface NexusProviderProps {
  children: ReactNode;
}

export const NexusProvider: React.FC<NexusProviderProps> = ({ children }) => {
  const [state, setState] = useState<NexusState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'ru-RU'; // Set to Russian

      recognitionInstance.onstart = () => {
        setState('listening');
      };

      recognitionInstance.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognitionInstance.onerror = (event: any) => {
        // Handle "not-allowed" which means mic permission denied
        if (event.error === 'not-allowed') {
            setPermissionDenied(true);
            setState('idle');
            // Show toast only once or if not already in denied state to avoid spam
            if (!permissionDenied) {
               toast.error("Нет доступа к микрофону", { 
                   description: "Нексус переключен в текстовый режим. Нажмите на сферу, чтобы написать команду.",
                   duration: 5000 
               });
            }
        } else if (event.error === 'no-speech') {
            // Simply ignore silence errors, just stop listening
             setState('idle');
        } else if (event.error === 'network') {
             console.warn('Nexus Speech Recognition Error:', event.error);
             setState('idle');
             toast.error("Ошибка сети", { description: "Проверьте интернет соединение." });
        } else if (event.error === 'aborted') {
             // Just reset to idle, user probably clicked stop
             setState('idle');
        } else {
             console.warn('Nexus Speech Recognition Error:', event.error);
             setState('idle');
        }
      };

      recognitionInstance.onend = () => {
        // Handled by effect below or immediate state changes
      };

      setRecognition(recognitionInstance);
      setIsSupported(true);
    } else {
      console.warn('Nexus: Speech Recognition API not supported in this browser.');
      setIsSupported(false);
    }
  }, []);

  // Sync state with recognition end
  useEffect(() => {
    if (recognition) {
        recognition.onend = () => {
            if (state === 'listening' && transcript.trim()) {
                handleProcessing(transcript);
            } else if (state === 'listening') {
                // Stopped without speech
                setState('idle');
            }
            // If processing/speaking, onend is irrelevant (likely triggered by stop() before processing)
        };
    }
  }, [recognition, state, transcript]);


  const startListening = () => {
    if (permissionDenied) {
        toast.info("Текстовый режим", { description: "Микрофон недоступен. Используйте текстовый ввод." });
        return;
    }

    // Force stop previous instance if any, to prevent "already started" errors
    try {
        if (recognition && state !== 'idle') {
            recognition.abort(); // Hard stop
        }
    } catch (e) {
        // Ignore
    }

    if (recognition) {
      setTranscript('');
      setResponse(null);
      // Small delay to ensure abortion is complete
      setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.error("Failed to start recognition", e);
            setState('idle'); 
          }
      }, 50);
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      // State change handled in onend
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech first
      window.speechSynthesis.cancel();
      
      setState('speaking');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      utterance.rate = 1.1; 

      // Robust voice selection
      const selectVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          // Priority: Google Russian -> Any Russian -> Default
          const voice = voices.find(v => v.lang.includes('ru') && v.name.includes('Google')) ||
                        voices.find(v => v.lang.includes('ru')) || 
                        voices.find(v => v.lang.includes('RU')); // Fallback for some browsers using uppercase
          
          if (voice) {
             utterance.voice = voice;
          }
      };

      selectVoice();
      // Some browsers load voices asynchronously
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = selectVoice;
      }

      utterance.onend = () => {
        setState('idle');
      };
      
      utterance.onerror = (e) => {
        console.error("TTS Error:", e);
        setState('idle');
      };

      window.speechSynthesis.speak(utterance);
    } else {
        setState('idle');
    }
  };

  const handleProcessing = async (text: string) => {
    setState('processing');

    try {
        const context = {
            currentPath: location.pathname,
        };

        const res = await fetch(`${crmUrl('/nexus')}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders(),
            },
            body: JSON.stringify({
                transcript: text,
                context,
                userId: 'current-user' 
            })
        });

        if (!res.ok) throw new Error('Brain unreachable');

        const data = await res.json();

        if (data.type === 'action') {
            if (data.action === 'navigate') {
                navigate(data.path);
            }
            const msg = data.message || "Выполняю.";
            setResponse(msg);
            speak(msg);
        } else {
            const msg = data.message || "Готово.";
            setResponse(msg);
            speak(msg);
        }

    } catch (error) {
        console.warn("Nexus Brain connection failed, using local fallback", error);
        
        // --- LOCAL FALLBACK LOGIC ---
        const lowerText = text.toLowerCase();
        let reply = "Связь с сервером потеряна. Работаю в автономном режиме.";
        let done = false;

        // Basic Navigation Map
        if (lowerText.includes('склад')) {
            navigate('/warehouse');
            reply = "Открываю склад (оффлайн).";
            done = true;
        } else if (lowerText.includes('дашборд') || lowerText.includes('главная')) {
            navigate('/');
            reply = "Перехожу на главную (оффлайн).";
             done = true;
        } else if (lowerText.includes('клиент')) {
            navigate('/crm/clients');
            reply = "Открываю клиентов (оффлайн).";
             done = true;
        } else if (lowerText.includes('сделки')) {
            navigate('/crm/deals');
            reply = "Перехожу к сделкам (оффлайн).";
             done = true;
        } else if (lowerText.includes('привет')) {
             reply = "Привет! Я Нексус. Сейчас нет связи с сервером, но я могу помочь с навигацией.";
             done = true;
        }
        
        setResponse(reply);
        speak(reply);
    }
  };

  const processCommand = async (command: string) => {
    await handleProcessing(command);
  };

  const resetPermissionState = () => {
    setPermissionDenied(false);
  };

  return (
    <NexusContext.Provider value={{ state, transcript, response, startListening, stopListening, processCommand, isSupported, permissionDenied, resetPermissionState }}>
      {children}
    </NexusContext.Provider>
  );
};
