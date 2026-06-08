import React, { useEffect, useState } from 'react';
import { getMaterials } from '../classroomService';
import MaterialViewer from './MaterialViewer';

function typeIcon(type) {
  if (type === 'video') return '▶';
  if (type === 'image') return '🖼';
  if (type === 'audio') return '🎧';
  if (type === 'link') return '🔗';
  return '📄';
}

function isUsableMaterialUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  return /^https?:\/\//i.test(value) || value.startsWith('/');
}

function isAudioMaterial(material) {
  const type = String(material?.type || '').toLowerCase();
  if (type === 'audio') return true;
  const source = String(material?.url || material?.fileName || material?.title || '').toLowerCase();
  return /\.(mp3|wav|ogg|m4a|aac)(\?|$)/.test(source);
}

export default function MaterialsTab({ classId = '' }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [activeMaterial, setActiveMaterial] = useState(null);

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
          {filtered.map((item, i) => {
            const usableUrl = isUsableMaterialUrl(item.url) ? item.url : '';
            const audio = isAudioMaterial(item) && usableUrl;
            const openLabel = audio ? 'Play' : usableUrl ? 'Open' : 'Read';
            return (
            <div key={item.id || i}
              style={{ width: '150px', minHeight: '100px' }}
              className="relative flex flex-col justify-between rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] p-3 shadow-sm overflow-hidden">
              {/* Type badge */}
              <div className="flex items-center gap-1 mb-1">
                <span className="text-base leading-none">{typeIcon(audio ? 'audio' : item.type)}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#800020]">{audio ? 'audio' : (item.type || 'doc')}</span>
              </div>
              {/* Title */}
              <p className="text-xs font-bold text-[#191970] leading-snug line-clamp-3 flex-1">{item.title || 'Untitled'}</p>
              {/* Subject */}
              {item.subjectName && <p className="text-[9px] font-bold text-[#800020] mt-1 truncate">{item.subjectName}</p>}
              {!usableUrl && item.description ? <p className="mt-1 text-[10px] text-[#191970] line-clamp-3">{item.description}</p> : null}
              {/* Open inside the app (readable without leaving / downloading) */}
              <button
                type="button"
                onClick={() => setActiveMaterial(item)}
                className={`mt-2 block w-full text-center font-bold text-xs px-2 py-1.5 rounded-xl transition-colors text-[#f5deb3] ${usableUrl ? 'bg-[#1a5c38] hover:bg-[#154a2e]' : 'bg-[#800020] hover:bg-[#5a0016]'}`}
              >
                {openLabel}
              </button>
            </div>
            );
          })}
        </div>
      )}

      {activeMaterial ? (
        <MaterialViewer material={activeMaterial} onClose={() => setActiveMaterial(null)} />
      ) : null}
    </div>
  );
}
