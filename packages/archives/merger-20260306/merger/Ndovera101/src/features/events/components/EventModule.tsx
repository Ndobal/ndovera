import React from 'react';
import { Calendar, MapPin, Clock, Plus, Filter, Search, ChevronRight, Users, Globe } from 'lucide-react';
import { UserRole } from '../../../shared/types';

export default function EventModule({ role }: { role: UserRole }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Events & Open Day</h2>
          <p className="text-slate-500">Schedule and manage school events, sports days, and virtual open days.</p>
        </div>
        <button 
          onClick={() => alert('Opening Event Scheduler...')}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Upcoming Events</h3>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                  <Filter className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { title: 'Inter-House Sports Day 2026', date: 'March 12, 2026', time: '09:00 AM', location: 'School Sports Complex', type: 'Sports', attendees: 850, img: 'https://picsum.photos/seed/sports/800/400' },
                { title: 'Virtual Open Day', date: 'March 20, 2026', time: '11:00 AM', location: 'Online (Zoom)', type: 'Admission', attendees: 120, img: 'https://picsum.photos/seed/open/800/400' },
                { title: 'Annual Science Fair', date: 'April 5, 2026', time: '10:00 AM', location: 'Main Hall', type: 'Academic', attendees: 450, img: 'https://picsum.photos/seed/science/800/400' },
              ].map((event, i) => (
                <div key={i} className="group rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden hover:border-emerald-200 dark:hover:border-emerald-500/50 transition-all cursor-pointer">
                  <div className="h-48 relative overflow-hidden">
                    <img src={event.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1 rounded-lg shadow-sm">
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{event.type}</p>
                    </div>
                  </div>
                  <div className="p-6 bg-white dark:bg-slate-900">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{event.title}</h4>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            <span>{event.date}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            <span>{event.time}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" />
                            <span>{event.location}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{event.attendees}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Registered</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex -space-x-2">
                        {[1, 2, 3, 4].map(n => (
                          <img key={n} src={`https://picsum.photos/seed/user${n}/32/32`} alt="" className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900" />
                        ))}
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          +12
                        </div>
                      </div>
                      <button className="flex items-center gap-2 text-emerald-600 font-bold text-sm hover:underline group/btn">
                        Manage Event
                        <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                <Globe className="w-6 h-6" />
                <span className="text-xs font-bold">Virtual Tour</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors">
                <Users className="w-6 h-6" />
                <span className="text-xs font-bold">Visitor Log</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
                <Calendar className="w-6 h-6" />
                <span className="text-xs font-bold">Calendar</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors">
                <Plus className="w-6 h-6" />
                <span className="text-xs font-bold">New Task</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900 dark:bg-slate-950 p-6 rounded-2xl text-white border border-slate-800">
            <h3 className="font-bold mb-4">Open Day Stats</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Total Registrations</p>
                <p className="text-2xl font-bold">1,450</p>
                <p className="text-[10px] text-emerald-400 font-bold mt-1">+15% from last year</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Conversion Rate</p>
                <p className="text-2xl font-bold">24%</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Visitors to Applicants</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
