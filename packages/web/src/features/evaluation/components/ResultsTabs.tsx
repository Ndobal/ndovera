import React from 'react';
import { useData } from '../../../hooks/useData';
import { motion } from 'motion/react';
import { BrainCircuit, Star, Users, Briefcase, GraduationCap, Users2 } from 'lucide-react';

interface RoleStats {
  avg_rating: number;
  count: number;
}

interface EvaluationResults {
  staff: RoleStats;
  students: RoleStats;
  parents: RoleStats;
  ai: string;
}

export const ResultsTabs = () => {
  const { data: results, isLoading } = useData<EvaluationResults>('/api/evaluation/results');

  if (isLoading) {
    return (
      <div className="flex animate-pulse space-x-4 p-6">
        <div className="flex-1 space-y-6 py-1">
          <div className="h-2 bg-slate-700 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-slate-700 rounded"></div>
            <div className="h-20 bg-slate-700 rounded"></div>
            <div className="h-20 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!results) {
    return <div className="text-slate-400 p-6">No evaluation data available.</div>;
  }

  const StatCard = ({ title, icon: Icon, stats, color }: { title: string, icon: any, stats: RoleStats, color: string }) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 flex flex-col items-center text-center relative overflow-hidden"
    >
      <div className={`absolute top-0 left-0 w-full h-1 ${color}`}></div>
      <Icon className={`mb-4 w-8 h-8 ${color.replace('bg-', 'text-')}`} />
      <h3 className="text-lg font-medium text-slate-300 mb-4">{title}</h3>
      
      <div className="flex gap-6 w-full justify-center">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1 text-2xl font-bold text-white mb-1">
            {stats?.avg_rating ? Number(stats.avg_rating).toFixed(1) : '0.0'}
            <Star size={18} className="text-yellow-400 fill-yellow-400" />
          </div>
          <span className="text-xs text-slate-400">Avg Rating</span>
        </div>
        
        <div className="w-px bg-slate-700"></div>
        
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-white mb-1 flex items-center gap-1">
            {stats?.count || 0}
            <Users size={16} className="text-blue-400" />
          </div>
          <span className="text-xs text-slate-400">Responses</span>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">School Wide Evaluation Standings</h2>
        <p className="text-slate-400 text-sm">Aggregated feedback across all school roles.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Student Feedback" 
          icon={GraduationCap} 
          stats={results.students || { avg_rating: 0, count: 0 }} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Parent Feedback" 
          icon={Users2} 
          stats={results.parents || { avg_rating: 0, count: 0 }} 
          color="bg-orange-500" 
        />
        <StatCard 
          title="Staff Feedback" 
          icon={Briefcase} 
          stats={results.staff || { avg_rating: 0, count: 0 }} 
          color="bg-blue-500" 
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8 bg-emerald-900/20 border border-emerald-500/20 p-6 rounded-xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-lg">
            <BrainCircuit className="text-emerald-400 w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-400 mb-2">AI Summary & Sentiment Analysis</h3>
            <p className="text-emerald-100/80 leading-relaxed">
              {results.ai || "AI summary is currently processing. Check back later for automated insights on written comments."}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
