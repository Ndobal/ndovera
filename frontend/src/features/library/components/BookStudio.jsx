import React, { useState } from 'react';
import { bookStudioTemplates } from '../data/libraryData';

export default function BookStudio({ auraBalance = 0, onPublish }) {
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState(bookStudioTemplates[0].id);
  const [content, setContent] = useState('');

  const handlePublish = () => {
    if (!title || !content) return alert('Title and content required');
    if (auraBalance < 1) return alert('Not enough Aura for AI actions');

    // Simulate export to ND-BOOK and AI-assisted formatting
    const book = { id: `ndbook_${Date.now()}`, title, template, author: 'You', content };
    onPublish && onPublish(book);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 border border-white/10 bg-slate-900/20">
        <h3 className="text-lg text-slate-100 font-semibold">Book Studio</h3>
        <p className="text-sm text-slate-400">Create and format books in premium layouts. Export to encrypted ND-BOOK format.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Book Title" className="col-span-2 rounded-xl p-2 bg-slate-900/20 border border-white/10 text-slate-200" />
        <select value={template} onChange={e=>setTemplate(e.target.value)} className="rounded-xl p-2 bg-slate-900/20 border border-white/10 text-slate-200">
          {bookStudioTemplates.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Write your book here..." className="w-full min-h-[240px] rounded-2xl p-3 bg-slate-900/20 border border-white/10 text-slate-200" />

      <div className="flex gap-2">
        <button onClick={handlePublish} className="px-4 py-2 rounded-xl bg-indigo-500/40 border border-indigo-300/40 text-indigo-100">Export ND-BOOK</button>
        <button onClick={()=>{setTitle(''); setContent('');}} className="px-4 py-2 rounded-xl border border-white/10 text-slate-300">Clear</button>
      </div>
    </div>
  );
}
