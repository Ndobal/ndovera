import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './shared/components/Sidebar';
import DashboardHome from './app/DashboardHome';
import Classroom from './app/Classroom';
import RoleClassroom from './app/RoleClassroom';
import Library from './app/Library';
import AdminLibrary from './features/library/AdminLibrary';
import Assignments from './app/Assignments';
import Exams from './app/Exams';
import AITutor from './app/AITutor';
import Attendance from './app/Attendance';
import Rewards from './app/Rewards';
import Settings from './app/Settings';
import './shared/styles/theme.css';

export default function App() {
  return (
    <Router>
      <div className="flex h-screen">
        <div className="h-full overflow-y-auto" style={{ minWidth: 256 }}>
          <Sidebar />
        </div>
        <main className="flex-1 h-full overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/classroom" element={<Classroom />} />
            <Route path="/library" element={<Library />} />
            <Route path="/library/admin" element={<AdminLibrary />} />
            <Route path="/roles/:role/library" element={<Library />} />
            <Route path="/roles/:role/classroom" element={<RoleClassroom />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/ai-tutor" element={<AITutor />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
