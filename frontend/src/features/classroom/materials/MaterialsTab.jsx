import React, { useEffect, useState } from 'react';
import { getMaterials } from '../classroomService';

function typeIcon(type) {
  if (type === 'video') return '▶';
  if (type === 'image') return '🖼';
  if (type === 'link') return '🔗';
  return '📄';
}

export default function MaterialsTab({ classId = '' }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [activeNote, setActiveNote] = useState(null);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    getMaterials(classId)
      .then(d => setMaterials(d?.materials || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [classId]);

  const filtered = filter === 'all' ? materials : materials.filter(m => m.type === filter);
  const types = ['all', ...Array.from(new Set(materials.map(m => m.type || 'document')))];

  return (
    <div className="space-y-4 p-1">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {types.map(t => (
          <button key={t} type="button" onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-2xl border text-sm font-bold transition-colors capitalize ${filter === t ? 'bg-[#1a5c38] border-[#1a5c38] text-[#f5deb3]' : 'bg-[#f0d090] border-[#c9a96e]/40 text-[#191970]'}`}>
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm font-bold text-[#191970]">Loading materials...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#c9a96e]/40 bg-[#f5deb3] p-5 text-center">
          <p className="text-xs font-bold uppercase text-[#800020]">No materials published</p>
          <p className="mt-1 text-sm font-bold text-[#191970]">Your teacher has not uploaded any materials yet.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {filtered.map((item, i) => (
            <div key={item.id || i}
              style={{ width: '150px', minHeight: '100px' }}
              className="relative flex flex-col justify-between rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] p-3 shadow-sm overflow-hidden">
              {/* Type badge */}
              <div className="flex items-center gap-1 mb-1">
                <span className="text-base leading-none">{typeIcon(item.type)}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#800020]">{item.type || 'doc'}</span>
              </div>
              {/* Title */}
              <p className="text-xs font-bold text-[#191970] leading-snug line-clamp-3 flex-1">{item.title || 'Untitled'}</p>
              {/* Subject */}
              {item.subjectName && <p className="text-[9px] font-bold text-[#800020] mt-1 truncate">{item.subjectName}</p>}
              {!item.url && item.description ? <p className="mt-1 text-[10px] text-[#191970] line-clamp-3">{item.description}</p> : null}
              {/* Open button */}
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-center bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold text-xs px-2 py-1.5 rounded-xl transition-colors"
                >
                  Open
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveNote(item)}
                  className="mt-2 block w-full text-center bg-[#800020] hover:bg-[#5a0016] text-[#f5deb3] font-bold text-xs px-2 py-1.5 rounded-xl transition-colors"
                >
                  Read Note
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {activeNote ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#191970]/55 p-4 md:items-center" onClick={() => setActiveNote(null)} role="presentation">
          <div className="w-full max-w-xl rounded-[1.75rem] border border-[#c9a96e]/40 bg-[#fff8ee] p-5 shadow-[0_24px_70px_rgba(25,25,112,0.22)]" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Lesson note">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#800020]">Lesson Note</p>
                <h3 className="mt-2 text-lg font-bold text-[#800000]">{activeNote.title || 'Untitled note'}</h3>
                {activeNote.subjectName ? <p className="mt-1 text-xs font-semibold text-[#800020]">{activeNote.subjectName}</p> : null}
              </div>
              <button type="button" onClick={() => setActiveNote(null)} className="rounded-full border border-[#c9a96e]/40 px-3 py-1 text-xs font-bold text-[#800020]">Close</button>
            </div>
            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-2xl bg-white p-4 text-sm leading-7 text-[#191970] whitespace-pre-wrap">
              {activeNote.description || 'No note content was added.'}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
