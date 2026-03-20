import React from 'react';
import { GraduationCap, Star, Users, PlayCircle, BookOpen } from 'lucide-react';
import { UserRole } from '../../../shared/types';

const MOCK_TUTORIALS = [
  { id: '1', title: 'Advanced Calculus', tutor: 'Prof. Mike', rating: 4.8, students: 120, price: 'Free', category: 'Math' },
  { id: '2', title: 'Intro to Python', tutor: 'Dev. Jane', rating: 4.9, students: 450, price: '₦2,000', category: 'Tech' },
  { id: '3', title: 'Public Speaking', tutor: 'Coach Sam', rating: 4.7, students: 85, price: 'Free', category: 'Soft Skills' },
  { id: '4', title: 'Organic Chemistry', tutor: 'Dr. Sarah', rating: 4.6, students: 210, price: '₦1,500', category: 'Science' },
];

export default function TutorialsModule({ role }: { role: UserRole }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Independent Tutorials</h2>
          <p className="text-slate-500">Extra learning resources provided by independent educators.</p>
        </div>
        <button className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors flex items-center gap-2">
          <GraduationCap className="w-4 h-4" />
          Become a Tutor
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['All', 'Math', 'Science', 'Tech', 'Soft Skills', 'Arts'].map((cat) => (
          <button key={cat} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
            cat === 'All' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {MOCK_TUTORIALS.map((course) => (
          <div key={course.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group cursor-pointer hover:shadow-md transition-all">
            <div className="h-40 bg-slate-200 dark:bg-slate-800 relative overflow-hidden">
              <img src={`https://picsum.photos/seed/course${course.id}/400/200`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold uppercase text-slate-800 dark:text-slate-100 shadow-sm">
                {course.price}
              </div>
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-12 h-12 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                  <PlayCircle className="w-8 h-8" />
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-500/20 px-2 py-0.5 rounded">{course.category}</span>
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1 line-clamp-1">{course.title}</h3>
              <p className="text-sm text-slate-500 mb-4">by {course.tutor}</p>
              <div className="flex items-center justify-between text-xs font-medium text-slate-400 pt-4 border-t border-slate-50 dark:border-slate-800">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span className="text-slate-700 dark:text-slate-300 font-bold">{course.rating}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{course.students}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-8 border border-emerald-100 dark:border-emerald-500/20 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-400 mb-2">Want to share your knowledge?</h3>
          <p className="text-emerald-700 dark:text-emerald-500/80 mb-6">Join our community of independent tutors and reach thousands of students. Set your own prices and schedule.</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400/80 font-semibold text-sm">
              <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
              Flexible Schedule
            </div>
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400/80 font-semibold text-sm">
              <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
              Global Reach
            </div>
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400/80 font-semibold text-sm">
              <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
              Secure Payments
            </div>
          </div>
        </div>
        <button className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 whitespace-nowrap">
          Start Teaching Today
        </button>
      </div>
    </div>
  );
}
