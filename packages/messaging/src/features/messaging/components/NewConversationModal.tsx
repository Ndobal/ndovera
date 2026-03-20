import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function NewConversationModal({ users, onSelectUser, onClose }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const currentUser = { id: 'user_teacher_1' }; // This would come from auth

  const handleUserSelect = (user) => {
    setSelectedUsers(prev => 
      prev.find(u => u.id === user.id) 
        ? prev.filter(u => u.id !== user.id) 
        : [...prev, user]
    );
  }

  const handleCreateConversation = () => {
    onSelectUser(selectedUsers, groupName);
  }

  return (
    <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">Start a New Conversation</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {selectedUsers.length > 1 && (
            <input 
              type="text"
              placeholder="Group Name (optional)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-slate-700 border-none rounded-lg text-sm mb-4"
            />
          )}
          <p className="text-sm text-slate-400 mb-4">Select one or more users to start chatting with:</p>
          <div className="max-h-80 overflow-y-auto">
            {Object.values(users).filter(user => user.id !== currentUser.id).map(user => (
              <button 
                key={user.id} 
                onClick={() => handleUserSelect(user)}
                className={`w-full text-left p-3 flex items-center gap-3 rounded-lg ${selectedUsers.find(u => u.id === user.id) ? 'bg-emerald-600/50' : 'hover:bg-slate-700/50'}`}
              >
                <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer"/>
                <div>
                  <p className="font-bold text-slate-200">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.role}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-700">
          <button 
            onClick={handleCreateConversation} 
            disabled={selectedUsers.length === 0}
            className="w-full bg-emerald-600 text-white rounded-lg py-2 disabled:bg-slate-600"
          >
            Start Conversation
          </button>
        </div>
      </div>
    </div>
  );
}
