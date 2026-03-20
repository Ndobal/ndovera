import React, { useMemo, useState } from 'react';
import { 
  ChevronDown,
  Megaphone, 
  MessageCircle,
  Plus, 
  Calendar,
  Eye,
  Heart,
  Trash2,
  Edit2
} from 'lucide-react';
import { useData } from '../hooks/useData';

import { Role } from '../types';

export const CommunicationHub = ({ role, searchQuery }: { role: Role, searchQuery?: string }) => {
  const { data: announcements } = useData<any[]>('/api/announcements');
  const [isCreating, setIsCreating] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentsByAnnouncement, setCommentsByAnnouncement] = useState<Record<string, Array<{ id: string; author: string; text: string; createdAt: string }>>>({});
  const [reactionsByAnnouncement, setReactionsByAnnouncement] = useState<Record<string, { emoji: string; count: number; active: boolean }[]>>({});
  const isAdmin = role === 'Super Admin' || role === 'School Admin' || role === 'HOS';

  const filteredAnnouncements = useMemo(() => {
    if (!searchQuery) return announcements;
    return announcements?.filter(ann => ann.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, announcements]);

  const toggleReaction = (announcementId: string, emoji: string) => {
    setReactionsByAnnouncement((current) => {
      const existing = current[announcementId] || [
        { emoji: '👍', count: 0, active: false },
        { emoji: '❤️', count: 0, active: false },
        { emoji: '🎉', count: 0, active: false },
      ];
      return {
        ...current,
        [announcementId]: existing.map((reaction) => reaction.emoji === emoji
          ? { ...reaction, count: reaction.active ? Math.max(0, reaction.count - 1) : reaction.count + 1, active: !reaction.active }
          : reaction),
      };
    });
  };

  const addComment = (announcementId: string) => {
    const nextText = commentDrafts[announcementId]?.trim();
    if (!nextText) return;
    setCommentsByAnnouncement((current) => ({
      ...current,
      [announcementId]: [
        ...(current[announcementId] || []),
        { id: `${announcementId}_${Date.now()}`, author: role, text: nextText, createdAt: new Date().toISOString() },
      ],
    }));
    setCommentDrafts((current) => ({ ...current, [announcementId]: '' }));
    setOpenComments((current) => ({ ...current, [announcementId]: true }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Communication Hub</h2>
          <p className="text-zinc-500 text-xs">
            {isAdmin ? 'Manage school-wide announcements and updates.' : 'Stay updated with the latest school news and events.'}
          </p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2"
          >
            <Plus size={16} /> New Announcement
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters & Stats */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-compact">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Filters</h3>
            <div className="space-y-2">
              {['All Updates', 'Academic', 'Events', 'Finance', 'Urgent'].map((filter) => (
                <button key={filter} className="w-full text-left px-3 py-2 rounded-lg text-xs text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-all flex items-center justify-between">
                  {filter}
                  <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded">12</span>
                </button>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="card-compact bg-emerald-600/5 border-emerald-500/10">
              <div className="flex items-center gap-2 mb-3">
                <Eye size={16} className="text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500">Reach Stats</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-zinc-500">Avg. Open Rate</span>
                    <span className="text-white font-bold">84%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[84%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-zinc-500">Engagement</span>
                    <span className="text-white font-bold">62%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-[62%]"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Announcements List */}
        <div className={isAdmin ? 'lg:col-span-3 space-y-4' : 'lg:col-span-3 space-y-4'}>
          <div className="space-y-3">
            {filteredAnnouncements?.map((ann) => (
              <div key={ann.id} className="card-compact group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-emerald-500">
                    <Megaphone size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-zinc-200 truncate">{ann.title}</h4>
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-bold uppercase rounded">
                          {ann.role_visibility?.split(',')[0] || 'Public'}
                        </span>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 text-zinc-600 hover:text-emerald-500 transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button className="p-1.5 text-zinc-600 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed mb-3">
                      {ann.content}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] text-zinc-600 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {new Date(ann.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={12} /> 1.2k views
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                      {(reactionsByAnnouncement[ann.id] || [
                        { emoji: '👍', count: 0, active: false },
                        { emoji: '❤️', count: 0, active: false },
                        { emoji: '🎉', count: 0, active: false },
                      ]).map((reaction) => (
                        <button
                          key={reaction.emoji}
                          type="button"
                          onClick={() => toggleReaction(ann.id, reaction.emoji)}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${reaction.active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-white/5 bg-white/5 text-zinc-400 hover:text-zinc-200'}`}
                        >
                          <Heart size={12} className={reaction.active ? 'fill-current' : ''} /> {reaction.emoji} {reaction.count}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setOpenComments((current) => ({ ...current, [ann.id]: !current[ann.id] }))}
                        className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-400 transition hover:text-zinc-200"
                      >
                        <MessageCircle size={12} />
                        Comments {(commentsByAnnouncement[ann.id] || []).length}
                        <ChevronDown size={12} className={`transition-transform ${openComments[ann.id] ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {openComments[ann.id] ? (
                      <div className="mt-4 rounded-2xl border border-white/5 bg-black/10 p-4">
                        <div className="space-y-3">
                          {(commentsByAnnouncement[ann.id] || []).length ? (commentsByAnnouncement[ann.id] || []).map((comment) => (
                            <div key={comment.id} className="rounded-xl border border-white/5 bg-white/3 px-3 py-3">
                              <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-zinc-500">
                                <span>{comment.author}</span>
                                <span>{new Date(comment.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="mt-2 text-xs leading-relaxed text-zinc-300">{comment.text}</p>
                            </div>
                          )) : <div className="text-xs text-zinc-500">No comments yet. Click to add the first response.</div>}
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                          <input
                            value={commentDrafts[ann.id] || ''}
                            onChange={(event) => setCommentDrafts((current) => ({ ...current, [ann.id]: event.target.value }))}
                            placeholder="Write a comment..."
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-500"
                          />
                          <button
                            type="button"
                            onClick={() => addComment(ann.id)}
                            className="rounded-xl bg-emerald-600 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-emerald-500"
                          >
                            Add Comment
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )) || <div className="text-center py-12 text-zinc-600">No announcements found.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
