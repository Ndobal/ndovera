import React from 'react';
import { MessageSquare } from 'lucide-react';

interface HomeScreenProps {
  onNavigateToMessaging: () => void;
}

export default function HomeScreen({ onNavigateToMessaging }: HomeScreenProps) {
  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">NDOVERA System</h1>
        <p className="text-slate-400 mb-8">Welcome to the main portal.</p>
        <button 
          onClick={onNavigateToMessaging}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          <span>Go to Messaging</span>
        </button>
      </div>
    </div>
  );
}
