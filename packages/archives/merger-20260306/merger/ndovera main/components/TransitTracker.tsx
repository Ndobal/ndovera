
import React, { useState, useEffect } from 'react';
import { 
    Map, Bus, MapPin, Phone, Clock, 
    ShieldCheck, Bell, Navigation, Search,
    Activity, ArrowRight, UserCheck, Smartphone,
    Fingerprint, CheckCircle, X, Loader2, Eye, Camera
} from 'lucide-react';
import { BusRoute } from '../types';

const MOCK_ROUTES: BusRoute[] = [
    { id: 'r1', name: 'Lekki-VGC Circuit', driverName: 'Mr. Sunday Okoro', driverPhone: '0803 111 2222', currentLat: 6.45, currentLng: 3.5, stops: ['Lekki Gate', 'VGC Main', 'Ajah Underbridge'], etaMinutes: 8 },
    { id: 'r2', name: 'Mainland Express', driverName: 'Mr. Biodun', driverPhone: '0802 333 4444', currentLat: 6.55, currentLng: 3.4, stops: ['Ikeja Mall', 'Maryland', 'Yaba'], etaMinutes: 4 },
];

const INITIAL_LOG = [
    { id: '1', name: 'David Okon', time: '07:15 AM', status: 'ON_BOARD' },
    { id: '2', name: 'Grace Adeyemi', time: '07:22 AM', status: 'ON_BOARD' },
];

export const TransitTracker: React.FC = () => {
    const [routes, setRoutes] = useState<BusRoute[]>(MOCK_ROUTES);
    const [selectedRoute, setSelectedRoute] = useState<BusRoute>(routes[0]);
    const [boardingLog, setBoardingLog] = useState(INITIAL_LOG);
    const [isTapping, setIsTapping] = useState(false);
    const [showBusVision, setShowBusVision] = useState(false);

    // Simulate real-time ETA updates
    useEffect(() => {
        const interval = setInterval(() => {
            setRoutes(prev => prev.map(r => ({
                ...r,
                etaMinutes: r.etaMinutes > 1 ? r.etaMinutes - 1 : 15
            })));
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const updated = routes.find(r => r.id === selectedRoute.id);
        if (updated) setSelectedRoute(updated);
    }, [routes, selectedRoute.id]);

    const handleTapIn = () => {
        setIsTapping(true);
        setTimeout(() => {
            const newEntry = {
                id: Date.now().toString(),
                name: 'Samuel Bello',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'ON_BOARD'
            };
            setBoardingLog([newEntry, ...boardingLog]);
            setIsTapping(false);
        }, 1500);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header with Proximity Alert */}
            <div className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-indigo-500">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Transit Tracker</h2>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Real-Time Fleet Logistics & Sanctuary Safety</p>
                    </div>
                    {selectedRoute.etaMinutes <= 5 && (
                        <div className="bg-amber-400 text-slate-900 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center gap-3 animate-bounce border-4 border-white">
                            <Bell className="w-5 h-5 fill-current animate-pulse"/> 
                            <div>
                                <p className="text-[8px] font-black uppercase">Proximity Alert</p>
                                <p>Bus is {selectedRoute.etaMinutes} mins away!</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-4 bg-white/5 p-6 rounded-[2.5rem] border border-white/10 backdrop-blur-xl">
                        <div className="text-right">
                            <p className="text-[9px] font-black uppercase text-indigo-300 tracking-widest">Live Fleet Status</p>
                            <h3 className="text-3xl font-black italic text-emerald-400">Secure</h3>
                        </div>
                        <Activity className="w-8 h-8 text-indigo-400 animate-pulse"/>
                    </div>
                </div>
                <Navigation className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                    {/* Simulated Map View */}
                    <div className="h-[600px] bg-slate-200 rounded-[4rem] relative overflow-hidden shadow-inner border border-slate-100 group">
                        <div className="absolute inset-0 bg-slate-300 flex items-center justify-center">
                            <Map className="w-20 h-20 text-slate-400 opacity-50"/>
                            <p className="absolute mt-24 text-slate-500 font-black uppercase text-xs tracking-widest italic text-center px-10">Live Satellite Relay Active • Authorized Device Connection Only</p>
                        </div>
                        
                        {showBusVision && (
                            <div className="absolute inset-0 z-20 bg-slate-950 animate-fade-in flex flex-col">
                                <div className="p-8 flex justify-between items-center text-white bg-gradient-to-b from-black/80 to-transparent">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"/>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Internal CAM-04 (ND-BUS-14)</span>
                                    </div>
                                    <button onClick={() => setShowBusVision(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="w-6 h-6"/></button>
                                </div>
                                <div className="flex-1 flex items-center justify-center relative">
                                    <img src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957" className="w-full h-full object-cover opacity-50 grayscale contrast-125" alt="Bus Interior" />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 space-y-4">
                                        <Camera className="w-20 h-20"/>
                                        <p className="text-xl font-black italic tracking-tighter uppercase">Environment Verified</p>
                                    </div>
                                    <div className="absolute top-0 left-0 w-full h-full border-[30px] border-black/20 pointer-events-none"/>
                                </div>
                                <div className="p-10 bg-slate-900 border-t border-white/5 flex items-center gap-6">
                                     <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white"><ShieldCheck className="w-6 h-6"/></div>
                                     <div className="flex-1">
                                         <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">AI Safety Monitor</p>
                                         <p className="text-sm font-medium text-slate-300 italic">"All passengers verified via biometric tap-in. Environment temperature: 22°C."</p>
                                     </div>
                                </div>
                            </div>
                        )}

                        {/* Interactive Bus Pin */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce cursor-pointer group/bus" onClick={() => setShowBusVision(true)}>
                            <div className="bg-indigo-600 p-4 rounded-full shadow-2xl border-4 border-white relative group-hover/bus:scale-110 transition-transform">
                                <Bus className="w-8 h-8 text-white"/>
                                <div className="absolute top-0 right-0 w-4 h-4 bg-green-400 rounded-full border-2 border-white"/>
                            </div>
                            <div className="mt-2 bg-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase shadow-lg text-center flex items-center gap-2">
                                ND-BUS-14 <Eye className="w-3 h-3 text-indigo-400"/>
                            </div>
                        </div>

                        {/* Prediction Timeline */}
                        <div className="absolute top-8 left-8 bg-white/90 backdrop-blur-md p-6 rounded-[2.5rem] shadow-2xl border border-white/20 w-64 space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-2">Arrival Pipeline</h4>
                            {selectedRoute.stops.map((stop, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-3 h-3 rounded-full border-2 ${i === 0 ? 'bg-indigo-600 border-indigo-200' : 'bg-slate-200 border-slate-100'}`}/>
                                        {i < selectedRoute.stops.length - 1 && <div className="w-0.5 h-6 bg-slate-100"/>}
                                    </div>
                                    <div className="leading-none">
                                        <p className={`text-xs font-black uppercase ${i === 0 ? 'text-indigo-600' : 'text-slate-400'}`}>{stop}</p>
                                        <p className="text-[9px] font-bold text-slate-300 mt-1">{i === 0 ? 'Approaching' : `${(i + 1) * 10} mins`}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="absolute bottom-8 left-8 right-8">
                            <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[3rem] shadow-3xl border border-white/20 flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner"><Clock className="w-8 h-8"/></div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Destination: {selectedRoute.stops[0]}</p>
                                        <h4 className="text-3xl font-black italic tracking-tighter text-slate-900 uppercase">ETA: {selectedRoute.etaMinutes} MINS</h4>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={() => setShowBusVision(true)} className="bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-indigo-600 transition-all">
                                        <Eye className="w-4 h-4"/> Bus Vision
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Digital Boarding Log */}
                    <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-2xl space-y-8">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-3">Boarding Log</h4>
                            <span className="bg-indigo-50 text-indigo-600 px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{boardingLog.length} Registered</span>
                        </div>
                        
                        <button 
                            onClick={handleTapIn}
                            disabled={isTapping}
                            className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all disabled:opacity-50"
                        >
                            {isTapping ? <Loader2 className="w-5 h-5 animate-spin"/> : <Fingerprint className="w-5 h-5 text-indigo-400"/>}
                            {isTapping ? 'Authenticating Tap...' : 'Verify Student Tap-In'}
                        </button>

                        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 scrollbar-hide">
                            {boardingLog.map((log, i) => (
                                <div key={log.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center animate-fade-in border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm"><UserCheck className="w-4 h-4"/></div>
                                        <div>
                                            <p className="font-black text-slate-900 text-xs uppercase">{log.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{log.time}</p>
                                        </div>
                                    </div>
                                    <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">Verified</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-2xl space-y-8">
                        <h4 className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-3">Fleet Directory</h4>
                        <div className="space-y-4">
                            {routes.map(r => (
                                <button 
                                    key={r.id} 
                                    onClick={() => setSelectedRoute(r)}
                                    className={`w-full p-6 rounded-3xl border text-left transition-all group ${selectedRoute.id === r.id ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <h5 className="font-black text-slate-900 uppercase tracking-tight">{r.name}</h5>
                                        <Bus className={`w-4 h-4 ${selectedRoute.id === r.id ? 'text-indigo-600' : 'text-slate-300'}`}/>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.driverName}</p>
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{r.etaMinutes} MINS</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
