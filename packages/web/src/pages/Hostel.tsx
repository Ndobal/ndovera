import React, { useState } from 'react';
import {
  AlertCircle,
  Bed,
  ChevronRight,
  Download,
  Filter,
  Home,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { Role } from '../types';

export const HostelView = ({ role }: { role: Role }) => {
  const roleName = String(role || '');
  const isStudent = roleName === 'Student';
  const isParent = roleName === 'Parent';
  const isHostelManager = ['Hostel Manager', 'Hostel Prefect', 'Hostel Staff', 'Owner', 'HoS', 'School Admin', 'Super Admin'].includes(roleName);
  const [activeTab, setActiveTab] = useState<'rooms' | 'students' | 'maintenance' | 'contacts' | 'report'>(
    isHostelManager ? 'rooms' : isParent ? 'contacts' : 'students'
  );

  const stats = isHostelManager
    ? [
        { label: 'Total Capacity', value: '450', icon: <Users size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Occupied', value: '412', icon: <Bed size={16} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Maintenance', value: '8', icon: <Zap size={16} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        { label: 'Security Status', value: 'Active', icon: <ShieldCheck size={16} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
      ]
    : [
        { label: 'Room', value: 'Blue Block 2', icon: <Home size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Space', value: 'Space 06', icon: <Users size={16} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Bunk', value: 'Top Bunk', icon: <Bed size={16} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        { label: 'Safety', value: 'Supervised', icon: <ShieldCheck size={16} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
      ];

  const rooms = [
    { id: 'RM-101', wing: 'Male Wing A', capacity: 4, occupied: 4, status: 'Full' },
    { id: 'RM-102', wing: 'Male Wing A', capacity: 4, occupied: 3, status: 'Available' },
    { id: 'RM-201', wing: 'Female Wing B', capacity: 4, occupied: 4, status: 'Full' },
    { id: 'RM-202', wing: 'Female Wing B', capacity: 4, occupied: 2, status: 'Available' },
  ];

  const myHostelView = {
    room: 'Blue Block 2',
    space: 'Space 06',
    bunk: 'Top Bunk',
    rules: [
      'Lights out starts at 10:00 PM.',
      'Hostel exit requires approval from the hostel manager.',
      'Keep bunk and locker area clean at all times.',
    ],
    contacts: [
      { title: 'Hostel Manager', name: 'Mrs. Adeola Yusuf', note: 'Overall hostel supervision' },
      { title: 'Hostel Prefect', name: 'Esther James', note: 'Student hostel coordination' },
      { title: 'Hostel Staff', name: 'Mr. Ibrahim Lawal', note: 'Night shift support' },
    ],
  };

  const parentContacts = [
    { title: 'Hostel Manager', action: 'Chat about welfare or bed-space concerns' },
    { title: 'Hostel Prefect', action: 'Chat about day-to-day hostel safety observations' },
    { title: 'Hostel Staff', action: 'Chat about supervision or immediate care issues' },
    { title: 'School Admin', action: 'Report safeguarding concerns to the school administration' },
  ];

  const maintenance = [
    'Bed frame repair request in Female Wing B',
    'Bathroom tap replacement pending approval',
    'Window lock inspection scheduled for Blue Block 2',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Hostel</h2>
          <p className="text-xs text-zinc-500">
            {isHostelManager
              ? 'Manage room allocations, safeguarding, hostel operations, and maintenance.'
              : isParent
                ? 'View your child’s hostel details and contact the people responsible for student safety.'
                : 'See only your room, space, bunk, rules, and the hostel contacts responsible for your safety.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 transition-all hover:bg-white/10">
            <Download size={14} /> Export List
          </button>
          {isHostelManager ? (
            <button className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/20">
              <Plus size={14} /> Allocate Room
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="card-mini flex items-center gap-3">
            <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{stat.label}</p>
              <p className="text-base font-mono font-bold text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-6 border-b border-white/5">
        {isHostelManager ? (
          <button
            onClick={() => setActiveTab('rooms')}
            className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'rooms' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Room Overview
            {activeTab === 'rooms' ? <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-full bg-emerald-500"></div> : null}
          </button>
        ) : null}

        <button
          onClick={() => setActiveTab('students')}
          className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'students' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          {isHostelManager ? 'Residents' : isParent ? 'Child Hostel View' : 'My Hostel View'}
          {activeTab === 'students' ? <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-full bg-emerald-500"></div> : null}
        </button>

        {isHostelManager ? (
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'maintenance' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Maintenance
            {activeTab === 'maintenance' ? <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-full bg-emerald-500"></div> : null}
          </button>
        ) : null}

        {!isStudent ? (
          <button
            onClick={() => setActiveTab('contacts')}
            className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'contacts' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {isParent ? 'Safety Contacts' : 'Safeguarding'}
            {activeTab === 'contacts' ? <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-full bg-emerald-500"></div> : null}
          </button>
        ) : null}

        {isParent ? (
          <button
            onClick={() => setActiveTab('report')}
            className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'report' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Report to school admin
            {activeTab === 'report' ? <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-full bg-emerald-500"></div> : null}
          </button>
        ) : null}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'rooms' && isHostelManager ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {rooms.map((room) => (
              <div key={room.id} className="card-compact group cursor-pointer border border-white/5 transition-all hover:border-emerald-500/30">
                <div className="mb-4 flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-emerald-500 transition-all group-hover:bg-emerald-600 group-hover:text-white">
                    <Home size={20} />
                  </div>
                  <span className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${room.status === 'Full' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {room.status}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-zinc-200">{room.id}</h4>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{room.wing}</p>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[10px]">
                    <span className="text-zinc-500">Occupancy</span>
                    <span className="font-bold text-white">{room.occupied}/{room.capacity}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className={`h-full ${room.occupied === room.capacity ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${(room.occupied / room.capacity) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'students' && !isHostelManager ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="card-compact border border-white/5">
              <h3 className="text-lg font-bold text-white">{isParent ? 'Child hostel details' : 'My hostel details'}</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white/4 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Room</p>
                  <p className="mt-2 text-sm font-semibold text-white">{myHostelView.room}</p>
                </div>
                <div className="rounded-2xl bg-white/4 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Space</p>
                  <p className="mt-2 text-sm font-semibold text-white">{myHostelView.space}</p>
                </div>
                <div className="rounded-2xl bg-white/4 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Bunk</p>
                  <p className="mt-2 text-sm font-semibold text-white">{myHostelView.bunk}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/4 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Hostel rules</p>
                <div className="mt-3 space-y-2">
                  {myHostelView.rules.map((rule) => (
                    <div key={rule} className="flex items-start gap-2 text-sm text-zinc-300">
                      <ShieldCheck size={14} className="mt-0.5 text-emerald-400" />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card-compact border border-white/5">
              <h3 className="text-lg font-bold text-white">Responsible contacts</h3>
              <div className="mt-4 space-y-3">
                {myHostelView.contacts.map((contact) => (
                  <div key={contact.title} className="rounded-2xl bg-white/4 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{contact.title}</p>
                    <p className="mt-2 text-sm font-semibold text-white">{contact.name}</p>
                    <p className="mt-1 text-xs text-zinc-400">{contact.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'students' && isHostelManager ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input className="w-full rounded-xl border border-white/5 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-all focus:border-emerald-500/50" placeholder="Search resident by room, bunk, or name" />
              </div>
              <button className="rounded-xl border border-white/5 bg-white/5 p-2.5 text-zinc-400 transition-all hover:text-white">
                <Filter size={18} />
              </button>
            </div>

            <div className="card-compact overflow-hidden p-0!">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/5 bg-white/2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <th className="px-6 py-4">Resident</th>
                    <th className="px-6 py-4">Room</th>
                    <th className="px-6 py-4">Space / Bunk</th>
                    <th className="px-6 py-4">Safeguarding</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    { id: 'RS-01', name: 'Alice Johnson', room: 'RM-201', bunk: 'Space 03 • Bottom bunk', status: 'Cleared' },
                    { id: 'RS-02', name: 'Daniel Musa', room: 'RM-102', bunk: 'Space 06 • Top bunk', status: 'Monitor' },
                    { id: 'RS-03', name: 'Grace Obi', room: 'RM-202', bunk: 'Space 01 • Bottom bunk', status: 'Cleared' },
                  ].map((resident) => (
                    <tr key={resident.id} className="group transition-colors hover:bg-white/1">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-zinc-200">{resident.name}</p>
                        <p className="text-[10px] font-mono text-zinc-500">{resident.id}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-300">{resident.room}</td>
                      <td className="px-6 py-4 text-xs text-zinc-400">{resident.bunk}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${resident.status === 'Cleared' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300'}`}>
                          {resident.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-zinc-600 transition-colors hover:text-white">
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === 'maintenance' && isHostelManager ? (
          <div className="grid gap-3 md:grid-cols-3">
            {maintenance.map((item) => (
              <div key={item} className="card-compact border border-white/5 text-sm text-zinc-300">
                {item}
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'contacts' && isParent ? (
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="card-compact border border-white/5">
              <h3 className="text-lg font-bold text-white">Chat responsible staff</h3>
              <div className="mt-4 space-y-3">
                {parentContacts.map((contact) => (
                  <div key={contact.title} className="flex items-start justify-between gap-3 rounded-2xl bg-white/4 p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{contact.title}</p>
                      <p className="mt-1 text-xs text-zinc-400">{contact.action}</p>
                    </div>
                    <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-600/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      <MessageSquare size={14} /> Chat
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-compact border border-white/5">
              <h3 className="text-lg font-bold text-white">Safeguarding scope</h3>
              <div className="mt-4 space-y-3 text-sm text-zinc-300">
                <div className="rounded-2xl bg-white/4 p-4">Parents can see what the child sees in hostel records.</div>
                <div className="rounded-2xl bg-white/4 p-4">Parents can chat the staff responsible for student safety.</div>
                <div className="rounded-2xl bg-white/4 p-4">All other operational details are managed by the `Hostel Manager`, `Owner`, and `HoS`.</div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'report' && isParent ? (
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="card-compact border border-white/5">
              <h3 className="text-lg font-bold text-white">Report to school admin</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Child name</span>
                  <input defaultValue="Precious Johnson" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Issue type</span>
                  <input placeholder="Safety, supervision, welfare..." className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2 text-sm text-zinc-200 md:col-span-2">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Report details</span>
                  <textarea className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" placeholder="Describe the concern and any action already taken." />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/20">
                  Send report
                </button>
              </div>
            </div>

            <div className="card-compact border border-white/5">
              <h3 className="text-lg font-bold text-white">Escalation path</h3>
              <div className="mt-4 space-y-3 text-sm text-zinc-300">
                <div className="rounded-2xl bg-white/4 p-4"><AlertCircle size={14} className="mb-2 text-amber-400" />School admin receives the parent safeguarding report.</div>
                <div className="rounded-2xl bg-white/4 p-4">Hostel leadership follows up with the `Hostel Manager`, `Owner`, or `HoS` when action is required.</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
