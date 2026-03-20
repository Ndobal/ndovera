import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, UserCircle } from 'lucide-react';
import { fetchWithAuth } from '../services/apiClient';
import { loadUser } from '../services/authLocal';

export const ChatIcon = ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => {
  const user = loadUser();
  const canFetchChat = Boolean(user?.id && Array.isArray(user.roles) && user.roles.length > 0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [chats, setChats] = useState<any[]>([
    { id: '1', sender: 'Mary Ndukwe', text: 'Have you finalized the grades?', is_read: false, time: '10:30 AM' },
    { id: '2', sender: 'System Admin', text: 'Please check the new timetable update.', is_read: false, time: '09:12 AM' },
    { id: '3', sender: 'John Doe (Parent)', text: 'I will be arriving late for pickup today.', is_read: false, time: 'Yesterday' }
  ]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveChatId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadChatCount = async () => {
    if (!canFetchChat) return;
    try {
      const result = await fetchWithAuth('/api/chat/unread').catch(() => null);
      if (result && typeof result.count === 'number') {
        setUnreadCount(result.count);
      } else {
        setUnreadCount(chats.filter(c => !c.is_read).length);
      }
    } catch (err) {
      setUnreadCount(chats.filter(c => !c.is_read).length);
    }
  };

  useEffect(() => {
    if (!canFetchChat) return;
    loadChatCount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetchChat, chats]);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setActiveChatId(null);
    }
  };

  const handleSendReply = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    
    setChats(prev => prev.map(c => c.id === id ? { ...c, is_read: true } : c));
    setReplyText('');
    setActiveChatId(null);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button 
        onClick={handleOpen} 
        className={`p-2 rounded-lg relative transition-colors ${isOpen ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-zinc-400'}`}
      >
        <MessageSquare size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white border-2 border-[#0A0B0D]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 w-80 bg-[#151619] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#151619]/80">
            <h3 className="font-bold text-white">Recent Messages</h3>
            <span className="text-xs text-indigo-400">{unreadCount} unread</span>
          </div>
          
          <div className="max-h-[350px] overflow-y-auto w-full">
            {chats.map(chat => (
              <div key={chat.id} className={`border-b border-white/10 last:border-0 transition-colors ${chat.is_read ? 'bg-transparent' : 'bg-indigo-500/5'}`}>
                <div 
                  className="p-4 cursor-pointer hover:bg-white/5 flex gap-3"
                  onClick={() => {
                    setActiveChatId(activeChatId === chat.id ? null : chat.id);
                    if (!chat.is_read) {
                      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, is_read: true } : c));
                    }
                  }}
                >
                  <div className="shrink-0 mt-1">
                    <UserCircle className={`w-8 h-8 ${chat.is_read ? 'text-zinc-500' : 'text-indigo-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm truncate pr-2 ${chat.is_read ? 'text-zinc-300 font-medium' : 'text-white font-bold'}`}>{chat.sender}</span>
                      <span className="text-[10px] whitespace-nowrap text-zinc-500">{chat.time}</span>
                    </div>
                    <p className={`text-xs line-clamp-2 ${chat.is_read ? 'text-zinc-400' : 'text-indigo-200'}`}>
                      {chat.text}
                    </p>
                  </div>
                </div>

                {activeChatId === chat.id && (
                  <div className="px-4 pb-4">
                    <form onSubmit={(e) => handleSendReply(e, chat.id)} className="flex items-center gap-2 mt-2">
                      <input 
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type a quick reply..."
                        className="flex-1 bg-[#0A0B0D] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        autoFocus
                      />
                      <button type="submit" disabled={!replyText.trim()} className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-lg transition-colors">
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
            
            {chats.length === 0 && (
              <p className="text-sm text-zinc-400 text-center py-8">No recent messages</p>
            )}
          </div>
          
          <div className="p-3 border-t border-white/10 bg-[#151619]/80">
            <button 
              onClick={() => { setIsOpen(false); setActiveTab('chat'); }} 
              className="w-full py-2 text-center text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-indigo-400"
            >
              Open Full Chat Panel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};