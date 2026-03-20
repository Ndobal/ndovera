import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ArrowUpRight, Users, School, DollarSign, Sparkles } from 'lucide-react';

const mockStudentGrowthData = [
  { name: 'Jan', students: 400 },
  { name: 'Feb', students: 600 },
  { name: 'Mar', students: 800 },
  { name: 'Apr', students: 750 },
  { name: 'May', students: 1100 },
  { name: 'Jun', students: 1500 },
];

const mockPlatformActivity = [
    { event: 'New School Onboarded', target: 'Northcrest Academy', time: '2h ago' },
    { event: 'Blueprint Updated', target: 'Premium Blueprint', time: '5h ago' },
    { event: 'Aura Rate Changed', target: '1 Aura = 55 Naira', time: '1d ago' },
    { event: 'System Backup', target: 'Main Database', time: '1d ago' },
];

const StatCard = ({ title, value, change, icon: Icon, color }) => (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-6`}>
        <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">{title}</p>
            <Icon className={`w-5 h-5 text-${color}-500`} />
        </div>
        <p className="text-3xl font-bold text-slate-100">{value}</p>
        <div className="flex items-center gap-1 text-xs text-emerald-400 mt-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>{change} vs last month</span>
        </div>
    </div>
);

export default function Spectrometer() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Spectrometer / Analytics & Metrics</h1>
        <p className="text-sm text-slate-400">A high-level overview of the Ndovera platform's performance and health.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
        <StatCard title="Total Schools" value="14" change="+2" icon={School} color="emerald" />
        <StatCard title="Active Students" value="8,452" change="+12%" icon={Users} color="indigo" />
        <StatCard title="Total Revenue (MTD)" value="₦1.2M" change="+8%" icon={DollarSign} color="amber" />
        <StatCard title="Auras in Circulation" value="2.5M" change="+5%" icon={Sparkles} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Student Growth</h2>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <AreaChart data={mockStudentGrowthData}>
                        <defs>
                            <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
                        <Area type="monotone" dataKey="students" stroke="#10b981" fillOpacity={1} fill="url(#colorStudents)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Platform Activity</h2>
            <ul className="space-y-4">
                {mockPlatformActivity.map(activity => (
                    <li key={activity.event} className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-200">{activity.event}</p>
                            <p className="text-xs text-slate-400">{activity.target}</p>
                        </div>
                        <p className="text-xs text-slate-500">{activity.time}</p>
                    </li>
                ))}
            </ul>
        </div>
      </div>
    </div>
  );
}
