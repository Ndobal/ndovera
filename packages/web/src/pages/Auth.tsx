import React, { useEffect } from "react";
import { Sprout } from "lucide-react";

export const AuthView = ({ onLogin }: { onLogin: () => void }) => {

  // 🚀 Automatically bypass authentication
  useEffect(() => {
    const timer = setTimeout(() => {
      onLogin();
    }, 300); // small delay so UI doesn't crash

    return () => clearTimeout(timer);
  }, [onLogin]);

  return (
    <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center p-6">
      <div className="text-center space-y-6">

        <div className="inline-flex w-16 h-16 bg-emerald-600 rounded-2xl items-center justify-center shadow-xl shadow-emerald-900/20">
          <Sprout className="text-white" size={32} />
        </div>

        <h2 className="text-3xl font-bold text-white tracking-tight">
          Loading Ndovera
        </h2>

        <p className="text-zinc-500">
          Authentication bypass enabled for development...
        </p>

      </div>
    </div>
  );
};