import React, { useEffect, useState } from 'react';
import { fetchEbooks } from '../service/libraryService';

export default function EBooksGrid({ onOpenBook }) {
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});

  useEffect(() => {
    (async () => {
      const data = await fetchEbooks();
      setBooks(data);
    })();
  }, []);

  const filtered = books.filter(b => {
    // apply text query
    if (query) {
      const q = query.toLowerCase();
      if (!(b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || (b.subject || '').toLowerCase().includes(q))) return false;
    }
    // apply filters (e.g., price)
    if (filters.price === 'free' && (b.price || 0) > 0) return false;
    if (filters.price === 'paid' && (b.price || 0) === 0) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, author, subject" className="flex-1 rounded-xl p-2 bg-slate-900/20 border border-white/10 text-slate-200" />
        <select onChange={e => setFilters(prev => ({...prev, price: e.target.value}))} className="rounded-xl p-2 bg-slate-900/20 border border-white/10 text-slate-200">
          <option value="">All</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(book => (
          <div key={book.id} className="rounded-2xl border border-white/10 p-4 bg-slate-900/20">
            <div className="h-40 bg-center bg-cover rounded-md" style={{backgroundImage: `url(${book.coverUrl})`}} />
            <h4 className="mt-3 text-slate-100 font-semibold">{book.title}</h4>
            <p className="text-xs text-slate-400">Author: {book.author}</p>
            <p className="text-xs text-slate-400">{book.type} • {book.class}</p>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm font-medium text-slate-200">{book.price === 0 ? '₦0 • Free' : `₦${book.price}`}</div>
              <div className="text-xs">
                {book.status === 'official' && <span className="text-violet-400">🟣 Official</span>}
                {book.status === 'approved' && <span className="text-emerald-400">🟢 Approved</span>}
                {book.status === 'paid' && <span className="text-yellow-300">🔒 Paid</span>}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onOpenBook(book)} className="flex-1 px-3 py-2 rounded-lg bg-indigo-500/30 border border-indigo-300/40 text-indigo-100 text-sm">{book.price === 0 ? 'Read' : 'Preview'}</button>
              <button className="px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-300/30 text-emerald-100 text-sm">{book.downloadable ? 'Download' : 'Buy'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
