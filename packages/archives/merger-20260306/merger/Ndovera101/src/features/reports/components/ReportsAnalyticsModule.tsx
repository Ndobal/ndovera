import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, BookOpen, CheckCircle, Award } from 'lucide-react';

// Mock Data
const attendanceData = [
  { name: 'JSS 1', Present: 95, Absent: 5 },
  { name: 'JSS 2', Present: 92, Absent: 8 },
  { name: 'SS 1', Present: 98, Absent: 2 },
  { name: 'SS 2', Present: 88, Absent: 12 },
];

const performanceData = [
  { name: 'Mathematics', 'Avg Score': 78 },
  { name: 'English', 'Avg Score': 85 },
  { name: 'Physics', 'Avg Score': 72 },
  { name: 'Chemistry', 'Avg Score': 81 },
  { name: 'Biology', 'Avg Score': 88 },
];

const engagementData = [
  { name: 'Lesson Notes Read', value: 400 },
  { name: 'Assignments Submitted', value: 300 },
  { name: 'Exams Completed', value: 150 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className={`bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-center gap-4`}>
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}/20`}>
      <Icon className={`w-6 h-6 ${color}`} />
    </div>
    <div>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  </div>
);

export default function ReportsAnalyticsModule() {
  return (
    <div className="p-6 bg-slate-900 text-white h-full overflow-y-auto rounded-2xl">
      <h2 className="text-2xl font-bold text-slate-100 mb-6">Reports & Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard title="Total Students" value="125" icon={Users} color="text-blue-400" />
        <StatCard title="Subjects Taught" value="5" icon={BookOpen} color="text-purple-400" />
        <StatCard title="Avg. Attendance" value="93%" icon={CheckCircle} color="text-green-400" />
        <StatCard title="Top Performer Avg." value="92%" icon={Award} color="text-yellow-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-bold mb-4">Average Subject Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} fontSize={12} />
              <YAxis tick={{ fill: '#94a3b8' }} fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }}/>
              <Bar dataKey="Avg Score" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-bold mb-4">Student Engagement</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={engagementData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                fontSize={12}
              >
                {engagementData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
