import React, { useState } from 'react';
import { ebooks } from '../data/libraryData';
import { runAiReview, logAdminDecision } from '../service/libraryService';

export default function AdminPanel() {
  const [pending, setPending] = useState(ebooks.filter(b => b.status !== 'approved' && !b.pinned));

  const handleView = async (book) => {
    const report = await runAiReview(null);
    alert(`AI Report Score: ${report.score}`);
  };

  const handleApprove = async (book) => {
    await logAdminDecision({ bookId: book.id, adminId: 'admin-1', action: 'approve' });
    alert('Book approved (logged)');
    setPending(prev => prev.filter(p => p.id !== book.id));
  };

  const handleReject = async (book) => {
    const reason = prompt('Enter rejection reason (required)');
    if (!reason) return alert('Rejection reason required');
    await logAdminDecision({ bookId: book.id, adminId: 'admin-1', action: 'reject', reason });
    alert('Book rejected (logged)');
    setPending(prev => prev.filter(p => p.id !== book.id));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 border border-white/10 bg-slate-900/20">
        <h3 className="text-lg text-slate-100">Admin — E-Book Approvals</h3>
        <p className="text-sm text-slate-400">Review AI reports and make final decisions.</p>
      </div>

      <div className="space-y-2">
        {pending.length === 0 && <div className="text-slate-400">No pending books</div>}
        {pending.map(book => (
          <div key={book.id} className="rounded-xl border border-white/10 p-3 bg-slate-900/20 flex items-center justify-between">
            <div>
              <div className="text-slate-100 font-medium">{book.title}</div>
              <div className="text-xs text-slate-400">Author: {book.author} • AI Score: {book.aiReview?.score || '-'}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleView(book)} className="px-3 py-1 rounded-lg bg-indigo-500/30 text-indigo-100">View</button>
              <button onClick={() => handleApprove(book)} className="px-3 py-1 rounded-lg bg-emerald-500/30 text-emerald-100">Approve</button>
              <button onClick={() => handleReject(book)} className="px-3 py-1 rounded-lg bg-red-500/30 text-red-100">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
