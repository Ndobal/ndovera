import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { fetchWithAuth } from '../services/apiClient';

export const NotificationsPage = () => {
  const { data: user } = useData<any>('/api/users/me');
  const canFetchNotifications = Boolean(user?.id && Array.isArray(user.roles) && user.roles.length > 0);
  const { data: notifications, mutate } = useData<any[]>('/api/notifications', { enabled: canFetchNotifications });

  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [isSending, setIsSending] = useState(false);

  const isAdmin = user?.roles?.some(r => ['School Admin', 'HOS', 'Super Admin', 'Owner'].includes(r));

  const handleSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message) return;
    setIsSending(true);
    try {
      const res = await fetchWithAuth('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, targetRole })
      });
      if (res) {
        setMessage('');
        mutate();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const markAsRead = async (id: string, currentRead: boolean) => {
    if (currentRead) return;
    try {
      await fetchWithAuth('/api/notifications/' + id + '/read', {
        method: 'PUT',
      });
      mutate();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">All Notifications</h2>
        <p className="text-zinc-500 text-xs">View all your notifications in one place.</p>
      </div>
      {!canFetchNotifications && (
        <div className="card-compact text-sm text-zinc-400">
          Sign in to load your notifications.
        </div>
      )}

      {isAdmin && (
        <div className="card-compact bg-blue-500/5 mb-6">
          <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Admin Broadcast</h3>
          <form onSubmit={handleSendNotice} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your announcement here..."
                  className="w-full bg-[#111] border border-white/10 rounded-xl p-3 text-sm text-white outline-none resize-none h-[100px]"
                  required
                />
              </div>
              <div className="w-full md:w-64 space-y-4">
                 <div>
                    <select 
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      className="w-full bg-[#111] border border-white/10 rounded-xl p-3 text-sm text-white outline-none"
                    >
                      <option value="">All Users</option>
                      <option value="Teacher">All Teachers</option>
                      <option value="Student">All Students</option>
                      <option value="Parent">All Parents</option>
                      <option value="Staff">All Staff</option>
                    </select>
                 </div>
                 <button 
                  type="submit" 
                  disabled={isSending || !message}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   {isSending ? 'Sending...' : 'Send Broadcast'}
                 </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {notifications?.map(n => (
          <div key={n.id} onClick={() => markAsRead(n.id, n.is_read)} className="card-compact group cursor-pointer hover:bg-white/5 transition-colors">
            <div className="flex items-start gap-4">
              <div className={`w-2 h-2 rounded-full mt-1.5 ${n.is_read ? 'bg-slate-600' : 'bg-emerald-500'}`}></div>
              <div>
                <p className={`text-sm ${n.is_read ? 'text-white' : 'text-emerald-400 font-semibold'}`}>{n.message}</p>
                <p className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
        {(!notifications || notifications.length === 0) && (
          <p className="text-sm text-slate-400 text-center py-4">No notifications</p>
        )}
      </div>
    </div>
  );
};
