
import React, { useState } from 'react';
import { 
    Book, BookOpen, Search, Filter, 
    Star, Download, History, Zap, 
    X, CheckCircle, Info, Bookmark, 
    Library, Headphones, Smartphone, Award,
    // Fix: Added missing Clock import to resolve "Cannot find name 'Clock'" error
    Clock
} from 'lucide-react';
import { LibraryBook, BorrowRecord, UserRole } from '../types';

const MOCK_BOOKS: LibraryBook[] = [
    { id: 'b1', title: 'Quantitative Reasoning for JSS', author: 'Dr. John Ndovera', category: 'SCIENCE', isDigital: true, coverUrl: 'https://images.unsplash.com/photo-1543003919-a9957004b28d', availableCopies: 5, lamsReward: 25 },
    { id: 'b2', title: 'The Modern African Literature', author: 'Chinua Achebe Jr.', category: 'LITERATURE', isDigital: true, coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c', availableCopies: 2, lamsReward: 15 },
    { id: 'b3', title: 'Exam Prep: WAEC 2025 Mastery', author: 'Exam Council', category: 'EXAM_PREP', isDigital: false, coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6', availableCopies: 12, lamsReward: 50 },
    { id: 'b4', title: 'Nigerian History: The Unseen Logs', author: 'Hist. Society', category: 'HISTORY', isDigital: true, coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794', availableCopies: 0, lamsReward: 20 },
];

export const LibraryModule: React.FC<{ role: UserRole; onEarnLams: (amt: number) => void }> = ({ role, onEarnLams }) => {
    const [view, setView] = useState<'SHELF' | 'MY_BOOKS' | 'READING'>('SHELF');
    const [books] = useState<LibraryBook[]>(MOCK_BOOKS);
    const [borrowed, setBorrowed] = useState<BorrowRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);

    const handleBorrow = (book: LibraryBook) => {
        if (book.availableCopies === 0 && !book.isDigital) return;
        const record: BorrowRecord = {
            id: `BOR-${Date.now()}`,
            bookId: book.id,
            bookTitle: book.title,
            userId: 'current-user',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            status: 'ACTIVE'
        };
        setBorrowed([record, ...borrowed]);
        alert(`${book.title} has been added to your Sanctuary Shelf.`);
        if (book.isDigital) setView('MY_BOOKS');
    };

    const handleReturn = (record: BorrowRecord) => {
        setBorrowed(prev => prev.map(r => r.id === record.id ? { ...r, status: 'RETURNED' } : r));
        onEarnLams(10); // Return reward
        alert("Success! 10 Lams credited to your wallet for intellectual responsibility.");
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-indigo-900 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-amber-400">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">The Great Library</h2>
                        <p className="text-indigo-300 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Sanctuary for Intelligence & Historical Assets</p>
                    </div>
                    <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
                        <button onClick={() => setView('SHELF')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'SHELF' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Great Bookshelf</button>
                        <button onClick={() => setView('MY_BOOKS')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'MY_BOOKS' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>My Shelf</button>
                    </div>
                </div>
                <Library className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            {view === 'SHELF' && (
                <div className="space-y-12">
                    <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300"/>
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search for knowledge..." className="w-full bg-slate-50 p-5 pl-16 rounded-2xl outline-none border border-slate-50 font-bold" />
                        </div>
                        <div className="hidden md:flex gap-4">
                            {['SCIENCE', 'LITERATURE', 'EXAM_PREP'].map(cat => (
                                <button key={cat} className="px-5 py-2.5 rounded-xl bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all">{cat}</button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                        {books.map(book => (
                            <div key={book.id} className="bg-white rounded-[3rem] overflow-hidden shadow-xl border border-slate-100 group hover:shadow-2xl transition-all duration-500 flex flex-col">
                                <div className="h-72 relative overflow-hidden">
                                    <img src={book.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                                    {book.isDigital && (
                                        <span className="absolute top-6 right-6 bg-amber-400 text-slate-900 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2">
                                            <Smartphone className="w-3 h-3"/> Digital Asset
                                        </span>
                                    )}
                                </div>
                                <div className="p-8 space-y-6 flex-1 flex flex-col justify-between text-center">
                                    <div>
                                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{book.category}</p>
                                        <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight">{book.title}</h4>
                                        <p className="text-slate-400 font-medium text-xs mt-2 italic">by {book.author}</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-center items-center gap-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="text-center">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Yield</p>
                                                <p className="text-xs font-black text-amber-600">+{book.lamsReward} Lams</p>
                                            </div>
                                            <div className="w-px h-6 bg-slate-200"/>
                                            <div className="text-center">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Stock</p>
                                                <p className="text-xs font-black text-slate-900">{book.isDigital ? '∞' : book.availableCopies}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleBorrow(book)}
                                            disabled={!book.isDigital && book.availableCopies === 0}
                                            className="w-full bg-slate-900 text-white py-5 rounded-[1.75rem] font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                        >
                                            <BookOpen className="w-4 h-4"/> Borrow Asset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === 'MY_BOOKS' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl">
                        <div className="flex justify-between items-center mb-12">
                            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">Sanctuary Shelf</h3>
                            <span className="bg-indigo-50 text-indigo-600 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">{borrowed.filter(r => r.status === 'ACTIVE').length} Active Items</span>
                        </div>

                        <div className="space-y-6">
                            {borrowed.map(record => (
                                <div key={record.id} className={`p-8 rounded-[3rem] border flex flex-col md:flex-row justify-between items-center gap-8 transition-all ${record.status === 'RETURNED' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-indigo-100 shadow-xl'}`}>
                                    <div className="flex items-center gap-6">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${record.status === 'RETURNED' ? 'bg-slate-200 text-slate-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                            <Book className="w-8 h-8"/>
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{record.bookTitle}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3 flex items-center gap-2">
                                                {record.status === 'RETURNED' ? <CheckCircle className="w-3 h-3 text-emerald-500"/> : <Clock className="w-3 h-3 text-amber-500"/>}
                                                {record.status === 'RETURNED' ? 'Archived' : `Return by: ${record.dueDate}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 w-full md:w-auto">
                                        {record.status === 'ACTIVE' && (
                                            <>
                                                <button className="flex-1 md:flex-none bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"><Smartphone className="w-4 h-4"/> Read Digital</button>
                                                <button onClick={() => handleReturn(record)} className="flex-1 md:flex-none bg-white border-4 border-indigo-100 text-indigo-600 px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all">Return Asset</button>
                                            </>
                                        )}
                                        {record.status === 'RETURNED' && (
                                            <div className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-widest">
                                                <Award className="w-4 h-4"/> Yield Dispatched (+10 Lams)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {borrowed.length === 0 && (
                                <div className="p-32 text-center text-slate-300 italic font-medium uppercase tracking-widest border-4 border-dashed border-slate-50 rounded-[4rem]">No active assets in your sanctuary.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
