import { ThumbsUp, ThumbsDown, Plus, Pencil, Trash2, Check, CheckCheck, Download, File, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { Post, Author } from './types';

interface FeedItemProps {
  post: Post;
  isCurrentUser: boolean;
  onLike: () => void;
  onDislike: () => void;
  onReact: () => void;
  onToggleReaction: (emoji: string) => void;
  onProfileClick: (author: Author) => void;
  onEdit: (newContent: string) => void;
  onDelete: () => void;
  onRequestMedia: () => void;
}

function formatTime(dateInput: Date | string | number) {
  const date = new Date(dateInput);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && 
                  date.getMonth() === now.getMonth() && 
                  date.getFullYear() === now.getFullYear();
  
  if (isToday) {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  } else {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  }
}

export function FeedItem({ post, isCurrentUser, onLike, onDislike, onReact, onToggleReaction, onProfileClick, onEdit, onDelete, onRequestMedia }: FeedItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  const handleSaveEdit = () => {
    if (editContent.trim() !== post.content) {
      onEdit(editContent);
    }
    setIsEditing(false);
  };

  if (post.isDeleted) {
    return (
      <div className={`flex w-full mb-4 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`flex gap-2 max-w-[85%] sm:max-w-[75%] ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0 mt-1" />
          <div className={`p-2.5 shadow-sm text-[10px] italic text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 ${
            isCurrentUser ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm'
          }`}>
            🚫 This message was deleted
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-4 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-2 max-w-[85%] sm:max-w-[75%] ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        <img 
          src={post.author.avatar} 
          alt={post.author.name} 
          onClick={() => onProfileClick(post.author)}
          className="w-6 h-6 rounded-full object-cover shrink-0 mt-1 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" 
        />
        
        <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
          <div className={`flex items-baseline gap-1.5 mb-1 px-1 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">{post.author.name}</span>
            <span className="text-[8px] text-slate-400 dark:text-slate-500" title={new Date(post.timestamp).toLocaleString()}>
              {formatTime(post.timestamp)}
            </span>
            {post.isEdited && (
              <span className="text-[8px] text-slate-400 italic" title={post.editedAt ? new Date(post.editedAt).toLocaleString() : undefined}>
                (edited {post.editedAt ? formatTime(post.editedAt) : ''})
              </span>
            )}
          </div>

          <div className={`p-2.5 shadow-sm text-[10px] leading-relaxed whitespace-pre-wrap flex flex-col gap-2 relative group ${
            isCurrentUser 
              ? 'bg-indigo-500 text-white rounded-2xl rounded-tr-sm' 
              : 'bg-white dark:bg-white/10 dark:backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm'
          }`}>
            {isCurrentUser && !post.isSeen && !isEditing && (
              <div className="absolute top-0 right-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button onClick={() => setIsEditing(true)} className="p-1 text-slate-400 hover:text-indigo-500 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                  <Pencil size={10} />
                </button>
                <button onClick={onDelete} className="p-1 text-slate-400 hover:text-rose-500 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                  <Trash2 size={10} />
                </button>
              </div>
            )}

            {isEditing ? (
              <div className="flex flex-col gap-1 w-48">
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full text-slate-900 bg-white rounded p-1 text-[10px] outline-none resize-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex justify-end gap-1">
                  <button onClick={() => setIsEditing(false)} className="text-[8px] px-2 py-0.5 bg-slate-200 text-slate-700 rounded">Cancel</button>
                  <button onClick={handleSaveEdit} className="text-[8px] px-2 py-0.5 bg-indigo-600 text-white rounded">Save</button>
                </div>
              </div>
            ) : (
              post.content && <span>{post.content}</span>
            )}
            
            {post.media && (
              <div className="mt-1">
                {post.media.status === 'unavailable' && (
                  <div className="flex flex-col items-center justify-center p-3 bg-slate-100/20 rounded-xl border border-dashed border-white/30 text-center gap-2">
                    <span className="text-[9px] opacity-80">Media stored on sender's device</span>
                    <button onClick={onRequestMedia} className="flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[9px] font-medium transition-colors">
                      <Download size={10} /> Request Media
                    </button>
                  </div>
                )}
                {post.media.status === 'requested' && (
                  <div className="flex items-center justify-center p-3 bg-slate-100/20 rounded-xl border border-dashed border-white/30 text-center">
                    <span className="text-[9px] opacity-80 animate-pulse">Requesting media from sender...</span>
                  </div>
                )}
                {post.media.status === 'available' && (
                  <>
                    {post.media.type === 'audio' && (
                      <audio controls src={post.media.url} className="h-8 w-48 max-w-full rounded-full outline-none" />
                    )}
                    {post.media.type === 'video' && (
                      <video controls playsInline src={post.media.url} className="w-48 max-w-full rounded-xl border border-white/20 outline-none" />
                    )}
                    {post.media.type === 'image' && (
                      <img src={post.media.url} alt="Attached image" className="w-48 max-w-full rounded-xl border border-white/20 object-cover" />
                    )}
                    {post.media.type === 'file' && (
                      <a href={post.media.url} download={post.media.name} className="flex items-center gap-2 p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors">
                        <File size={14} />
                        <span className="text-[9px] truncate max-w-30">{post.media.name || 'Download File'}</span>
                      </a>
                    )}
                  </>
                )}
              </div>
            )}
            
            {isCurrentUser && (
              <div className="flex justify-end -mt-1 -mb-1 opacity-70">
                {post.isSeen ? <CheckCheck size={10} className="text-blue-300" /> : <Check size={10} />}
              </div>
            )}
          </div>

          <div className={`flex flex-wrap items-center gap-1 mt-1.5 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-center rounded-full p-0.5 border ${
              isCurrentUser 
                ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20' 
                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10'
            }`}>
              <button
                onClick={onLike}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-colors text-[9px] font-medium ${
                  post.userLiked 
                    ? 'bg-indigo-500 text-white' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <ThumbsUp size={10} className={post.userLiked ? 'fill-current' : ''} />
                {post.likes > 0 && <span>{post.likes}</span>}
              </button>
              <div className="w-px h-2.5 bg-slate-300 dark:bg-white/20 mx-0.5" />
              <button
                onClick={onDislike}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-colors text-[9px] font-medium ${
                  post.userDisliked 
                    ? 'bg-rose-500 text-white' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <ThumbsDown size={10} className={post.userDisliked ? 'fill-current' : ''} />
                {post.dislikes > 0 && <span>{post.dislikes}</span>}
              </button>
            </div>

            {post.reactions.map(reaction => (
              <button
                key={reaction.emoji}
                onClick={() => onToggleReaction(reaction.emoji)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-colors text-[9px] ${
                  reaction.userReacted 
                    ? 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300' 
                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10'
                }`}
              >
                <span className="text-[10px] leading-none">{reaction.emoji}</span>
                <span className="font-medium">{reaction.count}</span>
              </button>
            ))}

            <button
              onClick={onReact}
              className={`flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                isCurrentUser
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/30'
                  : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/10'
              }`}
            >
              <Plus size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
