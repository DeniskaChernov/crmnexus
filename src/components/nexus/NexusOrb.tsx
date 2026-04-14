import React, { useState, useRef, useEffect } from 'react';
import { useNexus } from './NexusContext';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Brain, Radio, MessageSquare, Send, Keyboard, Sparkles, RefreshCcw } from 'lucide-react';

export const NexusOrb = () => {
  const { state, transcript, response, startListening, stopListening, processCommand, isSupported, permissionDenied, resetPermissionState } = useNexus();
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showInput && inputRef.current) {
        inputRef.current.focus();
    }
  }, [showInput]);

  if (!isSupported) return null;

  const handleClick = () => {
    if (permissionDenied) {
        setShowInput(!showInput);
        return;
    }

    if (state === 'listening') {
      stopListening();
    } else if (state === 'idle' || state === 'speaking') {
      startListening();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
        processCommand(inputText);
        setInputText('');
        setShowInput(false);
    }
  };

  const handleRetryVoice = () => {
      resetPermissionState();
      // Optionally delay startListening slightly or just reset state to let user try again by clicking orb
      setShowInput(false);
  };

  // Visual State Configuration
  const getOrbVisuals = () => {
      switch (state) {
          case 'listening':
              return {
                  gradient: "bg-gradient-to-br from-red-500 via-orange-500 to-red-600",
                  shadow: "shadow-[0_0_30px_rgba(239,68,68,0.6)]",
                  iconColor: "text-white",
                  pulseColor: "bg-red-500"
              };
          case 'processing':
              return {
                  gradient: "bg-gradient-to-r from-violet-600 via-purple-500 to-indigo-600",
                  shadow: "shadow-[0_0_30px_rgba(139,92,246,0.6)]",
                  iconColor: "text-white",
                  pulseColor: "bg-purple-500"
              };
          case 'speaking':
              return {
                  gradient: "bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-500",
                  shadow: "shadow-[0_0_35px_rgba(6,182,212,0.6)]",
                  iconColor: "text-white",
                  pulseColor: "bg-cyan-400"
              };
          case 'idle':
          default:
              if (permissionDenied) {
                return {
                    gradient: "bg-gradient-to-br from-amber-500 to-orange-600",
                    shadow: "shadow-[0_0_20px_rgba(245,158,11,0.4)]",
                    iconColor: "text-white",
                    pulseColor: "bg-amber-500"
                };
              }
              return {
                  gradient: "bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-600",
                  shadow: "shadow-[0_0_25px_rgba(79,70,229,0.5)]",
                  iconColor: "text-white",
                  pulseColor: "bg-indigo-500"
              };
      }
  };

  const visuals = getOrbVisuals();

  return (
    <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-4 font-sans">
      
      {/* Nexus Dialogue / Input Panel */}
      <AnimatePresence>
        {(transcript || response || showInput) && state !== 'idle' || showInput ? (
           <motion.div
             initial={{ opacity: 0, x: 20, scale: 0.9 }}
             animate={{ opacity: 1, x: 0, scale: 1 }}
             exit={{ opacity: 0, x: 20, scale: 0.9, transition: { duration: 0.2 } }}
             className="bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-4 mb-2 max-w-xs md:max-w-md w-full text-slate-100 overflow-hidden relative"
           >
             {/* Decorative shine */}
             <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
             
             <div className="flex flex-col gap-2 relative z-10">
                {state === 'listening' && (
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="text-slate-300 italic text-sm font-light">
                            {transcript || "Слушаю команду..."}
                        </span>
                    </div>
                )}
                
                {state === 'processing' && (
                    <div className="flex items-center gap-3">
                        <Brain className="w-4 h-4 animate-pulse text-purple-400" />
                        <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-medium text-sm">
                            Обрабатываю запрос...
                        </span>
                    </div>
                )}

                {(state === 'speaking' || (state === 'idle' && response && !showInput)) && (
                    <div className="text-slate-100 text-sm leading-relaxed">
                        {response}
                    </div>
                )}

                {/* Manual Text Input Mode */}
                {showInput && (
                    <div className="flex flex-col gap-2 w-full mt-1">
                        <form onSubmit={handleManualSubmit} className="flex gap-2 items-center w-full">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Напишите сообщение Нексусу..."
                                className="flex-1 bg-slate-800/50 rounded-lg border border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none py-2 px-3 text-sm text-slate-200 placeholder:text-slate-500 transition-all"
                            />
                            <button 
                                type="submit" 
                                disabled={!inputText.trim()}
                                className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                        
                        {/* Permission Reset Button (Only shows if permission was denied) */}
                        {permissionDenied && (
                            <div className="flex justify-end">
                                <button 
                                    onClick={handleRetryVoice}
                                    type="button"
                                    className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                                >
                                    <RefreshCcw className="w-3 h-3" />
                                    Попробовать микрофон снова
                                </button>
                            </div>
                        )}
                    </div>
                )}
             </div>
           </motion.div>
        ) : null}
      </AnimatePresence>

      {/* The Nexus Orb */}
      <div className="relative group">
        
        {/* Ambient Glow (Breathing) */}
        <motion.div
           animate={{ 
               scale: state === 'idle' ? [1, 1.1, 1] : 1,
               opacity: state === 'idle' ? [0.3, 0.6, 0.3] : 0
           }}
           transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
           className={`absolute -inset-4 rounded-full blur-xl ${visuals.pulseColor} opacity-40`}
        />

        {/* Active Ripples (Listening) */}
        {state === 'listening' && (
          <>
            <motion.div
              animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border border-red-500/50 bg-red-500/20"
            />
             <motion.div
              animate={{ scale: [1, 2], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: 0.5, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border border-red-400/30"
            />
          </>
        )}

        {/* Processing Spin Ring */}
        {state === 'processing' && (
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="absolute -inset-1 rounded-full border-2 border-t-purple-400 border-r-transparent border-b-purple-400 border-l-transparent opacity-80"
            />
        )}

        {/* Main Orb Button */}
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClick}
            className={`
                relative w-16 h-16 rounded-full flex items-center justify-center 
                ${visuals.gradient} ${visuals.shadow}
                border border-white/20 backdrop-blur-sm
                transition-all duration-500 ease-out
                z-20 overflow-hidden
            `}
        >
            {/* Inner Shine/Gloss */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-white/20 pointer-events-none" />
            <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-full blur-sm pointer-events-none" />

            {/* Icon Content */}
            <motion.div 
                key={state}
                initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`relative z-10 ${visuals.iconColor}`}
            >
               {state === 'listening' ? <Mic className="w-8 h-8 drop-shadow-md" /> :
                state === 'processing' ? <Brain className="w-8 h-8 drop-shadow-md animate-pulse" /> :
                state === 'speaking' ? <Radio className="w-8 h-8 drop-shadow-md" /> :
                permissionDenied ? <Keyboard className="w-7 h-7 drop-shadow-md" /> : 
                <Sparkles className="w-8 h-8 drop-shadow-md" />
               }
            </motion.div>
        </motion.button>

        {/* Label on Hover (if idle) */}
        {state === 'idle' && (
             <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 pointer-events-none">
                 Nexus AI
             </div>
        )}
      </div>
    </div>
  );
};
