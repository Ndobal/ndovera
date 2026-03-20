import { useMemo, useRef, useState } from 'react';
import { LoaderCircle, Paperclip, Sparkles, Trash2, UploadCloud } from 'lucide-react';

import {
  createClassroomNote,
  uploadClassroomAsset,
  type ClassroomCreatedDocument,
  type ClassroomCreatedDocumentBlock,
  type ClassroomMaterialAsset,
  type ClassroomMaterialViewerType,
} from '../services/classroomApi';

type ClassroomMaterialComposerProps = {
  defaultSubject?: string;
  lockSubject?: boolean;
  onSaved?: () => Promise<void> | void;
  submitLabel?: string;
  className?: string;
};

type DraftState = {
  title: string;
  subject: string;
  topic: string;
  week: string;
  visibility: string;
  summary: string;
  creatorBody: string;
};

type QueuedFile = {
  id: string;
  file: File;
  viewerType: Exclude<ClassroomMaterialViewerType, 'mixed' | 'ndovera-document'>;
};

const MATERIAL_ACCEPT = 'image/*,audio/*,video/*,.pdf,.doc,.docx,.ppt,.pptx';

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function detectViewerTypeFromFile(file: File): Exclude<ClassroomMaterialViewerType, 'mixed' | 'ndovera-document'> | null {
  const mime = file.type.toLowerCase();
  const lowerName = file.name.toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
  if (mime.includes('presentation') || lowerName.endsWith('.ppt') || lowerName.endsWith('.pptx')) return 'slides';
  if (
    mime.includes('msword')
    || mime.includes('wordprocessingml')
    || lowerName.endsWith('.doc')
    || lowerName.endsWith('.docx')
  ) {
    return 'document';
  }

  return null;
}

function toSentenceCase(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildDocumentBlocks(body: string): ClassroomCreatedDocumentBlock[] {
  return body
    .split(/\n\s*\n/g)
    .map((section) => section.trim())
    .filter(Boolean)
    .flatMap((section, index): ClassroomCreatedDocumentBlock[] => {
      const lines = section.split('\n').map((line) => line.trim()).filter(Boolean);
      if (!lines.length) return [];

      const bulletLines = lines.filter((line) => /^[-*•]/.test(line));
      if (bulletLines.length === lines.length) {
        return [{
          id: `block_${index}`,
          type: 'bullet-list' as const,
          items: bulletLines.map((line) => line.replace(/^[-*•]\s*/, '').trim()).filter(Boolean),
        }];
      }

      if (section.startsWith('"') && section.endsWith('"')) {
        return [{
          id: `block_${index}`,
          type: 'quote' as const,
          text: section.replace(/^"|"$/g, '').trim(),
        }];
      }

      return [{
        id: `block_${index}`,
        type: 'paragraph' as const,
        text: lines.join(' '),
      }];
    });
}

function buildCreatedDocument(title: string, subject: string, topic: string, body: string, summary: string): ClassroomCreatedDocument | null {
  const blocks = buildDocumentBlocks(body || summary);
  if (!blocks.length) return null;
  return {
    title,
    subtitle: [subject, topic].filter(Boolean).join(' • '),
    blocks,
  };
}

function deriveViewerType(assets: ClassroomMaterialAsset[], document: ClassroomCreatedDocument | null): ClassroomMaterialViewerType {
  const viewerTypes = new Set<ClassroomMaterialViewerType>();
  assets.forEach((asset) => viewerTypes.add(asset.viewerType));
  if (document) viewerTypes.add('ndovera-document');
  if (viewerTypes.size > 1) return 'mixed';
  return Array.from(viewerTypes)[0] || 'ndovera-document';
}

function deriveFormat(assets: ClassroomMaterialAsset[], document: ClassroomCreatedDocument | null) {
  const labels = new Set<string>();
  assets.forEach((asset) => labels.add(toSentenceCase(asset.viewerType)));
  if (document) labels.add('Ndovera Doc');
  return Array.from(labels).join(' + ') || 'Ndovera Doc';
}

function deriveDuration(viewerType: ClassroomMaterialViewerType, assetCount: number, document: ClassroomCreatedDocument | null) {
  if (viewerType === 'audio') return 'In-app listen';
  if (viewerType === 'video') return 'In-app watch';
  if (viewerType === 'image') return 'In-app view';
  if (viewerType === 'pdf' || viewerType === 'document' || viewerType === 'slides') return 'In-app read';
  if (viewerType === 'mixed') return `${assetCount + (document ? 1 : 0)} in-app items`;
  return 'In-app study';
}

export function ClassroomMaterialComposer({
  defaultSubject = '',
  lockSubject = false,
  onSaved,
  submitLabel = 'Create material',
  className = '',
}: ClassroomMaterialComposerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<DraftState>({
    title: '',
    subject: defaultSubject,
    topic: '',
    week: '1',
    visibility: 'Student-only',
    summary: '',
    creatorBody: '',
  });
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasCreatedDocument = useMemo(() => draft.creatorBody.trim().length > 0 || (!queuedFiles.length && draft.summary.trim().length > 0), [draft.creatorBody, draft.summary, queuedFiles.length]);

  const pickFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const accepted: QueuedFile[] = [];
    let unsupportedFile: string | null = null;

    Array.from(fileList).forEach((file) => {
      const viewerType = detectViewerTypeFromFile(file);
      if (!viewerType) {
        unsupportedFile = file.name;
        return;
      }
      accepted.push({ id: `${file.name}_${file.size}_${file.lastModified}`, file, viewerType });
    });

    if (unsupportedFile) {
      setError(`Unsupported material skipped: ${unsupportedFile}`);
    } else {
      setError(null);
    }

    if (accepted.length) {
      setQueuedFiles((current) => [...current, ...accepted]);
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  const removeQueuedFile = (id: string) => {
    setQueuedFiles((current) => current.filter((item) => item.id !== id));
  };

  const saveMaterial = async () => {
    if (!draft.title.trim()) {
      setError('Material title is required.');
      return;
    }

    if (!queuedFiles.length && !draft.creatorBody.trim() && !draft.summary.trim()) {
      setError('Add at least one file or create a Ndovera document body.');
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const uploadedAssets: ClassroomMaterialAsset[] = [];

      for (let index = 0; index < queuedFiles.length; index += 1) {
        const queued = queuedFiles[index];
        setStatus(`Uploading ${index + 1} of ${queuedFiles.length}…`);
        const formData = new FormData();
        formData.append('asset', queued.file);
        const uploaded = await uploadClassroomAsset(formData);
        uploadedAssets.push({
          id: `asset_${Date.now()}_${index}`,
          name: uploaded.name,
          url: uploaded.url,
          storageKey: uploaded.storageKey,
          mimeType: uploaded.mimeType,
          size: uploaded.size,
          extension: queued.file.name.includes('.') ? queued.file.name.split('.').pop()?.toLowerCase() : undefined,
          assetType: uploaded.assetType,
          viewerType: uploaded.viewerType,
        });
      }

      const createdDocument = buildCreatedDocument(
        draft.title.trim(),
        (lockSubject ? defaultSubject : draft.subject).trim() || 'General Studies',
        draft.topic.trim() || draft.title.trim(),
        draft.creatorBody.trim(),
        draft.summary.trim(),
      );

      const viewerType = deriveViewerType(uploadedAssets, createdDocument);
      const format = deriveFormat(uploadedAssets, createdDocument);
      const summary = draft.summary.trim()
        || createdDocument?.blocks.find((block) => block.type !== 'bullet-list')?.text
        || `Teacher shared ${format.toLowerCase()} material in Ndovera.`;

      setStatus('Saving material…');
      await createClassroomNote({
        title: draft.title.trim(),
        subject: (lockSubject ? defaultSubject : draft.subject).trim() || 'General Studies',
        topic: draft.topic.trim() || draft.title.trim(),
        week: Number(draft.week) || 1,
        summary,
        visibility: draft.visibility,
        format,
        duration: deriveDuration(viewerType, uploadedAssets.length, createdDocument),
        access: 'Secure in-app viewer only',
        viewerType,
        materials: uploadedAssets,
        ndoveraDocument: createdDocument,
      });

      setDraft({
        title: '',
        subject: defaultSubject,
        topic: '',
        week: '1',
        visibility: 'Student-only',
        summary: '',
        creatorBody: '',
      });
      setQueuedFiles([]);
      setStatus(null);
      await onSaved?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save material right now.');
      setStatus(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm ${className}`.trim()}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-950">Teacher upload + create studio</p>
          <p className="mt-1 text-sm text-slate-500">Upload video, audio, images, PDF, DOC, DOCX, and slides, or create a Ndovera document that stays in-app.</p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          <UploadCloud className="h-4 w-4" />
          Add files
        </button>
      </div>

      <input ref={inputRef} type="file" multiple accept={MATERIAL_ACCEPT} className="hidden" onChange={(event) => pickFiles(event.target.files)} />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Material title" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
        <input value={lockSubject ? defaultSubject : draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" disabled={lockSubject} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-70" />
        <input value={draft.topic} onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value }))} placeholder="Topic" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
        <input value={draft.week} onChange={(event) => setDraft((current) => ({ ...current, week: event.target.value }))} placeholder="Week" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
        <select value={draft.visibility} onChange={(event) => setDraft((current) => ({ ...current, visibility: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400">
          <option>Student-only</option>
          <option>Student + Parent</option>
          <option>Teacher-only</option>
        </select>
      </div>

      {queuedFiles.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {queuedFiles.map((queued) => (
            <div key={queued.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{queued.file.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{toSentenceCase(queued.viewerType)} • {formatBytes(queued.file.size)}</p>
                </div>
                <button type="button" onClick={() => removeQueuedFile(queued.id)} className="rounded-full bg-white p-2 text-slate-500 shadow-sm">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <Paperclip className="h-4 w-4" />
            No files queued yet
          </div>
          <p className="mt-2">Supported: video, audio, images, PDF, DOC, DOCX, PPT, PPTX.</p>
        </div>
      )}

      <textarea value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="Short learning summary for the material" className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />

      <div className="mt-4 rounded-[1.75rem] border border-violet-200 bg-[linear-gradient(180deg,rgba(245,243,255,0.96)_0%,rgba(238,242,255,0.96)_100%)] p-4">
        <div className="flex items-center gap-2 text-violet-900">
          <Sparkles className="h-4 w-4" />
          <p className="text-sm font-bold">Create in Ndovera</p>
        </div>
        <p className="mt-2 text-sm text-violet-800/80">Write a teacher-made study copy, slide notes, or a document summary that students can read inside the app.</p>
        <textarea value={draft.creatorBody} onChange={(event) => setDraft((current) => ({ ...current, creatorBody: event.target.value }))} placeholder={'Use blank lines to split sections.\n\n- Bullet one\n- Bullet two\n\n"Important quote or instruction"'} className="mt-3 min-h-36 w-full rounded-2xl border border-violet-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400" />
        <p className="mt-2 text-xs font-medium text-violet-800/70">{hasCreatedDocument ? 'A Ndovera document will be included with this material.' : 'Add text here if you want an in-app Ndovera document.'}</p>
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {status ? <p className="mt-4 text-sm font-medium text-sky-600">{status}</p> : null}

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={saveMaterial} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70">
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </section>
  );
}
