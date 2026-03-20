import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, FileUp, Info, Link2, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';

export default function UploadLessonPlan({ goBack }: { goBack: () => void }) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [week, setWeek] = useState('');
  const [visibility, setVisibility] = useState('Draft only');
  const [attachLiveClass, setAttachLiveClass] = useState('Attach later');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.uploadLessonPlan({
        topic: topic || file.name,
        subject,
        week,
        visibility,
        liveClassMode: attachLiveClass,
        materials: `${file.name} (${file.type || 'unknown type'})`,
        notes: `Uploaded draft metadata captured from ${file.name} • ${Math.round(file.size / 1024)} KB`,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/classroom');
      }, 2000);
    } catch (err) {
      setError('Failed to upload lesson plan');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-2xl rounded-[28px] border border-emerald-500/20 bg-slate-950 p-8 text-center shadow-2xl shadow-emerald-950/20">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
        <h1 className="mt-4 text-3xl font-black text-slate-100">Upload draft saved</h1>
        <p className="mt-2 text-slate-400">Redirecting you back to the classroom workspace...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <button onClick={goBack} className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" />
        Back to Lesson Plans
      </button>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleSubmit} className="rounded-4xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/20">
          <div className="rounded-[28px] border border-sky-500/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.14),rgba(168,85,247,0.08),rgba(15,23,42,0.95))] p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-sky-300">Upload lesson plan</p>
            <h1 className="mt-3 text-3xl font-black text-white">Bring in existing lesson material and tag it for release</h1>
            <p className="mt-3 text-sm text-slate-300">Upload a document or slide pack, then connect it to subject, week, visibility, and live class delivery.</p>
          </div>

          <div className="mt-6 space-y-5">
            <label htmlFor="file" className="block rounded-[28px] border border-dashed border-slate-700 bg-slate-900/70 p-8 text-center transition hover:border-emerald-500/60 hover:bg-slate-900">
              <UploadCloud className="mx-auto h-10 w-10 text-emerald-400" />
              <p className="mt-4 text-lg font-bold text-slate-100">Choose a lesson plan file</p>
              <p className="mt-2 text-sm text-slate-400">PDF, slides, images, worksheets, or planning documents.</p>
              <input
                type="file"
                id="file"
                onChange={handleFileChange}
                className="sr-only"
              />
              <span className="mt-4 inline-flex rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-white">
                Select file
              </span>
              {file ? <p className="mt-4 text-sm font-semibold text-emerald-300">Selected: {file.name}</p> : null}
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-slate-200">Subject</label>
                <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-500" placeholder="Subject name" />
              </div>
              <div>
                <label htmlFor="topic" className="block text-sm font-semibold text-slate-200">Topic</label>
                <input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-500" placeholder="Topic title" />
              </div>
              <div>
                <label htmlFor="week" className="block text-sm font-semibold text-slate-200">Week</label>
                <input id="week" type="number" min="1" value={week} onChange={(e) => setWeek(e.target.value)} className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-500" placeholder="Week number" />
              </div>
              <div>
                <label htmlFor="visibility" className="block text-sm font-semibold text-slate-200">Visibility</label>
                <select id="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)} className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-500">
                  <option>Draft only</option>
                  <option>Immediate release</option>
                  <option>Schedule for later</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="attachLiveClass" className="block text-sm font-semibold text-slate-200">Live class link</label>
                <select id="attachLiveClass" value={attachLiveClass} onChange={(e) => setAttachLiveClass(e.target.value)} className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-500">
                  <option>Attach later</option>
                  <option>Use as pre-read material</option>
                  <option>Use as post-class follow-up</option>
                  <option>Attach to next live class</option>
                </select>
              </div>
            </div>
          </div>

          {error && <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Info className="h-4 w-4 text-sky-400" />
              Upload flow is ready for metadata and classroom linking.
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Uploading...' : 'Save Upload Draft'}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-4xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/20">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-violet-300">What this upload captures</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-3"><FileUp className="h-4 w-4 text-emerald-400" /> Existing PDFs, slide decks, and planning files</div>
              <div className="flex items-center gap-3"><Link2 className="h-4 w-4 text-sky-400" /> Metadata for subject, week, and release visibility</div>
              <div className="flex items-center gap-3"><UploadCloud className="h-4 w-4 text-amber-400" /> Future live-class attachment for pre-read and follow-up use</div>
            </div>
          </div>

          <div className="rounded-4xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/20">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-emerald-300">Current selection</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p><span className="font-semibold text-white">File:</span> {file?.name || 'No file selected'}</p>
              <p><span className="font-semibold text-white">Subject:</span> {subject || 'Not set'}</p>
              <p><span className="font-semibold text-white">Topic:</span> {topic || 'Not set'}</p>
              <p><span className="font-semibold text-white">Week:</span> {week || 'Not set'}</p>
              <p><span className="font-semibold text-white">Visibility:</span> {visibility}</p>
              <p><span className="font-semibold text-white">Live class:</span> {attachLiveClass}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
