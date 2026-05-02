import React from 'react';

export default function BookDetail({ book, onBuy, onDownload, onClose }) {
  if (!book) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-6 space-y-4">
      <div className="flex gap-4">
        <div className="w-40 h-56 bg-cover bg-center rounded-md" style={{backgroundImage:`url(${book.coverUrl})`}} />
        <div className="flex-1">
          <h2 className="text-2xl text-slate-100 font-semibold">{book.title}</h2>
          <p className="text-sm text-slate-400">Author: {book.author}</p>
          <p className="text-sm text-slate-400">Subject: {book.subject} • Class: {book.class}</p>
          <p className="mt-3 text-slate-200">{book.description}</p>

          <div className="mt-4 flex items-center gap-3">
            <div className="text-lg font-medium text-slate-100">{book.price === 0 ? '₦0 • Free' : `₦${book.price}`}</div>
            <div className="text-xs text-slate-400">{book.pages} pages</div>
            <div className="ml-auto text-xs">
              {book.aiReview?.passed && <span className="text-emerald-400">✔ AI Review: Passed</span>}
              <span className="ml-2 text-slate-300">{book.encrypted ? '🔐 Encrypted' : ''}</span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={() => onBuy(book)} className="px-4 py-2 rounded-xl bg-indigo-500/40 border border-indigo-300/40 text-indigo-100">{book.price === 0 ? 'Read Now' : 'Buy & Download'}</button>
            {book.downloadable && <button onClick={() => onDownload(book)} className="px-4 py-2 rounded-xl bg-emerald-500/30 border border-emerald-300/40 text-emerald-100">Download</button>}
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 text-slate-300">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
