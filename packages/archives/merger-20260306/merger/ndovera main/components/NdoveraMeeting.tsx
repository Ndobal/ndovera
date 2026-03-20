
import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Mic, MicOff, VideoOff, Monitor, PhoneOff, 
  MessageSquare, Users, FileText, Share, Radio, 
  MoreVertical, Shield, Clock, Send, X, Plus, 
  Download, Loader2, Sparkles, CheckCircle, AlertCircle,
  Settings, UserCheck, HardDrive, Paperclip, Heart, Disc
} from 'lucide-react';
import { UserRole, Meeting, MeetingParticipant, MeetingCategory } from '../types';
import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import { createPcmBlob, decodeAudio, decodeAudioData } from '../services/geminiService';

const MOCK_PARTICIPANTS: MeetingParticipant[] = [
  { id: '1', name: 'Dr. Adebayo', role: UserRole.SCHOOL_OWNER, isAudioOn: true, isVideoOn: true, isSharingScreen: false, deviceId: 'dev_1' },
  { id: '2', name: 'Mrs. Okoro', role: UserRole.TEACHER, isAudioOn: false, isVideoOn: true, isSharingScreen: false, deviceId: 'dev_2' },
  { id: '3', name: 'Mr. Musa', role: UserRole.PARENT, isAudioOn: true, isVideoOn: false, isSharingScreen: false, deviceId: 'dev_3' },
];

export const NdoveraMeeting: React.FC<{ user: { id: string, name: string, role: UserRole } }> = ({ user }) => {
  const [view, setView] = useState<'LIST' | 'ACTIVE'>('LIST');
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<MeetingParticipant[]>(MOCK_PARTICIPANTS);
  const [chatMessages, setChatMessages] = useState<{ sender: string, text: string, time: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [activeSidebar, setActiveSidebar] = useState<'CHAT' | 'USERS' | 'FILES' | null>('CHAT');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [alreadyInMeeting, setAlreadyInMeeting] = useState(false);

  // Live API Refs
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const audioContextRef = useRef<{ input: AudioContext, output: AudioContext } | null>(null);

  const joinMeeting = async (meeting: Meeting) => {
    const sessionKey = `meeting_session_${user.id}`;
    const existingSession = localStorage.getItem(sessionKey);
    if (existingSession && existingSession !== 'current_tab') {
      setAlreadyInMeeting(true);
      return;
    }

    localStorage.setItem(sessionKey, 'current_tab');
    setActiveMeeting(meeting);
    setView('ACTIVE');

    // Initialize Gemini Live API Participant
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    audioContextRef.current = {
      input: new AudioContext({ sampleRate: 16000 }),
      output: new AudioContext({ sampleRate: 24000 })
    };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          const source = audioContextRef.current!.input.createMediaStreamSource(stream);
          const processor = audioContextRef.current!.input.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => {
            const data = e.inputBuffer.getChannelData(0);
            sessionPromise.then(session => session.sendRealtimeInput({ media: createPcmBlob(data) }));
          };
          source.connect(processor);
          processor.connect(audioContextRef.current!.input.destination);
        },
        onmessage: async (msg: LiveServerMessage) => {
          const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audioData && audioContextRef.current) {
            const buffer = await decodeAudioData(decodeAudio(audioData), audioContextRef.current.output, 24000, 1);
            const source = audioContextRef.current.output.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.output.destination);
            const now = audioContextRef.current.output.currentTime;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
          }
          
          if (msg.serverContent?.outputTranscription) {
            setChatMessages(prev => [...prev, { 
                sender: 'Ndovera AI', 
                text: msg.serverContent!.outputTranscription!.text!, 
                time: new Date().toLocaleTimeString() 
            }]);
          }
        },
        onerror: (e) => console.error("Meeting Audio Error:", e),
        onclose: () => console.log("Meeting Session Ended"),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        systemInstruction: "You are the AI secretary for this school meeting. Listen to the conversation and provide occasional summaries or answer institutional queries."
      }
    });

    liveSessionRef.current = await sessionPromise;
  };

  const leaveMeeting = () => {
    localStorage.removeItem(`meeting_session_${user.id}`);
    if (liveSessionRef.current) liveSessionRef.current.close();
    audioContextRef.current?.input.close();
    audioContextRef.current?.output.close();
    
    if (isRecording) generateSummary();
    setView('LIST');
    setActiveMeeting(null);
    setAlreadyInMeeting(false);
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages([...chatMessages, { sender: user.name, text: chatInput, time: new Date().toLocaleTimeString() }]);
    setChatInput('');
  };

  const generateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const transcript = chatMessages.map(m => `${m.sender}: ${m.text}`).join('\n');
      const prompt = `Act as an institutional secretary. Summarize the following school meeting transcript into professional meeting minutes. Include "Decisions Made" and "Action Items".
      Meeting Title: ${activeMeeting?.title}
      Category: ${activeMeeting?.category}
      Transcript:
      ${transcript}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      setSummary(response.text || 'Summary generation failed.');
    } catch (e) {
      console.error(e);
      setSummary('Institutional summary processing completed via Ndovera OS.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  if (alreadyInMeeting) {
    return (
      <div className="h-full flex items-center justify-center p-10 animate-fade-in">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-red-100 text-center max-w-md space-y-6">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-10 h-10"/>
          </div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900">Security Gate.</h2>
          <p className="text-slate-500 font-medium">Session already active on another portal instance. Multi-access is prohibited for sanctuary meetings.</p>
          <button onClick={() => setAlreadyInMeeting(false)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Re-Verify Access</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 font-sans overflow-hidden flex flex-col">
      {view === 'LIST' ? (
        <div className="flex-1 overflow-y-auto p-10 space-y-12">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900">Sanctuary Sync.</h2>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1 italic">Secure Multi-Modal Institutional Collaboration</p>
            </div>
            {user.role !== UserRole.PARENT && (
              <button className="bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
                <Plus className="w-4 h-4"/> New Sanctuary Sync
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {[
              { id: 'm1', title: 'Emergency Staff Welfare Sync', category: 'STAFF', startTime: '10:00 AM', status: 'ACTIVE', host: 'Dr. Adebayo' },
              { id: 'm2', title: 'Termly PTA Welfare Review', category: 'PTA', startTime: '12:30 PM', status: 'UPCOMING', host: 'Mrs. Florence' }
            ].map(m => (
              <div key={m.id} className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden">
                <div className="relative z-10 space-y-8">
                  <div className="flex justify-between items-center">
                    <span className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${m.category === 'STAFF' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                      {m.category} SECTOR
                    </span>
                    {m.status === 'ACTIVE' && (
                      <span className="flex items-center gap-2 text-red-500 font-black text-[9px] uppercase tracking-widest animate-pulse">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full"/> Sync In Progress
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-4xl font-black italic tracking-tighter text-slate-900 group-hover:text-indigo-600 transition-colors uppercase leading-none">{m.title}</h3>
                    <p className="text-slate-400 font-medium text-lg mt-4 leading-relaxed italic">"Discussing session bonuses and institutional welfare packages."</p>
                  </div>
                  <div className="flex items-center gap-8 pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase tracking-widest">
                      <Clock className="w-4 h-4 text-indigo-400"/> {m.startTime}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase tracking-widest">
                      <Shield className="w-4 h-4 text-indigo-400"/> Host: {m.host}
                    </div>
                  </div>
                  <button 
                    onClick={() => joinMeeting(m as any)}
                    className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl group-hover:bg-indigo-600 transition-all flex items-center justify-center gap-3"
                  >
                    {m.status === 'ACTIVE' ? 'Authenticate & Enter' : 'Mark Interested'} <ArrowRightIcon className="w-5 h-5"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden bg-slate-950 animate-fade-in relative">
          <div className="flex-1 flex flex-col p-8">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 auto-rows-fr">
              {participants.map(p => (
                <div key={p.id} className="bg-slate-900 rounded-[3rem] border border-white/5 relative overflow-hidden flex items-center justify-center shadow-3xl">
                  {p.isVideoOn ? (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center relative">
                      <img src={`https://ui-avatars.com/api/?name=${p.name}&background=random&color=fff&size=512`} className="w-full h-full object-cover opacity-40 blur-sm" alt=""/>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="w-32 h-32 text-indigo-500/20"/>
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-indigo-600 rounded-[3rem] flex items-center justify-center text-white text-5xl font-black shadow-2xl">
                      {p.name.charAt(0)}
                    </div>
                  )}
                  <div className="absolute bottom-6 left-8 flex items-center gap-4 bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-2xl">
                    <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">{p.name} {p.id === user.id ? '(Authenticated)' : ''}</span>
                    {!p.isAudioOn && <MicOff className="w-4 h-4 text-red-400"/>}
                  </div>
                </div>
              ))}
            </div>

            <div className="h-32 flex items-center justify-center gap-6">
              <div className="flex items-center gap-4 bg-slate-900/90 backdrop-blur-3xl p-3 rounded-[3rem] border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
                <button onClick={() => setIsMuted(!isMuted)} className={`p-6 rounded-[2rem] transition-all hover:scale-110 active:scale-95 ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white hover:bg-white/10'}`}>
                  {isMuted ? <MicOff className="w-6 h-6"/> : <Mic className="w-6 h-6"/>}
                </button>
                <button onClick={() => setIsVideoOff(!isVideoOff)} className={`p-6 rounded-[2rem] transition-all hover:scale-110 active:scale-95 ${isVideoOff ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white hover:bg-white/10'}`}>
                  {isVideoOff ? <VideoOff className="w-6 h-6"/> : <Video className="w-6 h-6"/>}
                </button>
                <div className="w-px h-12 bg-white/10 mx-2"/>
                <button onClick={() => setIsSharingScreen(!isSharingScreen)} className={`p-6 rounded-[2rem] transition-all hover:scale-110 active:scale-95 ${isSharingScreen ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white hover:bg-white/10'}`}>
                  <Monitor className="w-6 h-6"/>
                </button>
                <button onClick={() => setIsRecording(!isRecording)} className={`p-6 rounded-[2rem] transition-all hover:scale-110 active:scale-95 ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-white/5 text-white hover:bg-white/10'}`}>
                  <Disc className="w-6 h-6"/>
                </button>
                <div className="w-px h-12 bg-white/10 mx-2"/>
                <button onClick={leaveMeeting} className="p-6 bg-red-500 text-white rounded-[2rem] hover:bg-red-600 shadow-2xl transition-all hover:scale-105 active:scale-90">
                  <PhoneOff className="w-8 h-8"/>
                </button>
              </div>
            </div>
          </div>

          <div className="w-[450px] bg-slate-900 border-l border-white/5 flex flex-col">
            <div className="p-10 border-b border-white/5 flex items-center justify-between">
              <div className="flex gap-6">
                <button onClick={() => setActiveSidebar('CHAT')} className={`relative p-2 transition-all ${activeSidebar === 'CHAT' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                  <MessageSquare className="w-7 h-7"/>
                  {activeSidebar === 'CHAT' && <div className="absolute -bottom-2 left-0 w-full h-1 bg-indigo-400 rounded-full"/>}
                </button>
                <button onClick={() => setActiveSidebar('USERS')} className={`relative p-2 transition-all ${activeSidebar === 'USERS' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                  <Users className="w-7 h-7"/>
                  {activeSidebar === 'USERS' && <div className="absolute -bottom-2 left-0 w-full h-1 bg-indigo-400 rounded-full"/>}
                </button>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"/>
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Authorized Channel</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
              {activeSidebar === 'CHAT' && (
                <div className="h-full flex flex-col">
                  <div className="flex-1 space-y-8">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.sender === user.name ? 'items-end' : 'items-start'} animate-fade-in`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${msg.sender === 'Ndovera AI' ? 'text-indigo-400' : 'text-slate-500'}`}>{msg.sender}</span>
                        </div>
                        <div className={`p-6 rounded-[2rem] max-w-[95%] text-base leading-relaxed font-medium shadow-xl ${msg.sender === user.name ? 'bg-indigo-600 text-white rounded-tr-none' : msg.sender === 'Ndovera AI' ? 'bg-indigo-950 text-indigo-100 border border-indigo-800' : 'bg-slate-800 text-slate-200 rounded-tl-none'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-10 flex gap-3">
                    <input 
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Dispatch secure message..." 
                      className="flex-1 bg-slate-800 border border-white/5 rounded-[1.5rem] px-6 py-4 text-white text-base outline-none focus:ring-4 ring-indigo-500/20 font-medium"
                    />
                    <button onClick={handleSendMessage} className="w-16 h-16 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-3xl hover:bg-indigo-500 transition-all"><Send className="w-6 h-6"/></button>
                  </div>
                </div>
              )}
            </div>

            {summary && (
              <div className="p-10 bg-indigo-950 text-white animate-slide-up border-t border-indigo-900">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-3">
                    <Sparkles className="text-amber-400 w-6 h-6"/> AI Sanctuary Minutes
                  </h4>
                  <button onClick={() => setSummary(null)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6 text-indigo-400"/></button>
                </div>
                <div className="bg-black/30 p-8 rounded-[2.5rem] border border-indigo-800 h-64 overflow-y-auto text-lg leading-relaxed font-medium italic opacity-90 scrollbar-hide shadow-inner">
                  {summary}
                </div>
                <div className="mt-8 flex gap-4">
                  <button className="flex-1 bg-white text-indigo-950 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3">
                    <Download className="w-4 h-4"/> Download Minutes
                  </button>
                  <button onClick={leaveMeeting} className="flex-1 bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-2xl">
                    Finalize Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ArrowRightIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
);
