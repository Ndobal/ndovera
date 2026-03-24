import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, MicOff, Mic, VideoOff, Video, Send, Sparkles, Settings2, Shield, User, Bell, Monitor, Globe, Sun, Moon, BarChart3, CheckCircle2, PenTool, Eraser, Trash2, Plus, MessageSquare, Download, Undo2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn, Participant, Message, TranscriptionEntry } from '../../../components/live/lib/utils';
import { Whiteboard } from './Whiteboard';

export const Sidebar = ({ 
  activeSidebar, 
  setActiveSidebar, 
  messages, 
  participants, 
  localParticipant,
  inputText,
  setInputText,
  handleSendMessage,
  isAiThinking,
  aiSummary,
  transcription,
  sharedNotes,
  setSharedNotes,
  theme,
  toggleTheme,
  userName,
  setUserName,
  isMuted,
  setIsMuted,
  isCameraOff,
  setIsCameraOff,
  devices,
  selectedAudioInput,
  setSelectedAudioInput,
  selectedVideoInput,
  setSelectedVideoInput,
  audioQuality,
  setAudioQuality
}: any) => {
  // Polling State
  const [polls, setPolls] = React.useState<{
    id: string;
    question: string;
    options: { id: string; text: string; votes: number }[];
    isActive: boolean;
    totalVotes: number;
    userVotedOptionId: string | null;
  }[]>([
    {
      id: '1',
      question: 'How are you finding the pace of the lesson?',
      options: [
        { id: 'o1', text: 'Too fast', votes: 2 },
        { id: 'o2', text: 'Just right', votes: 8 },
        { id: 'o3', text: 'Too slow', votes: 3 },
      ],
      isActive: true,
      totalVotes: 13,
      userVotedOptionId: null
    }
  ]);
  const [isCreatingPoll, setIsCreatingPoll] = React.useState(false);
  const [newPollQuestion, setNewPollQuestion] = React.useState('');
  const [newPollOptions, setNewPollOptions] = React.useState(['', '']);

  const handleCreatePoll = () => {
    if (!newPollQuestion.trim() || newPollOptions.some(o => !o.trim())) return;
    
    const newPoll = {
      id: Date.now().toString(),
      question: newPollQuestion,
      options: newPollOptions.map((text, index) => ({
        id: `opt_${Date.now()}_${index}`,
        text,
        votes: 0
      })),
      isActive: true,
      totalVotes: 0,
      userVotedOptionId: null
    };
    
    setPolls([newPoll, ...polls]);
    setIsCreatingPoll(false);
    setNewPollQuestion('');
    setNewPollOptions(['', '']);
  };

  const handleVote = (pollId: string, optionId: string) => {
    setPolls(polls.map(poll => {
      if (poll.id === pollId && !poll.userVotedOptionId) {
        return {
          ...poll,
          totalVotes: poll.totalVotes + 1,
          userVotedOptionId: optionId,
          options: poll.options.map(opt => 
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
          )
        };
      }
      return poll;
    }));
  };

  const handleEndPoll = (pollId: string) => {
    setPolls(polls.map(poll => 
      poll.id === pollId ? { ...poll, isActive: false } : poll
    ));
  };

  const cameras = ['FaceTime HD Camera', 'Logitech Brio', 'OBS Virtual Camera'];
  const mics = ['MacBook Pro Microphone', 'Yeti Stereo Microphone', 'AirPods Pro'];
  return (
    <AnimatePresence>
      {activeSidebar && (
        <motion.div
          initial={{ x: 400 }}
          animate={{ x: 0 }}
          exit={{ x: 400 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full md:w-96 absolute md:relative right-0 top-0 bottom-0 z-50 border-l border-white/5 bg-zinc-950/95 md:bg-zinc-950/50 backdrop-blur-3xl flex flex-col light:bg-white/95 light:border-slate-200"
        >
          <div className="h-20 flex items-center justify-between px-6 border-b border-white/5 light:border-slate-200">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/60 light:text-slate-500">
              {activeSidebar === 'chat' && 'Group Chat'}
              {activeSidebar === 'participants' && 'Participants'}
              {activeSidebar === 'ai' && 'Ndovera AI Tutor'}
              {activeSidebar === 'summary' && 'Meeting Summary'}
              {activeSidebar === 'settings' && 'Settings'}
              {activeSidebar === 'notes' && 'Shared Notes'}
              {activeSidebar === 'whiteboard' && 'Whiteboard'}
              {activeSidebar === 'polls' && 'Live Polls'}
            </h2>
            <button onClick={() => setActiveSidebar(null)} className="p-2 hover:bg-white/5 light:hover:bg-slate-100 rounded-full transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeSidebar === 'chat' || activeSidebar === 'ai' ? (
              <div className="space-y-6">
                {messages.filter((m: Message) => activeSidebar === 'ai' ? (m.isAI || m.senderId === 'local') : !m.isAI).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
                    <MessageSquare size={48} strokeWidth={1} className="mb-4" />
                    <p className="text-sm font-medium">No messages yet</p>
                    <p className="text-[10px] uppercase tracking-widest mt-1">Be the first to say hello</p>
                  </div>
                ) : (
                  messages.filter((m: Message) => activeSidebar === 'ai' ? (m.isAI || m.senderId === 'local') : !m.isAI).map((msg: Message) => (
                    <div key={msg.id} className={cn("flex flex-col gap-1", msg.senderId === 'local' ? "items-end" : "items-start")}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-micro">{msg.senderName}</span>
                        <span className="text-[10px] text-white/20 light:text-slate-300">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={cn(
                        "px-4 py-3 rounded-2xl text-sm max-w-[85%] transition-all",
                        msg.senderId === 'local' ? "bg-brand-500 text-white" : "bg-white/5 light:bg-slate-100 text-white/80 light:text-slate-700",
                        msg.isAI && "border border-brand-500/30 bg-brand-500/5 light:bg-brand-50 slam-in"
                      )}>
                        {msg.isAI ? (
                          <div className="prose prose-invert prose-sm light:prose-slate">
                            <Markdown>{msg.text}</Markdown>
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isAiThinking && (
                  <div className="flex items-center gap-3 text-brand-500">
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1 h-1 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1 h-1 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-micro text-brand-500 opacity-100">Ndovera AI is thinking</span>
                  </div>
                )}
              </div>
            ) : activeSidebar === 'participants' ? (
              <div className="space-y-4">
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 light:text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search participants..." 
                    className="w-full bg-white/5 light:bg-slate-100 border border-white/5 light:border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-brand-500/50 transition-colors"
                  />
                </div>
                {[localParticipant, ...participants].map((p: Participant) => (
                  <div key={p.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 light:bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{p.name} {p.id === 'local' && "(You)"}</span>
                        <span className="text-[10px] text-white/40 light:text-slate-500 capitalize">{p.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.isHandRaised && <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center mr-1"><span className="text-[10px]">✋</span></div>}
                      {p.isMuted ? <MicOff size={14} className="text-red-500" /> : <Mic size={14} className="text-white/40 light:text-slate-400" />}
                      {p.isCameraOff ? <VideoOff size={14} className="text-red-500" /> : <Video size={14} className="text-white/40 light:text-slate-400" />}
                    </div>
                  </div>
                ))}
              </div>
            ) : activeSidebar === 'summary' ? (
              <div className="space-y-10">
                <div className="slam-in">
                  <span className="text-micro text-brand-500 opacity-100 mb-4 block">Editorial Insight</span>
                  <h1 className="text-display mb-6 text-white/90 light:text-slate-900">Meeting Summary</h1>
                  <div className="prose prose-invert prose-sm light:prose-slate max-w-none">
                    <Markdown>{aiSummary || "Generating summary based on transcription..."}</Markdown>
                  </div>
                </div>
                
                <div className="space-y-4 pt-10 border-t border-white/5 light:border-slate-200">
                  <span className="text-micro">Technical Log</span>
                  <div className="space-y-3 font-mono">
                    {transcription.length === 0 ? (
                      <p className="text-[10px] text-white/20 italic">Waiting for transcription data...</p>
                    ) : (
                      transcription.slice(-8).map((entry: TranscriptionEntry) => (
                        <div key={entry.id} className="text-[11px] flex gap-3 group">
                          <span className="text-brand-500/50 group-hover:text-brand-500 transition-colors whitespace-nowrap">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}]</span>
                          <span className="text-white/40 whitespace-nowrap">{entry.speakerName}:</span>
                          <span className="text-white/70 light:text-slate-600">{entry.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : activeSidebar === 'notes' ? (
              <div className="h-full flex flex-col">
                <div className="flex-1 bg-white/5 light:bg-slate-100 rounded-2xl border border-white/10 light:border-slate-200 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-white/10 light:border-slate-200 flex items-center justify-between bg-black/20 light:bg-slate-200/50">
                    <span className="text-[10px] font-bold text-white/40 light:text-slate-500 uppercase tracking-widest">Collaborative Markdown</span>
                  </div>
                  <textarea
                    value={sharedNotes}
                    onChange={(e) => setSharedNotes(e.target.value)}
                    className="flex-1 w-full bg-transparent p-4 text-sm text-white/80 light:text-slate-700 focus:outline-none resize-none font-mono"
                    placeholder="Type your notes here... (Markdown supported)"
                  />
                </div>
              </div>
            ) : activeSidebar === 'whiteboard' ? (
              <div className="flex-1 flex flex-col h-full -mx-6 -mb-6">
                <Whiteboard />
              </div>
            ) : activeSidebar === 'polls' ? (
              <div className="space-y-6 flex flex-col h-full">
                {!isCreatingPoll ? (
                  <>
                    <button 
                      onClick={() => setIsCreatingPoll(true)}
                      className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      Create New Poll
                    </button>
                    
                    <div className="space-y-6 overflow-y-auto flex-1 no-scrollbar pb-4">
                      {polls.map(poll => (
                        <div key={poll.id} className="p-5 rounded-2xl bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex items-center gap-2">
                              <BarChart3 size={16} className="text-brand-500 mt-0.5" />
                              <h3 className="text-sm font-bold text-white light:text-slate-900">{poll.question}</h3>
                            </div>
                            {poll.isActive ? (
                              <button 
                                onClick={() => handleEndPoll(poll.id)}
                                className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors uppercase tracking-widest whitespace-nowrap"
                              >
                                End
                              </button>
                            ) : (
                              <span className="text-[10px] px-2 py-1 rounded bg-white/10 text-white/40 uppercase tracking-widest whitespace-nowrap">
                                Ended
                              </span>
                            )}
                          </div>
                          <div className="space-y-3">
                            {poll.options.map(option => {
                              const percent = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                              const isVoted = poll.userVotedOptionId === option.id;
                              const showResults = poll.userVotedOptionId !== null || !poll.isActive;
                              
                              return (
                                <button 
                                  key={option.id}
                                  onClick={() => handleVote(poll.id, option.id)}
                                  disabled={poll.userVotedOptionId !== null || !poll.isActive}
                                  className={cn(
                                    "w-full relative overflow-hidden rounded-xl border p-3 text-left transition-all",
                                    isVoted 
                                      ? "border-brand-500 bg-brand-500/10 light:bg-brand-50" 
                                      : "border-white/10 light:border-slate-200 hover:bg-white/5 light:hover:bg-slate-200/50",
                                    (poll.userVotedOptionId !== null && !isVoted) && "opacity-50",
                                    !poll.isActive && "opacity-70 cursor-default hover:bg-transparent"
                                  )}
                                >
                                  {showResults && (
                                    <div 
                                      className="absolute left-0 top-0 bottom-0 bg-brand-500/20 light:bg-brand-500/10 transition-all duration-1000"
                                      style={{ width: `${percent}%` }}
                                    />
                                  )}
                                  <div className="relative flex items-center justify-between z-10">
                                    <div className="flex items-center gap-2">
                                      {isVoted && <CheckCircle2 size={14} className="text-brand-500" />}
                                      <span className="text-sm font-medium text-white/90 light:text-slate-800">{option.text}</span>
                                    </div>
                                    {showResults && (
                                      <span className="text-xs font-bold text-white/60 light:text-slate-500">{percent}%</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-4 text-right">
                            <span className="text-[10px] text-white/40 light:text-slate-500 uppercase tracking-widest">{poll.totalVotes} Votes Total</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-white light:text-slate-900">Create Poll</h3>
                      <button onClick={() => setIsCreatingPoll(false)} className="text-white/40 hover:text-white transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/40 light:text-slate-500 uppercase tracking-widest">Question</label>
                      <input 
                        type="text" 
                        value={newPollQuestion}
                        onChange={(e) => setNewPollQuestion(e.target.value)}
                        placeholder="Ask a question..." 
                        className="w-full bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-500/50 transition-all"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/40 light:text-slate-500 uppercase tracking-widest">Options</label>
                      {newPollOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...newPollOptions];
                              newOpts[idx] = e.target.value;
                              setNewPollOptions(newOpts);
                            }}
                            placeholder={`Option ${idx + 1}`} 
                            className="flex-1 bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-brand-500/50 transition-all"
                          />
                          {newPollOptions.length > 2 && (
                            <button 
                              onClick={() => setNewPollOptions(newPollOptions.filter((_, i) => i !== idx))}
                              className="p-2 text-white/40 hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button 
                        onClick={() => setNewPollOptions([...newPollOptions, ''])}
                        className="text-xs text-brand-500 hover:text-brand-400 font-medium mt-2 flex items-center gap-1"
                      >
                        <Plus size={12} /> Add Option
                      </button>
                    </div>
                    
                    <button 
                      onClick={handleCreatePoll}
                      disabled={!newPollQuestion.trim() || newPollOptions.some(o => !o.trim())}
                      className="w-full py-3 mt-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all"
                    >
                      Launch Poll
                    </button>
                  </div>
                )}
              </div>
            ) : activeSidebar === 'settings' ? (
              <div className="space-y-8">
                {/* Profile Section */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-white/40 light:text-slate-500 uppercase tracking-widest">Profile</h3>
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/20 light:text-slate-400 font-medium">Display Name</label>
                    <input 
                      type="text" 
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-brand-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Device Settings */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-white/40 light:text-slate-500 uppercase tracking-widest">Devices</h3>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/20 light:text-slate-400 font-medium">Camera</label>
                    <select 
                      value={selectedVideoInput}
                      onChange={(e) => setSelectedVideoInput(e.target.value)}
                      className="w-full bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-brand-500/50 transition-all appearance-none"
                    >
                      {devices.filter((d: MediaDeviceInfo) => d.kind === 'videoinput').map((d: MediaDeviceInfo) => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900 text-white">
                          {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-white/20 light:text-slate-400 font-medium">Microphone</label>
                    <select 
                      value={selectedAudioInput}
                      onChange={(e) => setSelectedAudioInput(e.target.value)}
                      className="w-full bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-brand-500/50 transition-all appearance-none"
                    >
                      {devices.filter((d: MediaDeviceInfo) => d.kind === 'audioinput').map((d: MediaDeviceInfo) => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900 text-white">
                          {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-white/20 light:text-slate-400 font-medium">Speaker</label>
                    <select 
                      className="w-full bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-brand-500/50 transition-all appearance-none"
                    >
                      {devices.filter((d: MediaDeviceInfo) => d.kind === 'audiooutput').length > 0 ? (
                        devices.filter((d: MediaDeviceInfo) => d.kind === 'audiooutput').map((d: MediaDeviceInfo) => (
                          <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900 text-white">
                            {d.label || `Speaker ${d.deviceId.slice(0, 5)}`}
                          </option>
                        ))
                      ) : (
                        <option value="default" className="bg-zinc-900 text-white">System Default Speaker</option>
                      )}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-white/20 light:text-slate-400 font-medium">Audio Quality</label>
                    <select 
                      value={audioQuality}
                      onChange={(e) => setAudioQuality(e.target.value as 'standard' | 'high-fidelity')}
                      className="w-full bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-brand-500/50 transition-all appearance-none"
                    >
                      <option value="standard" className="bg-zinc-900 text-white">Standard (Voice Optimized)</option>
                      <option value="high-fidelity" className="bg-zinc-900 text-white">High Fidelity (Music/Original Sound)</option>
                    </select>
                    <p className="text-[10px] text-white/40 mt-1">
                      {audioQuality === 'standard' 
                        ? 'Includes echo cancellation and noise suppression.' 
                        : 'Disables processing for pure audio capture.'}
                    </p>
                  </div>
                </div>

                {/* Appearance */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-white/40 light:text-slate-500 uppercase tracking-widest">Appearance</h3>
                  <button 
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 light:bg-slate-100 hover:bg-white/10 light:hover:bg-slate-200 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                      <span className="text-xs font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </div>
                    <div className={cn(
                      "w-10 h-5 rounded-full relative transition-colors",
                      theme === 'dark' ? "bg-brand-500" : "bg-slate-300"
                    )}>
                      <div className={cn(
                        "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                        theme === 'dark' ? "right-1" : "left-1"
                      )} />
                    </div>
                  </button>
                </div>

                {/* Quick Toggles */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-white/40 light:text-slate-500 uppercase tracking-widest">Quick Toggles</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setIsMuted(!isMuted)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                        isMuted ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-white/5 border-white/5 text-white/60"
                      )}
                    >
                      {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                      <span className="text-[10px] font-bold uppercase tracking-widest">Mute</span>
                    </button>
                    <button 
                      onClick={() => setIsCameraOff(!isCameraOff)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                        isCameraOff ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-white/5 border-white/5 text-white/60"
                      )}
                    >
                      {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
                      <span className="text-[10px] font-bold uppercase tracking-widest">Camera</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {(activeSidebar === 'chat' || activeSidebar === 'ai') && (
            <div className="p-6 border-t border-white/5 light:border-slate-200">
              <form onSubmit={handleSendMessage} className="relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={activeSidebar === 'ai' ? "Ask Ndovera AI..." : "Type a message..."}
                  className="w-full bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-2xl py-4 pl-6 pr-14 text-sm focus:outline-none focus:border-brand-500/50 transition-all"
                />
                <button 
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
