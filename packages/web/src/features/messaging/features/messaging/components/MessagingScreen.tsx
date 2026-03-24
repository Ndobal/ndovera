import React, { useState, useEffect, useRef } from 'react';
import { UserRole, User, Message, Conversation } from '../../../shared/types/index';
import { Search, Send, Paperclip, ChevronLeft, Plus, CheckCircle2 } from 'lucide-react';
import { fetchWithAuth, resolveApiUrl } from '../../../../../services/apiClient';

import NewConversationModal from './NewConversationModal';

const ConversationListItem = ({ conversation, isActive, onClick }) => {
  return (
    <button onClick={onClick} className={`w-full text-left p-4 border-l-4 ${isActive ? 'border-emerald-500 bg-slate-800/50' : 'border-transparent hover:bg-slate-800/30'}`}>
      <div className="flex items-center gap-3">
        <img src={conversation.user_avatar} alt={conversation.user_name} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer"/>
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <p className="font-bold text-sm text-slate-200">{conversation.user_name}</p>
            <p className="text-xs text-slate-500">{new Date(conversation.last_message_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <p className="text-xs text-slate-400 truncate pr-4">{conversation.last_message_text}</p>
        </div>
        {conversation.unread_count > 0 && <div className="w-4 h-4 bg-emerald-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">{conversation.unread_count}</div>}
      </div>
    </button>
  );
};

const ChatMessage = ({ message, isYou, users, currentUser }) => {
  const sender = users[message.sender_id];
  if (!sender) return null; // Don't render message if sender is not found

  const otherUserIds = Object.keys(users).filter(key => key !== currentUser.id);
  let readByList = [];
  try {
    if (typeof message.read_by === 'string') {
      readByList = JSON.parse(message.read_by);
    } else if (Array.isArray(message.read_by)) {
      readByList = message.read_by;
    }
  } catch (e) {
    console.error("Failed to parse read_by:", message.read_by);
  }
  const isRead = readByList.length > 0 && otherUserIds.some(id => readByList.includes(id));

  return (
    <div className={`flex items-end gap-2 ${isYou ? 'justify-end' : 'justify-start'}`}>
        {!isYou && <img src={sender.avatarUrl} alt={sender.name} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer"/>}
        <div className={`max-w-xs p-3 rounded-2xl ${isYou ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
            <p className="text-sm">{message.text}</p>
            {message.attachment && (
              <div className="mt-2">
                {message.attachment.file_type.startsWith('image/') ? (
                  <img src={message.attachment.file_path} alt={message.attachment.file_name} className="rounded-lg" />
                ) : (
                  <a href={message.attachment.file_path} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">{message.attachment.file_name}</a>
                )}
              </div>
            )}
            <div className="flex items-center justify-end gap-1 mt-1">
              <p className={`text-[10px] ${isYou ? 'text-emerald-200' : 'text-slate-500'}`}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              {isYou && isRead && <CheckCircle2 className="w-3 h-3 text-emerald-200" />}
            </div>
        </div>
    </div>
  )
}

export default function MessagingScreen({ onBack }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const ws = useRef<WebSocket | null>(null);

  const currentUser = { id: 'user_teacher_1' }; // This would come from auth in a real app

  useEffect(() => {
    // Fetch initial data
    async function fetchData() {
      try {
        const usersRes = await fetch(resolveApiUrl('/api/users'));
        if (!usersRes.ok) throw new Error('Failed to fetch users');
        const usersData = await usersRes.json();
        const usersMap = usersData.reduce((acc, user) => ({ ...acc, [user.id]: user }), {});
        setUsers(usersMap);

        const convRes = await fetch(resolveApiUrl('/api/conversations'));
        if (!convRes.ok) throw new Error('Failed to fetch conversations');
        const convData = await convRes.json();
        setConversations(convData);
        if (convData.length > 0) {
          setActiveConversation(convData[0]);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    }
    fetchData();

    // WebSocket connection
    const wsUrl = `wss://${window.location.host}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const received = JSON.parse(event.data);
      if (received.type === 'online_users') {
        setOnlineUsers(new Set(received.users));
      } else if (received.type === 'typing') {
        if (received.conversation_id === activeConversation?.conversation_id) {
          setIsTyping(true);
        }
      } else if (received.type === 'stop_typing') {
        setIsTyping(false);
      } else {
        setMessages(prev => [...prev, received]);
      }
    };

    // ... (WebSocket logic remains the same)

    // Register service worker and subscribe to push notifications
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then(swReg => {
          console.log('Service Worker is registered', swReg);

          return swReg.pushManager.getSubscription()
            .then(subscription => {
              if (subscription === null) {
                // Create a new subscription
                const vapidPublicKey = 'BBTmUE1gnNecXMvbuR_8-dTfFi2T6NGERAMhTrcB09YRuFLQYXnWPd3petdB1jDsIQ7eP4a-4BeMRyDHzab5r6I';
                return swReg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
                });
              } else {
                // We have a subscription
                return subscription;
              }
            })
            .then(subscription => {
              // Send the subscription to the server
              fetchWithAuth('/api/subscribe', {
                method: 'POST',
                body: JSON.stringify({ subscription, userId: currentUser.id }),
                headers: {
                  'Content-Type': 'application/json'
                }
              });
            });
        })
        .catch(error => {
          console.error('Service Worker Error', error);
        });
    }

    return () => ws.current?.close();
  }, []);

  useEffect(() => {
    if (activeConversation) {
      async function fetchMessages() {
        const res = await fetch(resolveApiUrl(`/api/messages/${activeConversation.conversation_id}`));
        const data = await res.json();
        setMessages(data);

        // Mark messages as read
        data.forEach(msg => {
          let readByList = [];
          try {
            if (typeof msg.read_by === 'string') {
              readByList = JSON.parse(msg.read_by);
            } else if (Array.isArray(msg.read_by)) {
              readByList = msg.read_by;
            }
          } catch (e) {
            console.error("Failed to parse read_by:", msg.read_by);
          }

          if (msg.sender_id !== currentUser.id && !readByList.includes(currentUser.id)) {
            ws.current?.send(JSON.stringify({
              type: 'message_read',
              message_id: msg.id,
              user_id: currentUser.id,
            }));
          }
        });
      }
      fetchMessages();
    }
  }, [activeConversation]);

  const handleSendMessage = () => {
    if (newMessage.trim() === '' || !ws.current || !activeConversation) return;

    const message = {
      id: `msg_${Date.now()}`,
      conversation_id: activeConversation.conversation_id,
      sender_id: currentUser.id,
      text: newMessage,
      timestamp: Date.now(),
    };

    ws.current.send(JSON.stringify(message));
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const handleTyping = (isTyping) => {
    if (!ws.current || !activeConversation) return;
    ws.current.send(JSON.stringify({
      type: isTyping ? 'typing' : 'stop_typing',
      conversation_id: activeConversation.conversation_id,
      user_id: currentUser.id,
    }));
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !activeConversation) return;

    const formData = new FormData();
    formData.append('file', file);

    const data = await fetchWithAuth('/api/upload', {
      method: 'POST',
      body: formData,
    });

    // Create a new message with the attachment
    const message = {
      id: `msg_${Date.now()}`,
      conversation_id: activeConversation.conversation_id,
      sender_id: currentUser.id,
      text: '',
      timestamp: Date.now(),
      attachment: {
        id: `att_${Date.now()}`,
        file_name: file.name,
        file_path: data.filePath,
        file_type: file.type,
      }
    };

    ws.current.send(JSON.stringify(message));
    setMessages(prev => [...prev, message]);
  };

  const handleSelectUser = async (users, groupName) => {
    const userIds = users.map(u => u.id);
    const data = await fetchWithAuth('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, name: groupName }),
    });

    if (data.isNew) {
      // In a real app, you'd probably want to refetch conversations here
      // For now, we'll just create a placeholder on the client
      const newClientConv = {
        conversation_id: data.conversation_id,
        user_id: userIds[0], // For simplicity, just use the first user for display
        user_name: groupName || users.map(u => u.name).join(', '),
        user_avatar: 'https://picsum.photos/seed/group/100',
        last_message_text: 'Started a new conversation',
        last_message_timestamp: Date.now(),
      };
      setConversations(prev => [newClientConv, ...prev]);
      setActiveConversation(newClientConv);
    } else {
      // Conversation already exists, find and activate it
      const existing = conversations.find(c => c.conversation_id === data.conversation_id);
      if (existing) {
        setActiveConversation(existing);
      }
    }

    setIsModalOpen(false);
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length > 2) {
      const res = await fetch(resolveApiUrl(`/api/search/messages?query=${query}&userId=${currentUser.id}`));
      const data = await res.json();
      setSearchResults(data);
    } else {
      setSearchResults([]);
    }
  }

  const otherUser = activeConversation ? users[activeConversation.user_id] : null;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200">
      {isModalOpen && <NewConversationModal users={users} onSelectUser={handleSelectUser} onClose={() => setIsModalOpen(false)} />}
      {/* Sidebar with conversation list */}
      <div className="w-1/4 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">NDOVERA Chat</h2>
        </div>
        <div className="p-4 flex items-center gap-2">
            <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search messages..." 
                  className="pl-10 w-full bg-slate-800 border-none rounded-lg text-sm"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
            </div>
            <button onClick={() => setIsModalOpen(true)} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              <Plus className="w-5 h-5" />
            </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {searchQuery.length > 2 ? (
            searchResults.map(msg => (
              <div key={msg.id} className="p-4 border-b border-slate-800">
                <p className="text-sm font-bold">{msg.conversation_name || msg.sender_name}</p>
                <p className="text-xs text-slate-400">{msg.text}</p>
              </div>
            ))
          ) : (
            conversations.map(conv => (
              <ConversationListItem 
                key={conv.conversation_id} 
                conversation={conv} 
                isActive={activeConversation?.conversation_id === conv.conversation_id}
                onClick={() => setActiveConversation(conv)}
              />
            ))
          )}
        </div>
      </div>

      {/* Main chat window */}
      <div className="flex-1 flex flex-col">
        {activeConversation && otherUser ? (
          <>
            <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer"/>
                <div>
                    <h3 className="font-bold text-slate-100">{otherUser.name}</h3>
                    {isTyping ? (
                      <p className="text-xs text-emerald-400 italic">typing...</p>
                    ) : (
                      <p className={`text-xs ${onlineUsers.has(otherUser.id) ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {onlineUsers.has(otherUser.id) ? 'Online' : 'Offline'}
                      </p>
                    )}
                </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto flex flex-col-reverse">
                <div className="flex flex-col gap-4">
                    {messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} isYou={msg.sender_id === currentUser.id} users={users} currentUser={currentUser} />
                    ))}
                </div>
            </div>
            <div className="p-4 border-t border-slate-800">
                <div className="bg-slate-800 rounded-lg flex items-center">
                    <input 
                      type="text" 
                      placeholder={`Message ${otherUser.name}...`} 
                      className="flex-1 bg-transparent border-none rounded-lg text-sm pl-4 py-3 focus:ring-0"
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping(e.target.value.length > 0);
                      }}
                      onBlur={() => handleTyping(false)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <div className="flex items-center gap-1 p-2">
                    <input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} />
                    <label htmlFor="file-upload" className="p-2 text-slate-400 hover:text-white cursor-pointer"><Paperclip className="w-4 h-4"/></label>
                    <button onClick={handleSendMessage} className="p-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"><Send className="w-4 h-4"/></button>
                    </div>
                </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">Select a conversation to start chatting</div>
        )}
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
