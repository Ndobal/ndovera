
import React, { useState, useRef, useEffect } from 'react';
// Added History to lucide-react imports
import { 
    Send, Search, MoreVertical, Paperclip, Smile, 
    ShieldCheck, User, Check, CheckCheck, Mic, 
    ImageIcon, FileText, Phone, Video, 
    X, Sparkles, Loader2, Play, Pause, ChevronDown, Plus,
    Users, Heart, Radio, PhoneIncoming, PhoneOutgoing, Camera,
    Pin, Reply, CornerUpRight, History
} from 'lucide-react';
import { ChatThread, ChatMessage, MessageStatus, MessageType, CampusStory } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

const MOCK_STORIES: CampusStory[] = [
    { id: 's1', authorName: 'School Nurse', authorImg: 'https://ui-avatars.com/api/?name=SN&background=ef4444&color=fff', timestamp: new Date(), isSeen: false, type: 'WELFARE', contentUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef', caption: 'Today\'s mental wellness check-in for JSS students.' },
    { id: 's2', authorName: 'Sport Coach', authorImg: 'https://ui-avatars.com/api/?name=SC&background=f59e0b&color=fff', timestamp: new Date(), isSeen: true, type: 'EVENT', contentUrl: 'https://images.unsplash.com/photo-1544648397-52ee3bf827be', caption: 'Inter-house sports welfare activities kickoff!' },
    { id: 's3', authorName: 'HOD Science', authorImg: 'https://ui-avatars.com/api/?name=HS&background=4f46e5&color=fff', timestamp: new Date(), isSeen: false, type: 'ACADEMIC', contentUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d', caption: 'New science lab equipment is here!' },
];

const MOCK_THREADS: ChatThread[] = [
    { 
        id: 'pin1', 
        isPinned: true,
        participants: [{ id: 'w1', name: 'Emergency Staff Welfare', role: 'Support', img: 'https://ui-avatars.com/api/?name=EW&background=ef4444&color=fff', online: true }], 
        lastMessage: 'All health records updated.', 
        timestamp: new Date(), 
        unread: 0,
        category: 'WELFARE'
    },
    { 
        id: '1', 
        participants: [{ id: 't1', name: 'Mrs. Adebayo', role: 'Teacher', img: 'https://ui-avatars.com/api/?name=MA&background=4f46e5&color=fff', online: true }], 
        lastMessage: 'The welfare activities report is ready.', 
        timestamp: new Date(), 
        unread: 2,
        category: 'WELFARE'
    },
    { 
        id: 'group1', 
        isGroup: true,
        participants: [{ id: 'g1', name: 'JSS 2 Parents Welfare', role: 'Group', img: 'https://ui-avatars.com/api/?name=JW&background=10b981&color=fff' }], 
        lastMessage: 'Mr. Okon: We are organizing the snacks.', 
        timestamp: new Date(Date.now() - 3600000), 
        unread: 15,
        category: 'WELFARE'
    }
];

const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
    '1': [
        { id: 'm1', senderId: 't1', senderName: 'Mrs. Adebayo', text: 'Good morning. I wanted to update you on our student welfare activities.', timestamp: new Date(Date.now() - 7200000), status: MessageStatus.READ, type: MessageType.TEXT, role: 'model' },
        { id: 'm2', senderId: 'me', senderName: 'Me', text: 'Thank you. It is good to see the community supporting each other.', timestamp: new Date(Date.now() - 3600000), status: MessageStatus.READ, type: MessageType.TEXT, role: 'user' },
        { id: 'm3', senderId: 't1', senderName: 'Mrs. Adebayo', text: 'The welfare activities report is ready.', timestamp: new Date(), status: MessageStatus.DELIVERED, type: MessageType.TEXT, role: 'model' }
    ]
};

export const ChatSystem: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'CHATS' | 'PULSE' | 'CALLS'>('CHATS');
    const [threads] = useState<ChatThread[]>(MOCK_THREADS);
    const [activeThread, setActiveThread] = useState<ChatThread | null>(threads[1]);
    const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES[threads[1].id] || []);
    const [input, setInput] = useState('');
    const [isAIGenerating, setIsAIGenerating] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [activeStory, setActiveStory] = useState<CampusStory | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = (text: string = input) => {
        if (!text.trim() || !activeThread) return;
        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            senderId: 'me',
            senderName: 'Me',
            text: text,
            timestamp: new Date(),
            status: MessageStatus.SENT,
            type: MessageType.TEXT,
            role: 'user'
        };
        setMessages(prev => [...prev, newMessage]);
        setInput('');
        setAiSuggestions([]);
        setTimeout(() => {
            setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: MessageStatus.DELIVERED } : m));
        }, 1000);
    };

    const generateAiReplies = async () => {
        if (!activeThread || messages.length === 0) return;
        setIsAIGenerating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const lastMsg = messages[messages.length - 1];
            const prompt = `You are a helpful and empathetic school staff member. A ${activeThread.participants[0].role} said: "${lastMsg.text}". Suggest 3 warm, professional, and student welfare-focused one-sentence replies. Return as a JSON array under the key "replies".`;
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    // FIX: Added responseSchema for structured JSON output
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            replies: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: "Three professional, student welfare-focused replies."
                            }
                        },
                        required: ["replies"]
                    }
                }
            });
            const data = JSON.parse(response.text || "{}");
            setAiSuggestions(data.replies || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsAIGenerating(false);
        }
    };

    return (
        <div className="flex h-[800px] bg-white rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden font-sans relative">
            
            {/* Full-Screen Story Viewer */}
            {activeStory && (
                <div className="absolute inset-0 z-[100] bg-black animate-fade-in flex flex-col">
                    <div className="p-8 flex items-center justify-between text-white bg-gradient-to-b from-black/50 to-transparent">
                        <div className="flex items-center gap-4">
                            <img src={activeStory.authorImg} className="w-12 h-12 rounded-full border-2 border-white" />
                            <div>
                                <h4 className="font-black text-sm">{activeStory.authorName}</h4>
                                <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{activeStory.type}</p>
                            </div>
                        </div>
                        <button onClick={() => setActiveStory(null)} className="p-3 bg-white/20 rounded-full hover:bg-white/30"><X className="w-8 h-8"/></button>
                    </div>
                    <div className="flex-1 relative flex items-center justify-center p-4">
                        <img src={activeStory.contentUrl} className="max-w-full max-h-[70vh] rounded-[3rem] shadow-2xl border-4 border-white/10" />
                        <div className="absolute top-2 left-8 right-8 h-1 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-white animate-[progress_5s_linear_forwards] w-0"></div>
                        </div>
                    </div>
                    <div className="p-12 text-center bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-white text-2xl font-black italic tracking-tight mb-8">"{activeStory.caption}"</p>
                        <button className="bg-white text-black px-12 py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl">View Community Care</button>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <div className="w-[400px] border-r border-slate-50 flex flex-col bg-slate-50/10">
                <div className="p-8 space-y-8 bg-white border-b border-slate-50">
                    <div className="flex justify-between items-center">
                        <h3 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900">Ndochat</h3>
                        <div className="flex gap-2">
                            <button className="p-3 text-slate-400 hover:bg-slate-50 rounded-2xl transition-all"><Camera className="w-5 h-5"/></button>
                            <button className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100"><Plus className="w-5 h-5"/></button>
                        </div>
                    </div>
                    
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                        {(['CHATS', 'PULSE', 'CALLS'] as const).map(tab => (
                            <button 
                                key={tab} 
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {tab === 'PULSE' ? 'Campus Pulse' : tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {activeTab === 'CHATS' && (
                        <div className="py-4">
                            {/* Pulse Preview */}
                            <div className="px-6 pb-6 mb-6 border-b border-slate-50 flex gap-4 overflow-x-auto scrollbar-hide">
                                <button className="flex flex-col items-center gap-2 group flex-shrink-0">
                                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-indigo-200 flex items-center justify-center text-indigo-400 group-hover:border-indigo-600 transition-all"><Plus className="w-6 h-6"/></div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">My Pulse</span>
                                </button>
                                {MOCK_STORIES.map(story => (
                                    <button key={story.id} onClick={() => setActiveStory(story)} className="flex flex-col items-center gap-2 group flex-shrink-0">
                                        <div className={`w-16 h-16 p-0.5 rounded-full border-2 ${story.isSeen ? 'border-slate-200' : 'border-indigo-600'} transition-all`}>
                                            <img src={story.authorImg} className="w-full h-full rounded-full object-cover border-2 border-white" alt="" />
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${story.isSeen ? 'text-slate-400' : 'text-slate-900'}`}>{story.authorName.split(' ')[0]}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Thread List */}
                            <div className="px-4 space-y-1">
                                {threads.map(t => (
                                    <button 
                                        key={t.id} 
                                        onClick={() => {
                                            setActiveThread(t);
                                            setMessages(MOCK_MESSAGES[t.id] || []);
                                            setAiSuggestions([]);
                                        }}
                                        className={`w-full p-5 flex items-center gap-4 rounded-[2.5rem] transition-all group ${activeThread?.id === t.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="relative">
                                            <img src={t.participants[0].img} className="w-14 h-14 rounded-2xl shadow-sm border-2 border-white" alt="" />
                                            {t.isPinned && <div className="absolute -top-1 -right-1 w-5 h-5 bg-slate-900 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm"><Pin className="w-2.5 h-2.5 fill-current"/></div>}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-slate-900 text-sm truncate">{t.participants[0].name}</p>
                                                    {t.category === 'WELFARE' && <Heart className="w-3 h-3 text-red-400"/>}
                                                </div>
                                                <span className={`text-[9px] font-bold uppercase ${t.unread > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                    {t.timestamp.getHours()}:{t.timestamp.getMinutes().toString().padStart(2, '0')}
                                                </span>
                                            </div>
                                            <p className={`text-xs truncate font-medium ${t.unread > 0 ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>{t.lastMessage}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Pane */}
            <div className="flex-1 flex flex-col bg-[#FAFAFA]">
                {activeThread ? (
                    <>
                        <div className="p-8 bg-white/90 backdrop-blur-md border-b border-slate-50 flex justify-between items-center z-10 sticky top-0">
                            <div className="flex items-center gap-5">
                                <img src={activeThread.participants[0].img} className="w-16 h-16 rounded-[1.75rem] shadow-xl border-4 border-slate-50" />
                                <div>
                                    <h4 className="font-black text-slate-900 text-xl tracking-tight mb-1">{activeThread.participants[0].name}</h4>
                                    <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">{activeThread.participants[0].online ? 'Active Now' : 'Offline'}</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button className="p-4 text-slate-400 hover:bg-slate-50 rounded-2xl transition-all"><Phone className="w-6 h-6"/></button>
                                <button className="p-4 text-slate-400 hover:bg-slate-50 rounded-2xl transition-all"><MoreVertical className="w-6 h-6"/></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide">
                            {messages.map((msg, idx) => {
                                const isMe = msg.senderId === 'me';
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                        <div className="max-w-[75%] group relative">
                                            <div className={`p-6 rounded-[2.5rem] shadow-sm relative ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}`}>
                                                {msg.isForwarded && <div className="flex items-center gap-1.5 mb-2 opacity-50 italic text-[10px]"><CornerUpRight className="w-3 h-3"/> Forwarded</div>}
                                                <p className="text-base font-medium leading-relaxed">{msg.text}</p>
                                                <div className="flex items-center justify-end gap-2 mt-3 opacity-60">
                                                    <span className="text-[9px] font-black">{msg.timestamp.getHours()}:{msg.timestamp.getMinutes().toString().padStart(2, '0')}</span>
                                                    {isMe && <CheckCheck className={`w-3.5 h-3.5 ${msg.status === MessageStatus.READ ? 'text-blue-300' : ''}`}/>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-8 bg-white border-t border-slate-50 relative">
                            {aiSuggestions.length > 0 && (
                                <div className="absolute bottom-full left-0 w-full p-6 bg-gradient-to-t from-white to-white/0 flex gap-4 overflow-x-auto scrollbar-hide animate-slide-up">
                                    {aiSuggestions.map((reply, i) => (
                                        <button key={i} onClick={() => handleSendMessage(reply)} className="bg-white border-2 border-indigo-100 text-indigo-600 px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-xl flex-shrink-0">
                                            <Sparkles className="w-3.5 h-3.5 inline mr-2"/> {reply}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-[3rem] border border-slate-100">
                                <button className="p-4 text-slate-400 hover:text-indigo-600"><Plus className="w-6 h-6"/></button>
                                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Type a community care response..." className="flex-1 bg-transparent outline-none font-bold text-slate-900 text-lg py-2" />
                                <div className="flex gap-3 pr-2">
                                    <button onClick={generateAiReplies} disabled={isAIGenerating} className="p-4 text-slate-400 hover:text-indigo-600 transition-all">
                                        {isAIGenerating ? <Loader2 className="animate-spin w-6 h-6"/> : <Sparkles className="w-6 h-6"/>}
                                    </button>
                                    {input.trim() ? (
                                        <button onClick={() => handleSendMessage()} className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl"><Send className="w-7 h-7"/></button>
                                    ) : (
                                        <button className="w-16 h-16 bg-slate-200 text-slate-500 rounded-3xl flex items-center justify-center"><Mic className="w-7 h-7"/></button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};
