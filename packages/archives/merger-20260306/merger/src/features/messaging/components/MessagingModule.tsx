import React, { useState } from 'react';
import { Search, Send, Paperclip, User, Users } from 'lucide-react';

const mockConversations = [
  { id: 'conv_01', name: 'Bisi Adebayo (Student)', lastMessage: 'Good morning, sir. I have a question about the assignment.', time: '10:45 AM', unread: 2, type: 'Student' },
  { id: 'conv_02', name: 'Mr. & Mrs. Okoro (Parents)', lastMessage: "Thank you for the update on Chinedu's progress.", time: '9:30 AM', unread: 0, type: 'Parent' },
  { id: 'conv_03', name: 'Fatima Bello (Student)', lastMessage: 'Okay, I will submit it before the deadline.', time: 'Yesterday', unread: 0, type: 'Student' },
];

const mockMessages = {
  'conv_01': [
    { sender: 'Bisi Adebayo', text: 'Good morning, sir. I have a question about the assignment.', time: '10:45 AM' },
    { sender: 'You', text: 'Good morning, Bisi. I am here to help. What is your question?', time: '10:46 AM' },
  ],
  'conv_02': [
    { sender: 'Mr. & Mrs. Okoro', text: "Thank you for the update on Chinedu's progress.", time: '9:30 AM' },
  ],
  'conv_03': [
    { sender: 'Fatima Bello', text: 'Okay, I will submit it before the deadline.', time: 'Yesterday' },
  ],
};

export default function MessagingModule() {
  const [activeConversation, setActiveConversation] = useState(mockConversations[0]);

  return (
    <div className="flex h-[calc(100vh-100px)] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Conversation List */}
      <div className="w-1/4 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100">Messaging</h2>
        </div>
        <div className="p-4">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Search messages..." className="pl-10 w-full bg-slate-800 border-none rounded-lg text-sm"/>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto">
            {mockConversations.map(conv => (
                <button key={conv.id} onClick={() => setActiveConversation(conv)} className={`w-full text-left p-4 border-l-4 ${activeConversation.id === conv.id ? 'border-emerald-500 bg-slate-800/50' : 'border-transparent hover:bg-slate-800/30'}`}>
                    <div className="flex justify-between items-center">
                        <p className="font-bold text-sm text-slate-200">{conv.name}</p>
                        <p className="text-xs text-slate-500">{conv.time}</p>
                    </div>
                    <p className="text-xs text-slate-400 truncate pr-4">{conv.lastMessage}</p>
                    {conv.unread > 0 && <div className="w-4 h-4 bg-emerald-500 text-white text-[10px] flex items-center justify-center rounded-full mt-1 font-bold">{conv.unread}</div>}
                </button>
            ))}
        </div>
      </div>

      {/* Chat Window */}
      <div className="w-1/2 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeConversation.type === 'Student' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                {activeConversation.type === 'Student' ? <User className="w-5 h-5"/> : <Users className="w-5 h-5"/>}
            </div>
            <div>
                <h3 className="font-bold text-slate-100">{activeConversation.name}</h3>
                <p className="text-xs text-emerald-400">Online</p>
            </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto flex flex-col-reverse">
            <div className="flex flex-col gap-4">
                {mockMessages[activeConversation.id].map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs p-3 rounded-2xl ${msg.sender === 'You' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
                            <p className="text-sm">{msg.text}</p>
                            <p className={`text-[10px] text-right mt-1 ${msg.sender === 'You' ? 'text-emerald-200' : 'text-slate-500'}`}>{msg.time}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <div className="p-4 border-t border-slate-800">
            <div className="relative">
                <input type="text" placeholder="Type a message..." className="w-full bg-slate-800 border-none rounded-lg text-sm pr-24"/>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button className="p-2 text-slate-400 hover:text-white"><Paperclip className="w-4 h-4"/></button>
                    <button className="p-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"><Send className="w-4 h-4"/></button>
                </div>
            </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="w-1/4 border-l border-slate-800">
        <div className="p-4 text-center border-b border-slate-800">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-2 ${activeConversation.type === 'Student' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                {activeConversation.type === 'Student' ? <User className="w-10 h-10"/> : <Users className="w-10 h-10"/>}
            </div>
            <h3 className="font-bold text-slate-100">{activeConversation.name}</h3>
            <p className="text-xs text-slate-400">{activeConversation.type}</p>
        </div>
        <div className="p-4">
            <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Details</h4>
            <p className="text-sm text-slate-300">Class: SS3</p>
            {activeConversation.type === 'Parent' && <p className="text-sm text-slate-300">Child: Chinedu Okoro</p>}
        </div>
      </div>
    </div>
  );
}

