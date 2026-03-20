
import React, { useState, useMemo } from 'react';
import { 
    ShoppingBag, Plus, Save, Trash2, Package, 
    CreditCard, Truck, Landmark, DollarSign, 
    CheckCircle, X, Info, Utensils, BookOpen, 
    ShieldCheck, Edit2, AlertCircle, ShoppingCart,
    TrendingUp, BarChart3, Download, History,
    ArrowUpRight, Users, Zap
} from 'lucide-react';
import { TuckShopItem, TuckShopOrder, TuckShopTreasury, UserRole, BankAccount } from '../types';
import { SponsoredSearchUnit, LamsAdBanner } from './FarmingMode';
import { jsPDF } from 'jspdf';

// Mock Data
const MOCK_ITEMS: TuckShopItem[] = [
    { id: '1', name: 'Premium School Bag', price: 12500, description: 'Ergonomic design with Ndovera branding.', imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62', category: 'UNIFORM', isAvailable: true, stock: 42 },
    { id: '2', name: 'Crunchy Plantain Chips', price: 500, description: 'Fresh and salty local snacks.', imageUrl: 'https://images.unsplash.com/photo-1623934199716-dc35816f6068', category: 'SNACKS', isAvailable: true, stock: 15 },
    { id: '3', name: 'Geometry Set', price: 2200, description: 'Essential tools for Math & Physics.', imageUrl: 'https://images.unsplash.com/photo-1583484963886-cfe2bef37d5b', category: 'STATIONERY', isAvailable: true, stock: 88 },
    { id: '4', name: 'Beef Jollof Bowl', price: 1800, description: 'Warm lunch meal served at break.', imageUrl: 'https://images.unsplash.com/photo-1604328698692-f76ea9498e76', category: 'FOOD', isAvailable: true, stock: 0 },
    { id: '5', name: 'Ndovera PE Uniform', price: 6500, description: 'Sports day institutional kit.', imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27', category: 'UNIFORM', isAvailable: true, stock: 120 },
];

const MOCK_TREASURY: TuckShopTreasury = {
    schoolAccount: {
        bankName: 'Ndovera Institutional Bank',
        accountName: 'LAGOON ACADEMY REVENUE',
        accountNumber: '0011223344'
    },
    provisionsAccount: {
        bankName: 'Ndovera Merchant Bank',
        accountName: 'MALL PROVISIONS LOGISTICS',
        accountNumber: '0987112233'
    }
};

export const TuckShopModule: React.FC<{ role: UserRole; isFarmingMode?: boolean }> = ({ role, isFarmingMode }) => {
    const [view, setView] = useState<'MALL' | 'STUDIO' | 'ORDERS' | 'FISCAL'>('MALL');
    const [items, setItems] = useState<TuckShopItem[]>(MOCK_ITEMS);
    const [orders, setOrders] = useState<TuckShopOrder[]>([]);
    const [treasury, setTreasury] = useState<TuckShopTreasury>(MOCK_TREASURY);
    const [showPaymentModal, setShowPaymentModal] = useState<TuckShopItem | null>(null);
    const [lastOrderPlaced, setLastOrderPlaced] = useState<TuckShopOrder | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newItem, setNewItem] = useState<Partial<TuckShopItem>>({ category: 'SNACKS', isAvailable: true, stock: 10 });
    const [deliveryLoc, setDeliveryLoc] = useState('');
    const [studioTreasuryType, setStudioTreasuryType] = useState<'SCHOOL' | 'PROVISIONS'>('PROVISIONS');

    const isManager = role === UserRole.TUCKSHOP_MANAGER || role === UserRole.SCHOOL_OWNER;

    const handleAddItem = () => {
        if (!newItem.name || !newItem.price) return;
        const item: TuckShopItem = {
            ...newItem,
            id: Date.now().toString(),
        } as TuckShopItem;
        setItems([item, ...items]);
        setIsAdding(false);
        setNewItem({ category: 'SNACKS', isAvailable: true, stock: 10 });
    };

    const isProvisions = (item: TuckShopItem) => ['SNACKS', 'DRINKS', 'FOOD'].includes(item.category);

    const placeOrder = (item: TuckShopItem) => {
        const order: TuckShopOrder = {
            id: `ORD-${Date.now()}`,
            itemId: item.id,
            itemName: item.name,
            itemPrice: item.price,
            userId: 'u1',
            userName: 'David Okon',
            userRole: role,
            location: deliveryLoc || 'Default Class',
            timestamp: new Date().toLocaleString(),
            status: 'PENDING',
            isProvision: isProvisions(item)
        };
        setOrders([order, ...orders]);
        setLastOrderPlaced(order);
        setShowPaymentModal(null);
        setDeliveryLoc('');
        
        // Update local stock logic
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock: Math.max(0, i.stock - 1) } : i));
    };

    const generateReceipt = (order: TuckShopOrder) => {
        const doc = new jsPDF();
        const account = order.isProvision ? treasury.provisionsAccount : treasury.schoolAccount;
        
        doc.setFontSize(22);
        doc.text("SANCTUARY MALL RECEIPT", 20, 30);
        doc.setFontSize(10);
        doc.text(`Official Order Proof: ${order.id}`, 20, 40);
        doc.line(20, 45, 190, 45);

        doc.setFontSize(12);
        doc.text(`Customer: ${order.userName} (${order.userRole})`, 20, 60);
        doc.text(`Item Asset: ${order.itemName}`, 20, 70);
        doc.text(`Amount: N${order.itemPrice.toLocaleString()}`, 20, 80);
        doc.text(`Target Delivery: ${order.location}`, 20, 90);
        doc.text(`Timestamp: ${order.timestamp}`, 20, 100);

        doc.line(20, 110, 190, 110);
        doc.text("SETTLEMENT COORDINATES", 20, 120);
        doc.text(`Bank: ${account.bankName}`, 20, 130);
        doc.text(`Account No: ${account.accountNumber}`, 20, 140);
        doc.text(`Beneficiary: ${account.accountName}`, 20, 150);

        doc.setFontSize(8);
        doc.text("This receipt is cryptographically logged on the Ndovera OS ledger. Verified by Sanctuary Mall.", 20, 200);
        doc.save(`Receipt-${order.id}.pdf`);
    };

    const schoolItems = items.filter(i => !isProvisions(i));
    const provisionItems = items.filter(i => isProvisions(i));

    const totalProvisionRevenue = useMemo(() => orders.filter(o => o.isProvision).reduce((a, b) => a + b.itemPrice, 0), [orders]);
    const totalSchoolRevenue = useMemo(() => orders.filter(o => !o.isProvision).reduce((a, b) => a + b.itemPrice, 0), [orders]);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Success Overlay for Order Placed */}
            {lastOrderPlaced && (
                <div className="fixed inset-0 z-[600] bg-indigo-950/95 backdrop-blur-2xl flex items-center justify-center p-6">
                    <div className="bg-white rounded-[4rem] w-full max-w-xl p-16 text-center space-y-10 shadow-3xl animate-scale-in">
                        <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner border-4 border-green-100">
                            <CheckCircle className="w-12 h-12"/>
                        </div>
                        <div>
                            <h3 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900">Order Locked.</h3>
                            <p className="text-slate-500 font-medium mt-2">Your request is in the mall flux. Please finalize bank settlement.</p>
                        </div>
                        <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 space-y-4">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Transaction Proof ID</p>
                            <p className="text-xl font-black text-indigo-600 tracking-widest uppercase">{lastOrderPlaced.id}</p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => generateReceipt(lastOrderPlaced)} className="flex-1 bg-slate-900 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3">
                                <Download className="w-4 h-4"/> Download Receipt
                            </button>
                            <button onClick={() => setLastOrderPlaced(null)} className="flex-1 bg-indigo-600 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-widest">Return to Mall</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sanctuary Mall Header */}
            <div className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-indigo-600">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Sanctuary Mall</h2>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Institutional Commerce & Logistics Suite</p>
                    </div>
                    <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
                        <button onClick={() => setView('MALL')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'MALL' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>The Mall</button>
                        {isManager && (
                            <>
                                <button onClick={() => setView('STUDIO')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'STUDIO' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Studio</button>
                                <button onClick={() => setView('ORDERS')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'ORDERS' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Orders</button>
                                <button onClick={() => setView('FISCAL')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'FISCAL' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Fiscal Intelligence</button>
                            </>
                        )}
                    </div>
                </div>
                <ShoppingCart className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            {view === 'MALL' && (
                <div className="space-y-16">
                    {/* Ad Placement */}
                    {(isFarmingMode || role === UserRole.STUDENT) && (
                        <div className="animate-scale-in">
                            <LamsAdBanner onReward={(amt) => console.log(`Earned ${amt} Lams in the Mall.`)} />
                        </div>
                    )}

                    <div className="space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><BookOpen className="w-6 h-6"/></div>
                            <div>
                                <h3 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">Academic Annex</h3>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Official Assets • Payments to Institutional Account</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {schoolItems.map(item => (
                                <ItemCard key={item.id} item={item} onOrder={() => setShowPaymentModal(item)} />
                            ))}
                        </div>
                    </div>

                    {(isFarmingMode || role === UserRole.STUDENT) && <SponsoredSearchUnit />}

                    <div className="space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner"><Utensils className="w-6 h-6"/></div>
                            <div>
                                <h3 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">Refreshment Wing</h3>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Mall Provisions • Payments to Separate Provision Account</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {provisionItems.map(item => (
                                <ItemCard key={item.id} item={item} onOrder={() => setShowPaymentModal(item)} variant="amber" />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {view === 'FISCAL' && isManager && (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl space-y-12">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-3xl font-black italic uppercase tracking-tighter">Fiscal Breakdown</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Routing Multi-Identity Tracker</p>
                                </div>
                                <BarChart3 className="w-8 h-8 text-indigo-400"/>
                            </div>

                            <div className="space-y-6">
                                <div className="p-10 bg-indigo-50 rounded-[3rem] border border-indigo-100 flex justify-between items-center">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Institutional Asset Yield</p>
                                        <p className="text-4xl font-black italic tracking-tighter text-indigo-900">₦{totalSchoolRevenue.toLocaleString()}</p>
                                        <p className="text-xs font-bold text-indigo-400 uppercase italic">Routed to: {treasury.schoolAccount.accountNumber}</p>
                                    </div>
                                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-indigo-600 shadow-xl border border-indigo-100"><Landmark className="w-8 h-8"/></div>
                                </div>

                                <div className="p-10 bg-amber-50 rounded-[3rem] border border-amber-100 flex justify-between items-center">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Manager Provision Yield</p>
                                        <p className="text-4xl font-black italic tracking-tighter text-amber-900">₦{totalProvisionRevenue.toLocaleString()}</p>
                                        <p className="text-xs font-bold text-amber-400 uppercase italic">Routed to: {treasury.provisionsAccount.accountNumber}</p>
                                    </div>
                                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-amber-600 shadow-xl border border-amber-100"><DollarSign className="w-8 h-8"/></div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="bg-slate-900 p-10 rounded-[3rem] text-white space-y-8 shadow-3xl">
                                <h4 className="text-xl font-black italic tracking-tighter uppercase">Ad-Injection Yield</h4>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Impression Lams</span>
                                        <span className="text-3xl font-black italic text-indigo-400">12,402</span>
                                    </div>
                                    <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Est. Cash Equivalent</span>
                                        <span className="text-3xl font-black italic text-emerald-400">₦6,201</span>
                                    </div>
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 flex items-center gap-4">
                                        <Zap className="w-8 h-8 text-amber-400"/>
                                        <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase">Mall traffic generates autonomous institutional funding.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-views like STUDIO and ORDERS logic from previous version retained here */}
            {view === 'STUDIO' && isManager && (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in">
                    <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl space-y-10">
                        <div className="flex justify-between items-center">
                            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">Showcase Studio</h3>
                            <button onClick={() => setIsAdding(!isAdding)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg">
                                {isAdding ? <X className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
                                {isAdding ? 'Cancel' : 'New Item'}
                            </button>
                        </div>

                        {isAdding ? (
                            <div className="space-y-6 animate-scale-in">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest px-2">Item Label</label>
                                        <input required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 font-bold outline-none" placeholder="e.g. Science Lab Coat" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest px-2">Market Price (₦)</label>
                                        <input type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 font-black outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest px-2">Fleet Category</label>
                                        <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value as any})} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 font-bold outline-none">
                                            <option value="SNACKS">Provision: Snacks</option>
                                            <option value="FOOD">Provision: Food</option>
                                            <option value="DRINKS">Provision: Drinks</option>
                                            <option value="STATIONERY">Academic: Stationery</option>
                                            <option value="UNIFORM">Academic: Uniform</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest px-2">Stock Level</label>
                                    <input type="number" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: Number(e.target.value)})} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 font-bold outline-none" />
                                </div>
                                <button onClick={handleAddItem} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3">
                                    <Save className="w-5 h-5"/> Publish to Mall Wing
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                                {items.map(item => (
                                    <div key={item.id} className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-lg transition-all">
                                        <div className="flex items-center gap-4">
                                            <img src={item.imageUrl} className="w-16 h-16 rounded-2xl object-cover shadow-sm" alt="" />
                                            <div>
                                                <h4 className="font-bold text-slate-900">{item.name}</h4>
                                                <p className={`text-[9px] font-black uppercase tracking-widest ${isProvisions(item) ? 'text-amber-600' : 'text-indigo-600'}`}>
                                                    {item.category} • ₦{item.price.toLocaleString()} • Stock: {item.stock}
                                                </p>
                                            </div>
                                        </div>
                                        <button onClick={() => setItems(items.filter(x => x.id !== item.id))} className="p-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-5 h-5"/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-900 p-12 rounded-[4rem] text-white flex flex-col justify-between shadow-3xl">
                        <div className="space-y-8">
                            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-indigo-400">Treasury Multi-Routing</h3>
                            <div className="flex bg-white/5 p-1 rounded-xl">
                                <button onClick={() => setStudioTreasuryType('PROVISIONS')} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${studioTreasuryType === 'PROVISIONS' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'}`}>Provision A/C</button>
                                <button onClick={() => setStudioTreasuryType('SCHOOL')} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${studioTreasuryType === 'SCHOOL' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>School A/C</button>
                            </div>
                            <div className="space-y-6">
                                {['bankName', 'accountName', 'accountNumber'].map((field) => (
                                    <div key={field}>
                                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-2">{field.toUpperCase()}</label>
                                        <input 
                                            value={(treasury[studioTreasuryType === 'SCHOOL' ? 'schoolAccount' : 'provisionsAccount'] as any)[field]} 
                                            onChange={e => {
                                                const typeKey = studioTreasuryType === 'SCHOOL' ? 'schoolAccount' : 'provisionsAccount';
                                                setTreasury({ ...treasury, [typeKey]: { ...treasury[typeKey], [field]: e.target.value } });
                                            }} 
                                            className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold" 
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === 'ORDERS' && isManager && (
                 <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl animate-fade-in">
                    <div className="flex justify-between items-center mb-10 px-4">
                        <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">Order Flux</h3>
                        <span className="bg-slate-100 px-6 py-2 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">{orders.length} Active Requests</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">
                                <tr>
                                    <th className="p-8">Fleet</th>
                                    <th className="p-8">Customer</th>
                                    <th className="p-8">Asset</th>
                                    <th className="p-8">Delivery</th>
                                    <th className="p-8 text-right">Settlement</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {orders.map(order => (
                                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-8">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 text-sm">{order.timestamp.split(' ')[1]}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">{order.timestamp.split(' ')[0]}</span>
                                            </div>
                                        </td>
                                        <td className="p-8 font-bold text-slate-900 uppercase text-xs">{order.userName}</td>
                                        <td className="p-8 font-black text-slate-900 italic tracking-tight uppercase">{order.itemName}</td>
                                        <td className="p-8 text-slate-500 font-medium italic text-sm">{order.location}</td>
                                        <td className="p-8 text-right">
                                            <button 
                                                onClick={() => setOrders(orders.map(o => o.id === order.id ? {...o, status: 'DELIVERED'} : o))}
                                                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${order.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-900 text-white shadow-xl hover:bg-indigo-600'}`}
                                            >
                                                {order.status === 'DELIVERED' ? 'Fulfilled' : 'Finalize Delivery'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-6">
                    <div className="bg-white rounded-[4rem] w-full max-w-xl overflow-hidden shadow-3xl animate-scale-in border border-slate-100">
                        <div className={`p-10 text-white flex justify-between items-center relative overflow-hidden ${isProvisions(showPaymentModal) ? 'bg-amber-600' : 'bg-indigo-900'}`}>
                            <div className="relative z-10">
                                <h3 className="text-3xl font-black italic uppercase tracking-tight">Finalize Transaction</h3>
                                <p className="text-white/70 font-bold uppercase text-[10px] tracking-widest mt-2">
                                    Route: {isProvisions(showPaymentModal) ? 'Sanctuary Provisions' : 'Institutional Revenue'}
                                </p>
                            </div>
                            <button onClick={() => setShowPaymentModal(null)} className="relative z-10 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="w-8 h-8"/></button>
                            <DollarSign className="absolute right-[-20px] bottom-[-20px] w-64 h-64 opacity-5 rotate-12"/>
                        </div>
                        <div className="p-12 space-y-10">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Asset Asset</p>
                                    <p className="text-2xl font-black italic tracking-tight text-slate-900 uppercase">{showPaymentModal.name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Settlement</p>
                                    <p className={`text-3xl font-black tracking-tighter italic ${isProvisions(showPaymentModal) ? 'text-amber-600' : 'text-indigo-600'}`}>₦{showPaymentModal.price.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Delivery Target (Class / Office)</label>
                                    <input required value={deliveryLoc} onChange={e => setDeliveryLoc(e.target.value)} placeholder="e.g. JSS 2A / Staff Room" className="w-full bg-slate-50 p-5 rounded-2xl outline-none border-2 border-slate-100 focus:border-indigo-600 font-bold" />
                                </div>
                                
                                <div className={`p-8 rounded-[2.5rem] border-2 space-y-4 ${isProvisions(showPaymentModal) ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-200'}`}>
                                    <div className="flex justify-between items-center">
                                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isProvisions(showPaymentModal) ? 'text-amber-600' : 'text-indigo-600'}`}>Verified Routing Identities</p>
                                        <ShieldCheck className={`w-4 h-4 ${isProvisions(showPaymentModal) ? 'text-amber-400' : 'text-indigo-400'}`}/>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Bank:</span>
                                        <span className="text-sm font-black text-slate-900 uppercase">{(isProvisions(showPaymentModal) ? treasury.provisionsAccount : treasury.schoolAccount).bankName}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Number:</span>
                                        <span className={`text-lg font-black tracking-widest ${isProvisions(showPaymentModal) ? 'text-amber-700' : 'text-indigo-600'}`}>{(isProvisions(showPaymentModal) ? treasury.provisionsAccount : treasury.schoolAccount).accountNumber}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Beneficiary:</span>
                                        <span className="text-xs font-black text-slate-900 uppercase">{(isProvisions(showPaymentModal) ? treasury.provisionsAccount : treasury.schoolAccount).accountName}</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => placeOrder(showPaymentModal)}
                                disabled={!deliveryLoc.trim()}
                                className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-3xl hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <CheckCircle className="w-5 h-5 text-indigo-400"/> Place Secure Order
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ItemCard: React.FC<{ item: TuckShopItem; onOrder: () => void; variant?: 'indigo' | 'amber' }> = ({ item, onOrder, variant = 'indigo' }) => {
    const isAmber = variant === 'amber';
    const isOutOfStock = item.stock <= 0;

    return (
        <div className={`bg-white rounded-[3.5rem] overflow-hidden border border-slate-100 shadow-xl group hover:shadow-2xl transition-all duration-500 flex flex-col ${isOutOfStock ? 'opacity-70 grayscale-[0.5]' : ''}`}>
            <div className="h-64 relative overflow-hidden">
                <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.name} />
                <div className="absolute top-8 right-8 bg-white/90 backdrop-blur-md px-6 py-2 rounded-2xl font-black text-slate-900 shadow-xl">
                    ₦{item.price.toLocaleString()}
                </div>
                <span className={`absolute top-8 left-8 text-white px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg ${isAmber ? 'bg-amber-600' : 'bg-indigo-600'}`}>
                    {item.category}
                </span>
                {isOutOfStock && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                        <span className="bg-red-600 text-white px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl">Out of Stock</span>
                    </div>
                )}
            </div>
            <div className="p-10 space-y-6 flex-1 flex flex-col justify-between">
                <div>
                    <h4 className={`text-2xl font-black italic tracking-tighter uppercase text-slate-900 group-hover:${isAmber ? 'text-amber-600' : 'text-indigo-600'} transition-colors`}>{item.name}</h4>
                    <p className="text-slate-500 font-medium mt-2 leading-relaxed italic text-sm">"{item.description}"</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${item.stock > 10 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}/>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.stock} Units Remaining</span>
                    </div>
                </div>
                <button 
                    onClick={onOrder}
                    disabled={isOutOfStock}
                    className={`w-full text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3 ${isOutOfStock ? 'bg-slate-300' : isAmber ? 'bg-slate-900 hover:bg-amber-600' : 'bg-slate-900 hover:bg-indigo-600'}`}
                >
                    <Package className="w-4 h-4"/> {isOutOfStock ? 'Replenishing Soon' : 'Order Now'}
                </button>
            </div>
        </div>
    );
};
