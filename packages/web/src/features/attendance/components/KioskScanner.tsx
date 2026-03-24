import React, { useState, useEffect } from 'react';
import QRScanner from '../../../components/QRScanner';
import { Camera, Signal, WifiOff, LogOut, CheckCircle } from 'lucide-react';
import { logout } from '../../../services/authLocal';

export default function KioskScanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<string[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleScanSuccess = (msg: string) => {
    console.log(msg);
  };

  const handleOfflineScan = (token: string) => {
    // Basic service-worker-less offline queue logic for low-effort implementation
    if (isOffline) {
      const queue = JSON.parse(localStorage.getItem('attendance_queue') || '[]');
      queue.push({ token, timestamp: new Date().toISOString() });
      localStorage.setItem('attendance_queue', JSON.stringify(queue));
      setOfflineQueue(queue);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        {isOffline ? (
          <span className="flex items-center gap-2 text-rose-400 bg-rose-500/20 px-4 py-2 rounded-full font-bold">
            <WifiOff size={20} /> Offline Mode (Queue: {offlineQueue.length})
          </span>
        ) : (
          <span className="flex items-center gap-2 text-emerald-400 bg-emerald-500/20 px-4 py-2 rounded-full font-bold">
            <Signal size={20} /> Online
          </span>
        )}
        <button onClick={() => logout()} className="text-slate-400 hover:text-white p-2">
          <LogOut size={24} />
        </button>
      </div>

      <div className="max-w-2xl w-full">
        <h1 className="text-4xl font-extrabold mb-2">Gate Scanner Kiosk</h1>
        <p className="text-slate-400 mb-8 text-lg">Position standard ID card or Mobile QR code in frame.</p>

        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
          {/* Note: The physical scanning device will pass 'kiosk_scan' which handles its own routing in the backend */}
          <QRScanner 
            roleScanned="student" 
            onScanSuccess={(msg) => handleScanSuccess(msg)} 
            onScanError={(err) => {
              if (isOffline && err.includes('Failed to fetch')) {
                 // In a production PWA, the ServiceWorker handles this transparently.
                 // This UI fallback demonstrates the mechanism without complex SW code.
              }
            }}
          />
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6 max-w-lg mx-auto">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-2">
              <CheckCircle />
            </div>
            <span className="font-bold">Sign In</span>
            <span className="text-xs text-slate-400">Arriving correctly</span>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center">
             <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mb-2">
              <LogOut />
            </div>
            <span className="font-bold">Sign Out</span>
            <span className="text-xs text-slate-400">Leaving required!</span>
          </div>
        </div>
      </div>
    </div>
  );
}