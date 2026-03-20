import React, { useState } from 'react';
import { Cake, Send, RefreshCw } from 'lucide-react';
import { Role } from '../types';

export const Birthdays = ({ role }: { role: Role }) => {
  const [msg, setMsg] = useState('');
  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between gap-2'>
        <h2 className='text-xl font-bold text-white'><Cake className='inline mr-2 text-pink-500'/>Birthdays & Celebrations</h2>
      </div>
      <div className='card-compact'>
        <p className='text-white mb-2 text-sm'>Send a message (Max 140 chars)</p>
        <textarea maxLength={140} value={msg} onChange={e => setMsg(e.target.value)} className='w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none' placeholder='Happy Birthday!' />
        <button onClick={() => setMsg('')} className='mt-2 bg-pink-600 px-4 py-2 rounded-xl text-white text-xs font-bold uppercase tracking-wider'><Send size={14} className='inline mr-1'/> Send</button>
      </div>

      <h3 className='text-white font-bold mt-4'>Recent Messages</h3>
      <div className='space-y-4'>
        <div className='card-compact bg-white/5'><p className='text-zinc-300 text-sm'>Wishing you a fantastic year! (Automated)</p></div>
        <div className='card-compact bg-white/5'><p className='text-zinc-300 text-sm'>Happy birthday from Ndovera! (Automated)</p></div>
      </div>
    </div>
  );
};
