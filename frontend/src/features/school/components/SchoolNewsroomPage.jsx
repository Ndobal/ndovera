import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getStoredAuth } from '../../auth/services/authApi';
import {
  commentOnSchoolNewsPost,
  getSchoolNewsEngagement,
  getSchoolNewsPosts,
  publishSchoolNewsPost,
  reactToSchoolNewsPost,
  reviewSchoolNewsPost,
  saveSchoolNewsPost,
  submitSchoolNewsPost,
  uploadSchoolNewsMedia,
} from '../services/schoolApi';

const REVIEW_ROLES = new Set(['ict', 'ict_manager', 'hos', 'owner']);
const PUBLISH_ROLES = new Set(['hos', 'owner']);
const AUDIENCE_OPTIONS = [
  { value: 'parents', label: 'Parents' },
  { value: 'staff', label: 'Staff' },
  { value: 'students', label: 'Students' },
  { value: 'website', label: 'Website (public)' },
];
const NEWS_REACTIONS = ['👍', '❤️', '🎉', '👏', '😮'];
const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-[#191970] shadow-sm';
const INPUT = 'mt-1 w-full rounded-2xl border border-[#c9a96e]/40 bg-[#fff8ee] px-4 py-3 text-sm text-[#191970] outline-none focus:border-[#800020]';
const BUTTON = 'rounded-full bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e]';
const MUTED = 'text-sm text-[#800020]';

function createEmptyDraft(authorName) {
  return {
    id: '',
    title: '',
    excerpt: '',
    content: '',
    coverUrl: '',
    audience: ['parents', 'staff', 'students'],
    authorName: authorName || 'Newsroom author',
  };
}

function formatDate(value) {
  if (!value) return 'Not yet';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function StatusBadge({ status }) {
  const normalized = String(status || 'draft').toLowerCase();
  const colors = {
    draft: 'bg-[#fff8ee] text-[#800020]',
    submitted: 'bg-[#191970] text-[#f5deb3]',
    reviewed: 'bg-[#1a5c38] text-[#f5deb3]',
    changes_requested: 'bg-[#800000] text-[#f5deb3]',
    published: 'bg-[#800020] text-[#f5deb3]',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${colors[normalized] || colors.draft}`}>
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}

function StoryCard({ post, actions = null, footer = null }) {
  return (
    <article className="rounded-3xl border border-[#c9a96e]/40 bg-[#fff8ee] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={post.status} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">{post.authorRole || 'author'}</span>
          </div>
          <h3 className="text-xl font-bold text-[#800000]">{post.title}</h3>
          <p className={MUTED}>By {post.authorName || 'Unknown author'} • Updated {formatDate(post.updatedAt)}</p>
        </div>
        {actions}
      </div>
      {post.coverUrl ? <img src={post.coverUrl} alt={post.title} className="mt-4 h-48 w-full rounded-3xl object-cover" /> : null}
      {post.excerpt ? <p className="mt-4 text-sm leading-7 text-[#191970]">{post.excerpt}</p> : null}
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#191970]">{post.content}</p>
      {post.reviewNotes ? <div className="mt-4 rounded-2xl bg-[#f5deb3] px-4 py-3 text-sm text-[#800020]"><strong>Review notes:</strong> {post.reviewNotes}</div> : null}
      {footer}
    </article>
  );
}

function NewsEngagement({ postId }) {
  const [data, setData] = useState({ views: 0, reactions: {}, comments: [] });
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getSchoolNewsEngagement(postId)
      .then(result => { if (active) setData({ views: result?.views || 0, reactions: result?.reactions || {}, comments: result?.comments || [] }); })
      .catch(() => {});
    return () => { active = false; };
  }, [postId]);

  async function react(reaction) {
    try {
      const result = await reactToSchoolNewsPost(postId, reaction);
      setData({ views: result?.views || 0, reactions: result?.reactions || {}, comments: result?.comments || [] });
    } catch {}
  }

  async function sendComment() {
    const body = comment.trim();
    if (!body) return;
    setBusy(true);
    try {
      const result = await commentOnSchoolNewsPost(postId, body);
      setData({ views: result?.views || 0, reactions: result?.reactions || {}, comments: result?.comments || [] });
      setComment('');
    } catch {} finally { setBusy(false); }
  }

  const totalReactions = Object.values(data.reactions).reduce((sum, n) => sum + Number(n || 0), 0);

  return (
    <div className="mt-4 border-t border-[#c9a96e]/30 pt-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-[#800020]">
        <span className="font-semibold">👁 {data.views} views</span>
        <span className="font-semibold">💬 {data.comments.length} comments</span>
        <span className="font-semibold">⭐ {totalReactions} reactions</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {NEWS_REACTIONS.map(reaction => (
          <button key={reaction} type="button" onClick={() => react(reaction)} className="rounded-full border border-[#c9a96e]/40 bg-[#fff8ee] px-3 py-1 text-sm">
            {reaction} {data.reactions[reaction] ? <span className="font-bold">{data.reactions[reaction]}</span> : null}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {data.comments.map(item => (
          <div key={item.id} className="rounded-2xl bg-[#fff8ee] px-3 py-2 text-sm text-[#191970]">
            <span className="font-bold">{item.authorName}: </span>{item.body}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input value={comment} onChange={event => setComment(event.target.value)} placeholder="Add a comment" className="flex-1 rounded-2xl border border-[#c9a96e]/40 bg-[#fff8ee] px-3 py-2 text-sm text-[#191970] outline-none" />
        <button type="button" onClick={sendComment} disabled={busy} className="rounded-full bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3]">{busy ? '...' : 'Post'}</button>
      </div>
    </div>
  );
}

export default function SchoolNewsroomPage({
  viewerRole = 'teacher',
  dashboardLabel = 'School Dashboard',
  title = 'School Newsroom',
  subtitle = 'Write school stories, submit them for review, and move approved posts into public publication.',
}) {
  const auth = getStoredAuth();
  const user = auth?.user || {};
  const authorName = user?.name || user?.email || 'Newsroom author';
  const canReview = REVIEW_ROLES.has(viewerRole);
  const canPublish = PUBLISH_ROLES.has(viewerRole);
  const viewerChannel = viewerRole === 'parent' ? 'parents' : viewerRole === 'student' ? 'students' : 'staff';
  const fileRef = useRef(null);
  const [form, setForm] = useState(createEmptyDraft(authorName));
  const [mine, setMine] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [publicationQueue, setPublicationQueue] = useState([]);
  const [published, setPublished] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadNewsroom = useCallback(() => {
    setLoading(true);
    setError('');

    Promise.all([
      getSchoolNewsPosts({ scope: 'mine' }).catch(() => ({ posts: [] })),
      canReview ? getSchoolNewsPosts({ scope: 'review' }).catch(() => ({ posts: [] })) : Promise.resolve({ posts: [] }),
      canPublish ? getSchoolNewsPosts({ scope: 'publication' }).catch(() => ({ posts: [] })) : Promise.resolve({ posts: [] }),
      getSchoolNewsPosts({ scope: 'published' }).catch(() => ({ posts: [] })),
    ])
      .then(([mineResult, reviewResult, publicationResult, publishedResult]) => {
        setMine(mineResult?.posts || []);
        setReviewQueue(reviewResult?.posts || []);
        setPublicationQueue(publicationResult?.posts || []);
        setPublished(publishedResult?.posts || []);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Could not load the newsroom.');
      })
      .finally(() => setLoading(false));
  }, [canPublish, canReview]);

  useEffect(() => {
    setForm(current => (current.id ? current : createEmptyDraft(authorName)));
  }, [authorName]);

  useEffect(() => {
    loadNewsroom();
  }, [loadNewsroom]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const result = await uploadSchoolNewsMedia(file);
      setForm(current => ({ ...current, coverUrl: result.url || '' }));
      setMessage('Cover uploaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload cover media.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveSchoolNewsPost(form);
      setMessage('Draft saved.');
      loadNewsroom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save draft.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await submitSchoolNewsPost(form);
      setMessage('Story submitted for review.');
      setForm(createEmptyDraft(authorName));
      loadNewsroom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit story.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(post, decision) {
    const defaultNote = decision === 'approve' ? 'Ready for HoS/Owner publication.' : post.reviewNotes || '';
    const reviewNotes = window.prompt(decision === 'approve' ? 'Review notes for publication readiness' : 'Explain what needs to change', defaultNote);
    if (reviewNotes === null) return;
    setError('');
    setMessage('');
    try {
      await reviewSchoolNewsPost(post.id, { decision, reviewNotes });
      setMessage(decision === 'approve' ? 'Story reviewed and moved to publication queue.' : 'Changes requested from the author.');
      loadNewsroom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review story.');
    }
  }

  async function handlePublish(post) {
    if (!window.confirm(`Publish "${post.title}" to the public school website?`)) return;
    setError('');
    setMessage('');
    try {
      await publishSchoolNewsPost(post.id);
      setMessage('Story published to the public news page.');
      loadNewsroom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish story.');
    }
  }

  function startEditing(post) {
    setForm({
      id: post.id || '',
      title: post.title || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      coverUrl: post.coverUrl || '',
      audience: Array.isArray(post.audience) && post.audience.length ? post.audience : ['parents', 'staff', 'students'],
      authorName: post.authorName || authorName,
    });
    setMessage(`Editing ${post.title}.`);
    setError('');
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className={CARD}>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#800020]">{dashboardLabel}</p>
        <h1 className="mt-3 text-3xl font-black text-[#800000]">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#191970]">{subtitle}{loading ? ' • Loading newsroom…' : ''}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'My Stories', value: mine.length },
          { label: 'Review Queue', value: reviewQueue.length },
          { label: 'Ready To Publish', value: publicationQueue.length },
          { label: 'Published', value: published.length },
        ].map(metric => (
          <article key={metric.label} className={CARD}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">{metric.label}</p>
            <p className="mt-3 text-3xl font-black text-[#191970]">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[#800000]">Write Or Update A Story</h2>
            <p className={`${MUTED} mt-2`}>Owner, teachers, staff, parents, and students can draft stories here. ICT or leadership reviews them before HoS or Owner publishes.</p>
          </div>
          <button type="button" onClick={() => setForm(createEmptyDraft(user))} className="rounded-full border border-[#800020]/20 bg-[#fff8ee] px-4 py-2 text-sm font-semibold text-[#800020]">
            New Story
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.42fr]">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">Title</label>
              <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className={INPUT} placeholder="Morning assembly spotlight" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">Excerpt</label>
              <textarea rows={3} value={form.excerpt} onChange={event => setForm(current => ({ ...current, excerpt: event.target.value }))} className={`${INPUT} resize-none`} placeholder="Short summary for the public news cards" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">Story</label>
              <textarea rows={10} value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} className={`${INPUT} resize-y`} placeholder="Write the full blog story here" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">Publish To</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {AUDIENCE_OPTIONS.map(option => {
                  const selected = (form.audience || []).includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm(current => {
                        const set = new Set(current.audience || []);
                        if (set.has(option.value)) set.delete(option.value); else set.add(option.value);
                        return { ...current, audience: Array.from(set) };
                      })}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition ${selected ? 'bg-[#1a5c38] text-[#f5deb3]' : 'border border-[#c9a96e]/40 bg-[#fff8ee] text-[#800020]'}`}
                    >
                      {selected ? '✓ ' : ''}{option.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setForm(current => ({ ...current, audience: ['parents', 'staff', 'students', 'website'] }))}
                  className="rounded-full border border-[#800020]/30 bg-[#fff8ee] px-4 py-2 text-sm font-bold text-[#800020]"
                >
                  Everyone
                </button>
              </div>
              <p className={`${MUTED} mt-2`}>Choose who sees this story. Website posts appear on your public site with reactions and comments.</p>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-[#c9a96e]/40 bg-[#fff8ee] p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">Cover Media</p>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={`${BUTTON} mt-3`}>
                {uploading ? 'Uploading...' : 'Upload Cover'}
              </button>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
              {form.coverUrl ? <img src={form.coverUrl} alt="Story cover" className="mt-4 h-52 w-full rounded-3xl object-cover" /> : <div className="mt-4 flex h-52 items-center justify-center rounded-3xl border border-dashed border-[#c9a96e]/50 text-sm text-[#800020]">No cover selected</div>}
            </div>
            {message ? <p className="text-sm text-[#1a5c38]">{message}</p> : null}
            {error ? <p className="text-sm text-[#800000]">{error}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={handleSave} disabled={saving} className={BUTTON}>{saving ? 'Saving...' : 'Save Draft'}</button>
              <button type="button" onClick={handleSubmit} disabled={submitting} className="rounded-full bg-[#800020] px-5 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#600018]">{submitting ? 'Submitting...' : 'Submit For Review'}</button>
            </div>
          </div>
        </div>
      </section>

      {mine.length > 0 ? (
        <section className={CARD}>
          <h2 className="text-2xl font-bold text-[#800000]">My Stories</h2>
          <div className="mt-5 space-y-4">
            {mine.map(post => (
              <StoryCard
                key={post.id}
                post={post}
                actions={post.status === 'published' ? null : <button type="button" onClick={() => startEditing(post)} className="rounded-full bg-[#191970] px-4 py-2 text-sm font-bold text-[#f5deb3]">Edit</button>}
                footer={post.publishedAt ? <p className={`${MUTED} mt-4`}>Published {formatDate(post.publishedAt)}</p> : null}
              />
            ))}
          </div>
        </section>
      ) : null}

      {canReview && reviewQueue.length > 0 ? (
        <section className={CARD}>
          <h2 className="text-2xl font-bold text-[#800000]">Review Queue</h2>
          <div className="mt-5 space-y-4">
            {reviewQueue.map(post => (
              <StoryCard
                key={post.id}
                post={post}
                actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => handleReview(post, 'approve')} className="rounded-full bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3]">Approve</button><button type="button" onClick={() => handleReview(post, 'changes_requested')} className="rounded-full bg-[#800000] px-4 py-2 text-sm font-bold text-[#f5deb3]">Request Changes</button></div>}
              />
            ))}
          </div>
        </section>
      ) : null}

      {canPublish && publicationQueue.length > 0 ? (
        <section className={CARD}>
          <h2 className="text-2xl font-bold text-[#800000]">Publication Queue</h2>
          <div className="mt-5 space-y-4">
            {publicationQueue.map(post => (
              <StoryCard
                key={post.id}
                post={post}
                actions={<button type="button" onClick={() => handlePublish(post)} className="rounded-full bg-[#800020] px-4 py-2 text-sm font-bold text-[#f5deb3]">Publish</button>}
              />
            ))}
          </div>
        </section>
      ) : null}

      {(() => {
        // Each viewer only sees published stories targeted to their channel; reviewers see everything.
        const visiblePublished = canReview
          ? published
          : published.filter(post => !Array.isArray(post.audience) || post.audience.length === 0 || post.audience.includes(viewerChannel));
        if (visiblePublished.length === 0) return null;
        return (
        <section className={CARD}>
          <h2 className="text-2xl font-bold text-[#800000]">Published Stories</h2>
          <div className="mt-5 space-y-4">
            {visiblePublished.map(post => (
              <StoryCard
                key={post.id}
                post={post}
                footer={(
                  <>
                    <p className={`${MUTED} mt-4`}>Published {formatDate(post.publishedAt)}{Array.isArray(post.audience) && post.audience.length ? ` • ${post.audience.join(', ')}` : ''}</p>
                    {Array.isArray(post.audience) && post.audience.includes('website') ? <NewsEngagement postId={post.id} /> : null}
                  </>
                )}
              />
            ))}
          </div>
        </section>
        );
      })()}
    </div>
  );
}
