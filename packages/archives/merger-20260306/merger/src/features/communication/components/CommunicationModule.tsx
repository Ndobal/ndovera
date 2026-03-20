import React from 'react';
import { MessageSquare, Bell, Mail, Send, Filter, Search, Plus, Megaphone, UserPlus } from 'lucide-react';
import { UserRole } from '../../../shared/types';

export default function CommunicationModule({ role }: { role: UserRole }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Communication Center</h2>
          <p className="text-slate-500">Manage school announcements, advertisements, and parent communication.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Announcement
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Recent Announcements</h3>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                  <Filter className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { title: 'School Fees Deadline Extension', content: 'The deadline for first term school fees has been extended to March 15th...', author: 'Bursar', date: '2 hours ago', type: 'Finance' },
                { title: 'Inter-House Sports Recruitment', content: 'All students interested in participating in the upcoming sports day should register...', author: 'Sports Dept', date: '5 hours ago', type: 'Event' },
                { title: 'New Science Lab Equipment', content: 'We are excited to announce the arrival of new laboratory equipment for the secondary section...', author: 'HOS', date: 'Yesterday', type: 'Academic' },
                { title: 'Parent-Teacher Association Meeting', content: 'The next PTA meeting is scheduled for Saturday, March 7th at 10:00 AM...', author: 'Admin', date: 'Feb 23', type: 'General' },
              ].map((msg, i) => (
                <div key={i} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        msg.type === 'Finance' ? 'bg-emerald-500' : 
                        msg.type === 'Event' ? 'bg-blue-500' : 
                        msg.type === 'Academic' ? 'bg-purple-500' : 'bg-slate-400'
                      }`}></span>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 transition-colors">{msg.title}</h4>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{msg.date}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">{msg.content}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                        {msg.author.charAt(0)}
                      </div>
                      <span className="text-xs text-slate-500 font-medium">{msg.author}</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-400">
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-400">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full py-4 bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Load More Announcements
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6">Active Advertisements</h3>
            <div className="space-y-4">
              {[
                { title: 'School Branded Merch', status: 'Active', reach: '1.2k', img: 'https://picsum.photos/seed/merch/300/150' },
                { title: 'Summer Camp 2026', status: 'Scheduled', reach: '0', img: 'https://picsum.photos/seed/camp/300/150' },
              ].map((ad, i) => (
                <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden group">
                  <img src={ad.img} alt="" className="w-full h-24 object-cover group-hover:scale-105 transition-transform" />
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{ad.title}</h4>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ad.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                        {ad.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                      <Megaphone className="w-3 h-3" />
                      <span>Reach: {ad.reach} views</span>
                    </div>
                  </div>
                </div>
              ))}
              <button className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 rounded-xl text-sm font-bold hover:border-emerald-300 hover:text-emerald-600 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Create New Ad
              </button>
            </div>
          </div>

          <div className="bg-slate-900 dark:bg-black p-6 rounded-2xl text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-600 rounded-lg">
                <UserPlus className="w-5 h-5" />
              </div>
              <h3 className="font-bold">Parent Portal</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">95% of parents are active on the portal. Use automated SMS for the remaining 5%.</p>
            <div className="space-y-3">
              <button className="w-full py-2 bg-white text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors">
                Send Bulk SMS
              </button>
              <button className="w-full py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors">
                Parent Directory
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
