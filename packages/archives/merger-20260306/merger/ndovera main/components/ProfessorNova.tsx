
import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User, Lock, AlertCircle, Mic, Headphones, X, Zap, Loader2, Wallet, ImageIcon, Trash2 } from 'lucide-react';
import { sendMessageToNdove, createPcmBlob, decodeAudio, decodeAudioData } from '../services/geminiService';
import { ChatMessage, MessageStatus, MessageType } from '../types';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

interface Props {
  credits: number;
  onSpendCredits: (amount: number) => void;
  isUnlocked?: boolean;
  isNovaPlus?: boolean;
}

export const ProfessorNova: React.FC<Props> = ({ credits, onSpendCredits, isUnlocked = true, isNovaPlus = false }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      senderId: 'nova',
      senderName: 'Professor Nova',
      status: MessageStatus.SENT,
      type: MessageType.TEXT,
      role: 'model',
      text: "Hello! I'm Professor Nova. I can help you with Math, Science, History, or help you prepare for your exams like WAEC or NECO. You can also upload a photo of your homework! What are we learning today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  
  // Audio Refs
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const liveSessionRef = useRef<any>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const COST_PER_MSG = isNovaPlus ? 0 : 5;
  const hasEnoughCredits = isNovaPlus || credits >= COST_PER_MSG;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setSelectedImage({
          data: base64.split(',')[1],
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;
    if (!isUnlocked || !hasEnoughCredits) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      senderId: 'user',
      senderName: 'Student',
      status: MessageStatus.SENT,
      type: selectedImage ? MessageType.IMAGE : MessageType.TEXT,
      role: 'user',
      text: input,
      mediaUrl: selectedImage ? `data:${selectedImage.mimeType};base64,${selectedImage.data}` : undefined,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    
    if (COST_PER_MSG > 0) onSpendCredits(COST_PER_MSG);

    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const responseText = await sendMessageToNdove(input || "Please analyze this image.", history, selectedImage || undefined);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        senderId: 'nova',
        senderName: 'Professor Nova',
        status: MessageStatus.SENT,
        type: MessageType.TEXT,
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
      setSelectedImage(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceSession = async () => {
    if (!isNovaPlus) {
      alert("Voice Tutoring is a Nova Plus exclusive feature.");
      return;
    }

    setIsVoiceMode(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    inputAudioCtxRef.current = new AudioContext({ sampleRate: 16000 });
    outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
          const processor = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            sessionPromise.then(session => {
              session.sendRealtimeInput({ media: createPcmBlob(inputData) });
            });
          };
          source.connect(processor);
          processor.connect(inputAudioCtxRef.current!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          const base64Data = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Data && outputAudioCtxRef.current) {
            const bytes = decodeAudio(base64Data);
            const buffer = await decodeAudioData(bytes, outputAudioCtxRef.current, 24000, 1);
            const source = outputAudioCtxRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAudioCtxRef.current.destination);
            
            const now = outputAudioCtxRef.current.currentTime;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            audioSourcesRef.current.add(source);
          }

          if (message.serverContent?.interrupted) {
            audioSourcesRef.current.forEach(s => s.stop());
            audioSourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          }
        },
        onerror: (e) => console.error("Live Audio Error:", e),
        onclose: () => setIsVoiceMode(false),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "You are Professor Nova, a helpful AI Tutor. Speak concisely and encouragingly."
      }
    });

    liveSessionRef.current = await sessionPromise;
  };

  const stopVoiceSession = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    inputAudioCtxRef.current?.close();
    outputAudioCtxRef.current?.close();
    setIsVoiceMode(false);
  };

  return (
    <div className="flex flex-col h-[700px] bg-white rounded-[3.5rem] shadow-2xl border border-indigo-50 overflow-hidden relative">
      {isVoiceMode && (
          <div className="absolute inset-0 z-50 bg-indigo-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-10 animate-fade-in text-white text-center">
              <button onClick={stopVoiceSession} className="absolute top-10 right-10 p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="w-8 h-8"/></button>
              <div className="space-y-10 w-full max-w-md">
                  <div className="relative">
                      <div className="w-56 h-56 bg-indigo-600 rounded-[4rem] flex items-center justify-center mx-auto shadow-2xl animate-pulse border-4 border-indigo-500/50">
                          <Headphones className="w-24 h-24 text-white"/>
                      </div>
                      <div className="mt-8">
                        <h2 className="text-5xl font-black italic tracking-tighter">Ndove Live.</h2>
                        <p className="text-indigo-200 font-medium text-lg mt-4 leading-relaxed italic">"I'm listening, David. How can I help you today?"</p>
                      </div>
                  </div>
                  <div className="flex justify-center items-center gap-1.5 h-16">
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                          <div key={i} className="w-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ height: `${30 + Math.random() * 50}%`, animationDelay: `${i * 80}ms` }} />
                      ))}
                  </div>
                  <button onClick={stopVoiceSession} className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-3xl hover:bg-red-600 transition-all hover:scale-110">
                      <PhoneOffIcon className="w-10 h-10 text-white" />
                  </button>
              </div>
          </div>
      )}

      <div className="bg-indigo-600 p-8 flex items-center justify-between shadow-xl shrink-0">
        <div className="flex items-center gap-5">
            <div className="bg-white/20 p-3 rounded-2xl shadow-inner relative">
                <Bot className="text-white w-8 h-8" />
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-indigo-600 animate-pulse"></div>
            </div>
            <div>
                <h3 className="text-white font-black text-2xl tracking-tight leading-none mb-1">Professor Nova</h3>
                <p className="text-indigo-100 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    {isNovaPlus ? <><Zap className="w-3 h-3 text-amber-400"/> AI DNA Sync Active</> : 'Ndovera Intelligence'}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <button 
                onClick={startVoiceSession}
                className={`px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${isNovaPlus ? 'bg-indigo-500 text-white shadow-lg hover:bg-indigo-400' : 'bg-indigo-700 text-indigo-400/50'}`}
            >
                <Mic className="w-4 h-4"/> Voice Tutoring
            </button>
            <div className="bg-amber-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2 shadow-lg">
                <Wallet className="w-4 h-4" /> {credits.toLocaleString()} Lams
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10 bg-slate-50 space-y-8 scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 shadow-xl ${msg.role === 'user' ? 'bg-slate-900' : 'bg-indigo-600'}`}>
              {msg.role === 'user' ? <User className="w-6 h-6 text-white" /> : <Bot className="w-6 h-6 text-white" />}
            </div>
            <div className={`max-w-[85%] md:max-w-[70%] space-y-4`}>
              {msg.mediaUrl && (
                <div className="rounded-[2rem] overflow-hidden shadow-lg border-4 border-white">
                  <img src={msg.mediaUrl} className="max-w-full h-auto" alt="Uploaded Context" />
                </div>
              )}
              <div className={`p-8 rounded-[2.5rem] text-base leading-relaxed font-medium shadow-sm border ${msg.role === 'user' ? 'bg-white text-slate-900 border-slate-100 rounded-tr-none' : 'bg-white text-slate-700 border-indigo-50 rounded-tl-none'}`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-4 animate-fade-in">
            <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-600 flex items-center justify-center shadow-xl"><Loader2 className="animate-spin w-6 h-6 text-white" /></div>
            <div className="bg-white p-8 rounded-[2.5rem] rounded-tl-none shadow-sm border border-indigo-50 flex items-center gap-4">
                <div className="flex gap-1">
                    <div className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                </div>
                <span className="text-xs font-black uppercase text-slate-400 tracking-widest italic">Ndove is analyzing your request...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-8 md:p-10 bg-white border-t border-indigo-50 shrink-0">
        <div className="max-w-4xl mx-auto space-y-6">
          {selectedImage && (
            <div className="flex items-center gap-4 bg-indigo-50 p-4 rounded-3xl border border-indigo-100 animate-scale-in">
              <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} className="w-16 h-16 rounded-xl object-cover shadow-md" />
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Image Context Ready</p>
                <p className="text-xs font-bold text-slate-500 italic">Professor Nova will analyze this visual content.</p>
              </div>
              <button onClick={() => setSelectedImage(null)} className="p-3 hover:bg-red-50 text-red-500 rounded-full transition-all"><Trash2 className="w-5 h-5"/></button>
            </div>
          )}

          <div className="flex gap-4">
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-100 rounded-[2.5rem] px-8 py-2 focus-within:ring-4 ring-indigo-50 transition-all shadow-inner">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={!hasEnoughCredits || isLoading}
                placeholder={hasEnoughCredits ? "Search knowledge or ask anything..." : "Credits depleted. Visit Wallet to earn Lams."}
                className="flex-1 bg-transparent py-4 outline-none text-base font-bold"
              />
              <div className="flex items-center gap-2 border-l border-slate-200 ml-4 pl-4">
                <label className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-2xl transition-all cursor-pointer">
                  <ImageIcon className="w-6 h-6"/>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>
            </div>
            <button
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && !selectedImage) || !hasEnoughCredits}
              className={`w-20 h-20 text-white rounded-[2rem] transition-all shadow-2xl hover:scale-105 active:scale-95 flex items-center justify-center shrink-0 ${!hasEnoughCredits ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
            >
              {isLoading ? <Loader2 className="animate-spin w-8 h-8"/> : <Send className="w-8 h-8" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PhoneOffIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.209.435l-1.244 2.148a1 1 0 01-1.233.433A12.04 12.04 0 017.5 13.5a1 1 0 01.433-1.233l2.148-1.244a1 1 0 00.435-1.209L9.018 5.684A1 1 0 008.07 5H5z" />
    </svg>
);
