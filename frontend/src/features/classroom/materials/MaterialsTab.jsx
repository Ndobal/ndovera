import React, { useMemo, useState } from 'react';
import { materials } from '../data/classroomData';
import { createTextDownload } from '../shared/classroomHelpers';

export default function MaterialsTab() {
  const [materialsTab, setMaterialsTab] = useState('notes');
  const [materialsQuery, setMaterialsQuery] = useState('');
  const [videoProgress, setVideoProgress] = useState(() => Object.fromEntries(materials.videos.map(video => [video.id, video.completion])));

  const materialRows = useMemo(() => {
    const mixed = [
      ...materials.notes.map(item => ({ ...item, rowType: 'note' })),
      ...materials.videos.map(item => ({ ...item, rowType: 'video' })),
      ...materials.images.map(item => ({ ...item, rowType: 'image' })),
    ];

    const sourceByTab = {
      notes: materials.notes.map(item => ({ ...item, rowType: 'note' })),
      videos: materials.videos.map(item => ({ ...item, rowType: 'video' })),
      images: materials.images.map(item => ({ ...item, rowType: 'image' })),
      mixed,
    };

    const activeSource = sourceByTab[materialsTab] || mixed;
    const query = materialsQuery.trim().toLowerCase();
    if (!query) return activeSource;
    return activeSource.filter(item => JSON.stringify(item).toLowerCase().includes(query));
  }, [materialsTab, materialsQuery]);

  return (
    <div className="space-y-4">
      <section className="glass-surface rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'notes', label: 'Notes' },
            { id: 'videos', label: 'Videos' },
            { id: 'images', label: 'Images' },
            { id: 'mixed', label: 'Mixed' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setMaterialsTab(tab.id)} className={materialsTab === tab.id ? 'px-4 py-2 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white' : 'px-4 py-2 rounded-2xl bg-slate-900/30 border border-white/10 text-slate-200'}>{tab.label}</button>
          ))}
        </div>

        <input value={materialsQuery} onChange={event => setMaterialsQuery(event.target.value)} className="w-full rounded-2xl bg-slate-900/30 border border-white/10 px-4 py-2 text-slate-100" placeholder="Search notes, videos, images" />

        <div className="space-y-3">
          {materialRows.map(item => (
            <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-slate-100 font-semibold">{item.title}</p>
                <span className="glass-chip rounded-full px-3 py-1 micro-label accent-indigo">{item.rowType.toUpperCase()}</span>
              </div>

              {item.rowType === 'note' && (
                <>
                  <p className="text-sm text-slate-300">{item.body}</p>
                  <p className="micro-label accent-emerald">{item.subject} • Updated {item.updated}</p>
                  <button onClick={() => createTextDownload(`${item.title}.txt`, `${item.title}\n\n${item.body}`)} className="px-3 py-1 rounded-xl border border-white/10 bg-slate-900/30 text-xs text-slate-100">Download Note</button>
                </>
              )}

              {item.rowType === 'video' && (
                <>
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3"><p className="text-sm text-slate-200">Embedded Player • {item.duration}</p></div>
                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-slate-700 overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${videoProgress[item.id] || 0}%` }} /></div>
                    <p className="text-xs text-slate-300">Watch completion: {videoProgress[item.id] || 0}%</p>
                  </div>
                  <button onClick={() => setVideoProgress(prev => ({ ...prev, [item.id]: Math.min((prev[item.id] || 0) + 10, 100) }))} className="px-3 py-1 rounded-xl border border-white/10 bg-slate-900/30 text-xs text-slate-100">Mark +10% Watched</button>
                </>
              )}

              {item.rowType === 'image' && (
                <>
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">Visual reference: {item.category}</div>
                  <p className="micro-label accent-amber">{item.subject} • {item.resolution}</p>
                </>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
