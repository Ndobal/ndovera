import React, { useEffect, useRef, useState } from 'react';
import { streamPostTypes, streamPostsSeed } from '../data/classroomData';
import { createTextDownload, getRoleAccent } from '../shared/classroomHelpers';

const reactionIcons = ['👍', '❤️', '🔥', '📚'];

export default function StreamTab() {
  const currentUserName = localStorage.getItem('userName') || 'Current Student';
  const [postType, setPostType] = useState(streamPostTypes[0] || '');
  const [postContent, setPostContent] = useState('');
  const [postAttachments, setPostAttachments] = useState([]);
  const [posts, setPosts] = useState(streamPostsSeed || []);
  const [studentMuted, setStudentMuted] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const bottomAnchorRef = useRef(null);

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [posts]);

  const addAttachment = () => {
    if (studentMuted) return;
    const value = window.prompt('Enter file name or resource link');
    if (!value) return;
    const normalized = value.trim();
    if (!normalized) return;
    setPostAttachments(prev => [...prev, normalized]);
  };

  const publishPost = () => {
    const content = postContent.trim();
    if (!content || studentMuted) return;

      setPosts(prev => ([...prev, {
        id: `post-${Date.now()}`,
        type: postType,
        author: currentUserName,
        role: 'Student',
        time: 'Now',
      pinned: false,
      locked: false,
      content,
      attachments: postAttachments,
      reactions: { '👍': 0, '❤️': 0, '🔥': 0, '📚': 0 },
      comments: [],
    }]));

    setPostContent('');
    setPostAttachments([]);
  };

  const updatePost = (postId, updater) => {
    setPosts(prev => prev.map(post => (post.id === postId ? updater(post) : post)));
  };

  const reactToPost = (postId, emoji) => {
    updatePost(postId, post => ({
      ...post,
      reactions: {
        ...post.reactions,
        [emoji]: (post.reactions[emoji] || 0) + 1,
      },
    }));
  };

  const addComment = (postId) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text || studentMuted) return;

    updatePost(postId, post => {
      if (post.locked) return post;
      return {
        ...post,
        comments: [
          ...post.comments,
          {
            id: `${postId}-c-${Date.now()}`,
            user: currentUserName,
            role: 'Student',
            text,
            time: 'Now',
            highlighted: false,
            replies: [],
          },
        ],
      };
    });

    setCommentDrafts(prev => ({ ...prev, [postId]: '' }));
  };

  const addReply = (postId, commentId) => {
    const key = `${postId}-${commentId}`;
    const text = (replyDrafts[key] || '').trim();
    if (!text || studentMuted) return;

    updatePost(postId, post => {
      if (post.locked) return post;
      return {
        ...post,
        comments: post.comments.map(comment => (
          comment.id !== commentId ? comment : {
            ...comment,
            replies: [
              ...comment.replies,
              { id: `${commentId}-r-${Date.now()}`, user: currentUserName, role: 'Student', text, time: 'Now' },
            ],
          }
        )),
      };
    });

    setReplyDrafts(prev => ({ ...prev, [key]: '' }));
  };

  const handleTeacherAction = (postId, action) => {
    if (action === 'delete') {
      setPosts(prev => prev.filter(post => post.id !== postId));
      return;
    }

    updatePost(postId, post => {
      if (action === 'pin') return { ...post, pinned: !post.pinned };
      if (action === 'lock') return { ...post, locked: !post.locked };
      if (action === 'highlight') {
        return {
          ...post,
          comments: post.comments.map((comment, index) => ({ ...comment, highlighted: index === 0 ? !comment.highlighted : comment.highlighted })),
        };
      }
      return post;
    });
  };

  return (
    <div className="glass-surface rounded-3xl p-4 md:p-5 h-full min-h-0 flex flex-col overflow-x-hidden relative">
      <section className="pb-3 border-b border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="micro-label accent-indigo">Teacher Controls</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStudentMuted(prev => !prev)} className="px-3 py-1.5 rounded-xl border border-white/10 bg-slate-900/30 text-sm text-slate-100">{studentMuted ? 'Unmute Student' : 'Mute Student'}</button>
            <span className="glass-chip rounded-full px-3 py-1 micro-label accent-amber">Pinned: {posts.filter(post => post.pinned).length}</span>
            <span className="glass-chip rounded-full px-3 py-1 micro-label accent-rose">Locked: {posts.filter(post => post.locked).length}</span>
          </div>
        </div>
      </section>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 pr-1 pb-40 space-y-4">
        {posts.length > 0 ? posts.map(post => (
          <article key={post.id} className="glass-surface rounded-3xl p-5 space-y-4 overflow-hidden">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-slate-100 font-semibold">{post.author}</p>
                <p className={`micro-label ${getRoleAccent(post.role)}`}>{post.role}</p>
              </div>
              <div className="text-right">
                <p className="neon-subtle text-sm">{post.time}</p>
                <div className="flex gap-2 justify-end mt-1">
                  {post.pinned && <span className="glass-chip px-2 py-0.5 rounded-full micro-label accent-emerald">Pinned</span>}
                  {post.locked && <span className="glass-chip px-2 py-0.5 rounded-full micro-label accent-rose">Comments Locked</span>}
                  <span className="glass-chip px-2 py-0.5 rounded-full micro-label accent-indigo">{post.type}</span>
                </div>
              </div>
            </div>
            <p className="text-slate-200 break-words">{post.content}</p>

            {post.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.attachments.map(file => (
                  <button key={file} onClick={() => createTextDownload(`${file.replace(/\s+/g, '-').toLowerCase()}.txt`, `${file}\nAttached from class stream`)} className="glass-chip px-3 py-1 rounded-full text-xs text-slate-100">{file}</button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {reactionIcons.map(emoji => (
                  <button key={emoji} onClick={() => reactToPost(post.id, emoji)} className="px-3 py-1 rounded-full bg-slate-900/30 border border-white/10 text-sm text-slate-100">{emoji} {post.reactions[emoji] || 0}</button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleTeacherAction(post.id, 'pin')} className="px-3 py-1 rounded-full text-xs border border-white/10 bg-slate-900/30 text-slate-100">{post.pinned ? 'Unpin' : 'Pin'}</button>
                <button onClick={() => handleTeacherAction(post.id, 'lock')} className="px-3 py-1 rounded-full text-xs border border-white/10 bg-slate-900/30 text-slate-100">{post.locked ? 'Unlock Comments' : 'Lock Comments'}</button>
                <button onClick={() => handleTeacherAction(post.id, 'highlight')} className="px-3 py-1 rounded-full text-xs border border-white/10 bg-slate-900/30 text-slate-100">Highlight Reply</button>
                <button onClick={() => handleTeacherAction(post.id, 'delete')} className="px-3 py-1 rounded-full text-xs border border-rose-300/30 bg-rose-500/20 text-rose-100">Delete</button>
              </div>
            </div>

            <div className="space-y-3">
              {post.comments.map(comment => (
                <div key={comment.id} className={`rounded-2xl border p-3 ${comment.highlighted ? 'border-emerald-300/50 bg-emerald-500/10' : 'border-white/10 bg-slate-900/30'}`}>
                  <div className="flex justify-between gap-3">
                    <p className="text-slate-100 text-sm break-words"><span className="font-semibold">{comment.user}:</span> {comment.text}</p>
                    <p className="micro-label accent-indigo">{comment.time}</p>
                  </div>

                  {comment.replies.length > 0 && (
                    <div className="mt-2 ml-3 space-y-2 border-l border-white/10 pl-3">
                      {comment.replies.map(reply => <p key={reply.id} className="text-xs text-slate-300 break-words"><span className="font-semibold text-slate-100">{reply.user}:</span> {reply.text}</p>)}
                    </div>
                  )}

                  {!post.locked && (
                    <div className="mt-2 flex gap-2">
                      <input value={replyDrafts[`${post.id}-${comment.id}`] || ''} onChange={event => setReplyDrafts(prev => ({ ...prev, [`${post.id}-${comment.id}`]: event.target.value }))} className="flex-1 rounded-xl bg-slate-900/40 border border-white/10 px-3 py-1.5 text-xs text-slate-100" placeholder="Reply to comment" disabled={studentMuted} />
                      <button onClick={() => addReply(post.id, comment.id)} disabled={studentMuted} className="px-3 py-1 rounded-xl text-xs border border-white/10 bg-slate-900/30 text-slate-100">Reply</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!post.locked && (
              <div className="flex gap-2">
                <input value={commentDrafts[post.id] || ''} onChange={event => setCommentDrafts(prev => ({ ...prev, [post.id]: event.target.value }))} className="flex-1 rounded-xl bg-slate-900/40 border border-white/10 px-3 py-2 text-sm text-slate-100" placeholder="Add a comment" disabled={studentMuted} />
                <button onClick={() => addComment(post.id)} disabled={studentMuted} className="px-4 py-2 rounded-xl bg-indigo-500/30 border border-indigo-300/40 text-white text-sm">Comment</button>
              </div>
            )}
          </article>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/20 p-5 text-center">
            <p className="micro-label accent-amber">No live stream posts</p>
            <p className="mt-2 text-sm text-slate-300">Announcements and classroom discussions will appear here when teachers publish them.</p>
          </div>
        )}
        <div ref={bottomAnchorRef} />
      </div>

      <section className="absolute bottom-0 left-0 right-0 z-20 px-4 md:px-5 pb-3 pt-2 bottom-nav bottom-nav--subtle overflow-hidden">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 pb-1">
            {streamPostTypes.map(type => (
              <button key={type} onClick={() => setPostType(type)} className={postType === type ? 'px-2 py-1 rounded-full text-[10px] bg-indigo-500/30 border border-indigo-300/40 text-white' : 'px-2 py-1 rounded-full text-[10px] bg-slate-900/50 border border-white/10 text-slate-200'}>{type}</button>
            ))}
          </div>

          {postAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {postAttachments.map(item => <span key={item} className="glass-chip px-3 py-1 rounded-full text-xs text-slate-100">{item}</span>)}
            </div>
          )}

          <div className="rounded-2xl bg-slate-900 border border-white/10 p-2 space-y-1.5 overflow-hidden">
            <textarea
              value={postContent}
              onChange={event => setPostContent(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  publishPost();
                }
              }}
              rows={2}
              className="w-full min-h-[44px] max-h-[72px] bg-transparent outline-none text-sm text-slate-100 resize-none"
              placeholder={studentMuted ? 'You are currently muted by teacher controls.' : 'Share an update with your class stream'}
              disabled={studentMuted}
            />

            <div className="flex items-center gap-2 pt-1 border-t border-white/10 min-w-0">
              <button
                onClick={addAttachment}
                disabled={studentMuted}
                className="h-10 w-10 shrink-0 rounded-full bg-slate-900/40 border border-white/10 text-base text-slate-100"
                aria-label="Attach"
                title="Attach"
              >
                📎
              </button>
              <div className="flex-1 min-w-0" />
              <button
                onClick={publishPost}
                disabled={studentMuted}
                className="h-10 w-10 shrink-0 rounded-full bg-indigo-500/30 border border-indigo-300/40 text-base text-white"
                aria-label="Send"
                title="Send"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
