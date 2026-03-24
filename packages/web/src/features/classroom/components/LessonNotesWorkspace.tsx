import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCheck, FileStack, Printer, Search, ShieldCheck } from 'lucide-react';

import { useData } from '../../../hooks/useData';
import { applyLessonNoteSignature } from '../services/classroomApi';
import type { ClassroomCreatedDocument, ClassroomNote, LessonNoteApproval, LessonNoteApprovalStatus } from '../services/classroomApi';
import { ClassroomMaterialComposer } from './ClassroomMaterialComposer';
import { ClassroomMaterialViewer } from './ClassroomMaterialViewer';

type LessonNotesWorkspaceProps = {
  role: string;
  currentUserName?: string;
  selectedClassName?: string;
  selectedClassSection?: string;
  schoolName?: string;
  schoolLogoUrl?: string | null;
  schoolPrimaryColor?: string;
};

function formatDateTime(value?: string) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function normalizeApproval(note: ClassroomNote): LessonNoteApproval {
  const baseClassName = note.approval?.className || note.className || 'Unassigned class';
  const classSection = normalizeSectionId(note.approval?.classSection || note.classSection) || inferLessonNoteSection('', baseClassName);
  const submittedBy = note.approval?.submittedBy || 'Subject Teacher';
  const submittedAt = note.approval?.submittedAt;
  const headOfSection = note.approval?.headOfSection || null;
  const hos = note.approval?.hos || null;

  let status: LessonNoteApprovalStatus = note.approval?.status || 'Draft';
  if (headOfSection && hos) status = 'Approved';
  else if (hos) status = 'HOS signed';
  else if (headOfSection) status = 'Head of Section signed';
  else if (submittedAt) status = 'Submitted';

  return {
    status,
    submittedAt,
    submittedBy,
    className: baseClassName,
    classSection,
    headOfSection,
    hos,
  };
}

function normalizeNote(note: ClassroomNote): ClassroomNote {
  const approval = normalizeApproval(note);
  return {
    ...note,
    className: approval.className,
    approval,
  };
}

function mergeNotes(baseNotes: ClassroomNote[], sessionNotes: ClassroomNote[]) {
  const noteMap = new Map<string, ClassroomNote>();

  baseNotes.forEach((note) => {
    const normalized = normalizeNote(note);
    noteMap.set(normalized.id, normalized);
  });

  sessionNotes.forEach((note) => {
    const normalized = normalizeNote(note);
    noteMap.set(normalized.id, normalized);
  });

  return Array.from(noteMap.values()).sort((left, right) => {
    const leftDate = left.approval?.submittedAt ? new Date(left.approval.submittedAt).getTime() : 0;
    const rightDate = right.approval?.submittedAt ? new Date(right.approval.submittedAt).getTime() : 0;
    return rightDate - leftDate || right.week - left.week || left.subject.localeCompare(right.subject);
  });
}

function normalizeRoleName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeSectionId(value?: string) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'preschool' || normalized === 'nursery' || normalized === 'pre school' || normalized === 'pre-school') return 'pre-school';
  if (normalized === 'grade' || normalized === 'primary') return 'primary';
  if (normalized === 'junior secondary' || normalized === 'junior-secondary' || normalized === 'jss') return 'junior-secondary';
  if (normalized === 'senior secondary' || normalized === 'senior-secondary' || normalized === 'sss') return 'senior-secondary';
  return normalized;
}

function inferLessonNoteSection(selectedClassSection?: string, className?: string) {
  const selected = normalizeSectionId(selectedClassSection);
  if (selected) return selected;
  const normalizedClassName = String(className || '').trim().toLowerCase();
  if (/(early explorers|reception|pre[- ]school|preschool|nursery)/.test(normalizedClassName)) return 'pre-school';
  if (/(grade|primary|basic [1-6])/.test(normalizedClassName)) return 'primary';
  if (/(jss|junior secondary)/.test(normalizedClassName)) return 'junior-secondary';
  if (/(sss|senior secondary)/.test(normalizedClassName)) return 'senior-secondary';
  return '';
}

function getSectionHeadLabel(classSection?: string) {
  const normalized = normalizeSectionId(classSection);
  if (normalized === 'pre-school') return 'Nursery Head';
  if (normalized === 'primary') return 'Head Teacher';
  if (normalized === 'junior-secondary') return 'Junior School Principal';
  if (normalized === 'senior-secondary') return 'Principal';
  return 'Head of Section';
}

function formatRoleLabel(role: string) {
  const normalized = normalizeRoleName(role);
  if (normalized === 'hos') return 'HOS';
  return role
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function getAllowedSectionRoles(classSection?: string) {
  const normalized = normalizeSectionId(classSection);
  const generic = ['head of section', 'sectional head'];
  if (normalized === 'pre-school') return ['nursery head', ...generic];
  if (normalized === 'primary') return ['head teacher', ...generic];
  if (normalized === 'junior-secondary') return ['junior school principal', 'principal', ...generic];
  if (normalized === 'senior-secondary') return ['principal', ...generic];
  return generic;
}

function resolveSignatureCapability(role: string, classSection?: string) {
  const normalized = normalizeRoleName(role);
  if (normalized === 'hos') {
    return {
      roleLabel: 'HOS' as const,
      activeSignatureKey: 'hos' as const,
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (getAllowedSectionRoles(classSection).includes(normalized)) {
    return {
      roleLabel: formatRoleLabel(role),
      activeSignatureKey: 'headOfSection' as const,
      tone: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  return null;
}

function statusClasses(status: LessonNoteApprovalStatus) {
  if (status === 'Approved') return 'bg-emerald-50 text-emerald-700';
  if (status === 'Head of Section signed' || status === 'HOS signed') return 'bg-amber-50 text-amber-700';
  if (status === 'Submitted') return 'bg-sky-50 text-sky-700';
  return 'bg-slate-100 text-slate-600';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPrintableDocument(document?: ClassroomCreatedDocument | null, summary?: string) {
  if (document?.blocks?.length) {
    return document.blocks.map((block) => {
      if (block.type === 'bullet-list') {
        return `<ul>${(block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
      }

      if (block.type === 'quote') {
        return `<blockquote>${escapeHtml(block.text || '')}</blockquote>`;
      }

      return `<p>${escapeHtml(block.text || '')}</p>`;
    }).join('');
  }

  return `<p>${escapeHtml(summary || 'No printable body added for this lesson note.')}</p>`;
}

function printLessonNote(note: ClassroomNote, schoolName?: string, schoolLogoUrl?: string | null, schoolPrimaryColor?: string) {
  if (typeof window === 'undefined') return;

  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
  if (!printWindow) return;

  const approval = normalizeApproval(note);
  const printableBody = renderPrintableDocument(note.ndoveraDocument, note.summary);
  const brandedSchoolName = schoolName?.trim() || 'School Workspace';
  const brandColor = schoolPrimaryColor?.trim() || '#2a4272';
  const sectionHeadLabel = approval.headOfSection?.roleLabel || getSectionHeadLabel(approval.classSection);
  const schoolInitials = brandedSchoolName.split(/\s+/).filter(Boolean).slice(0, 3).map((token) => token[0]?.toUpperCase() || '').join('') || 'NW';
  const logoMarkup = schoolLogoUrl
    ? `<img src="${escapeHtml(schoolLogoUrl)}" alt="${escapeHtml(brandedSchoolName)} logo" class="logo-image" />`
    : `<div class="logo-fallback">${escapeHtml(schoolInitials)}</div>`;
  const markup = `<!DOCTYPE html>
  <html>
    <head>
      <title>${escapeHtml(note.title)} - Lesson Note</title>
      <style>
        :root { --brand-color: ${brandColor}; }
        body { font-family: Georgia, serif; margin: 32px; color: #0f172a; }
        h1, h2, h3 { margin: 0; }
        .page { border: 1px solid #cbd5e1; border-radius: 24px; overflow: hidden; }
        .header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 24px 28px; background: linear-gradient(135deg, var(--brand-color) 0%, #0f172a 100%); color: white; }
        .logo-shell { display: flex; align-items: center; justify-content: center; width: 74px; height: 74px; border-radius: 20px; background: rgba(255,255,255,0.12); overflow: hidden; }
        .logo-image { width: 100%; height: 100%; object-fit: cover; }
        .logo-fallback { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 24px; font-weight: 700; letter-spacing: 0.12em; }
        .header-copy { flex: 1; }
        .header-kicker { margin-bottom: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.28em; opacity: 0.82; }
        .header-title { font-size: 28px; font-weight: 700; }
        .header-meta { font-size: 13px; opacity: 0.82; }
        .content { padding: 28px; }
        .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }
        .meta-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; }
        .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #64748b; margin-bottom: 6px; }
        .body { margin-top: 28px; border: 1px solid #cbd5e1; border-radius: 16px; padding: 20px; }
        .body p, .body li, .body blockquote { font-size: 15px; line-height: 1.7; }
        blockquote { margin: 0; padding: 14px 18px; border-left: 4px solid #94a3b8; background: #f8fafc; }
        .signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-top: 36px; }
        .signature-card { border: 1px solid #cbd5e1; border-radius: 16px; padding: 16px; min-height: 120px; }
        .line { border-bottom: 1px solid #0f172a; margin-top: 48px; }
        .small { color: #475569; font-size: 13px; }
        .footer { border-top: 1px solid #cbd5e1; padding: 16px 28px 20px; font-size: 12px; color: #475569; display: flex; justify-content: space-between; gap: 16px; }
      </style>
    </head>
    <body>
      <div class="page">
      <div class="header">
        <div class="logo-shell">${logoMarkup}</div>
        <div class="header-copy">
          <div class="header-kicker">Official Lesson Note</div>
          <div class="header-title">${escapeHtml(brandedSchoolName)}</div>
          <div class="header-meta">Formal print release for approved lesson-note circulation</div>
        </div>
      </div>
      <div class="content">
      <h1>${escapeHtml(note.title)}</h1>
      <p class="small">Approved lesson note for print release</p>
      <div class="meta">
        <div class="meta-card"><div class="label">Subject</div><div>${escapeHtml(note.subject)}</div></div>
        <div class="meta-card"><div class="label">Class</div><div>${escapeHtml(approval.className || 'Unassigned class')}</div></div>
        <div class="meta-card"><div class="label">Topic</div><div>${escapeHtml(note.topic)}</div></div>
        <div class="meta-card"><div class="label">Week</div><div>Week ${note.week}</div></div>
        <div class="meta-card"><div class="label">Submitted By</div><div>${escapeHtml(approval.submittedBy || 'Subject Teacher')}</div></div>
        <div class="meta-card"><div class="label">Submitted At</div><div>${escapeHtml(formatDateTime(approval.submittedAt))}</div></div>
      </div>
      <div class="body">
        ${printableBody}
      </div>
      <div class="signatures">
        <div class="signature-card">
          <div class="label">${escapeHtml(sectionHeadLabel)} Signature</div>
          <div>${approval.headOfSection ? escapeHtml(approval.headOfSection.signedBy) : ''}</div>
          <div class="small">${approval.headOfSection ? escapeHtml(formatDateTime(approval.headOfSection.signedAt)) : 'Pending signature'}</div>
          <div class="line"></div>
        </div>
        <div class="signature-card">
          <div class="label">HOS Signature</div>
          <div>${approval.hos ? escapeHtml(approval.hos.signedBy) : ''}</div>
          <div class="small">${approval.hos ? escapeHtml(formatDateTime(approval.hos.signedAt)) : 'Pending signature'}</div>
          <div class="line"></div>
        </div>
      </div>
      </div>
      <div class="footer">
        <div>${escapeHtml(brandedSchoolName)} • Lesson Note Vault</div>
        <div>Printed ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
      </div>
      </div>
      <script>
        window.onload = function () { window.print(); };
      </script>
    </body>
  </html>`;

  printWindow.document.open();
  printWindow.document.write(markup);
  printWindow.document.close();
}

function hexToRgba(hex: string, alpha: number) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((part) => `${part}${part}`).join('') : raw.padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildMaterialSurface(format: string) {
  const normalized = format.toLowerCase();
  const base = '#2a4272';
  const accent = normalized.includes('video')
    ? '#fb7185'
    : normalized.includes('audio')
      ? '#10b981'
      : normalized.includes('image')
        ? '#f59e0b'
        : '#38bdf8';

  return {
    backgroundImage: [
      `radial-gradient(circle at top right, ${hexToRgba(accent, 0.18)} 0%, transparent 34%)`,
      `radial-gradient(circle at bottom left, ${hexToRgba(accent, 0.12)} 0%, transparent 30%)`,
      `linear-gradient(145deg, ${hexToRgba(base, 0.98)} 0%, ${hexToRgba(base, 0.96)} 54%, ${hexToRgba(base, 0.98)} 100%)`,
      `linear-gradient(135deg, transparent 0%, transparent 56%, ${hexToRgba(accent, 0.08)} 56%, ${hexToRgba(accent, 0.08)} 60%, transparent 60%, transparent 100%)`,
      `linear-gradient(45deg, transparent 0%, transparent 74%, ${hexToRgba(accent, 0.06)} 74%, ${hexToRgba(accent, 0.06)} 78%, transparent 78%, transparent 100%)`,
    ].join(', '),
    backgroundSize: 'auto, auto, auto, 180px 180px, 130px 130px',
    backgroundPosition: 'top right, bottom left, center, center, center',
    borderColor: hexToRgba(accent, 0.18),
  };
}

export function LessonNotesWorkspace({ role, currentUserName = '', selectedClassName = '', selectedClassSection = '', schoolName, schoolLogoUrl, schoolPrimaryColor }: LessonNotesWorkspaceProps) {
  const teacherView = role === 'Teacher' || role === 'School Admin' || role === 'HOS' || role === 'Super Admin';
  const { data, refetch, loading } = useData<ClassroomNote[]>('/api/classroom/notes');
  const [sessionNotes, setSessionNotes] = useState<ClassroomNote[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const sourceNotes = useMemo(() => Array.isArray(data) ? data : [], [data]);
  const notes = useMemo(() => mergeNotes(sourceNotes, sessionNotes), [sessionNotes, sourceNotes]);
  const visibleNotes = teacherView ? notes : notes.filter((note) => note.visibility !== 'Teacher-only');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const selectedNote = useMemo(
    () => visibleNotes.find((note) => note.id === selectedNoteId) || null,
    [selectedNoteId, visibleNotes],
  );
  const selectedApproval = selectedNote ? normalizeApproval(selectedNote) : null;
  const signatureCapability = useMemo(
    () => resolveSignatureCapability(role, selectedApproval?.classSection || selectedClassSection),
    [role, selectedApproval?.classSection, selectedClassSection],
  );
  const sectionHeadLabel = selectedApproval?.headOfSection?.roleLabel || getSectionHeadLabel(selectedApproval?.classSection || selectedClassSection);

  const vaultNotes = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter((note) => [note.title, note.subject, note.topic, note.className || '', note.approval?.submittedBy || ''].some((value) => value.toLowerCase().includes(query)));
  }, [notes, searchValue]);

  const vaultStats = useMemo(() => {
    const approved = notes.filter((note) => normalizeApproval(note).status === 'Approved').length;
    const pending = notes.length - approved;
    const classes = new Set(notes.map((note) => normalizeApproval(note).className || 'Unassigned class')).size;
    const subjects = new Set(notes.map((note) => note.subject)).size;
    return { approved, pending, classes, subjects };
  }, [notes]);

  const upsertSessionNote = (note: ClassroomNote) => {
    const normalized = normalizeNote(note);
    setSessionNotes((current) => {
      const next = [...current];
      const existingIndex = next.findIndex((entry) => entry.id === normalized.id);
      if (existingIndex >= 0) next[existingIndex] = normalized;
      else next.unshift(normalized);
      return next;
    });
    setSelectedNoteId(normalized.id);
  };

  const signSelectedNote = async () => {
    if (!selectedNote) return;
    setSigning(true);
    setActionError(null);
    try {
      const result = await applyLessonNoteSignature(selectedNote.id);
      upsertSessionNote(result.note);
      void refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to sign this lesson note right now.');
    } finally {
      setSigning(false);
    }
  };

  const printable = !!(selectedApproval?.headOfSection && selectedApproval?.hos);

  return (
    <div className="space-y-6">
      {teacherView ? (
        <ClassroomMaterialComposer
          defaultClassName={selectedClassName}
          defaultClassSection={selectedClassSection}
          currentRole={role}
          currentUserName={currentUserName}
          onCreated={upsertSessionNote}
          onSaved={refetch}
          submitLabel="Submit lesson note"
        />
      ) : null}

      {teacherView ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-950">Lesson note vault</p>
              <p className="mt-1 text-sm text-slate-500">View every submitted lesson note by class, subject, teacher, and approval state at a glance.</p>
            </div>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Search class, subject, topic, or teacher" className="w-72 bg-transparent text-slate-700 outline-none" />
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Classes</p><p className="mt-2 text-2xl font-bold text-slate-950">{vaultStats.classes}</p></div>
            <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Subjects</p><p className="mt-2 text-2xl font-bold text-slate-950">{vaultStats.subjects}</p></div>
            <div className="rounded-3xl bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700">Approved</p><p className="mt-2 text-2xl font-bold text-emerald-800">{vaultStats.approved}</p></div>
            <div className="rounded-3xl bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700">Pending</p><p className="mt-2 text-2xl font-bold text-amber-800">{vaultStats.pending}</p></div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Lesson Note</th>
                  <th className="px-4 py-3">Submitted By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Signatures</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {vaultNotes.map((note) => {
                  const approval = normalizeApproval(note);
                  return (
                    <tr key={note.id} className="text-slate-600">
                      <td className="px-4 py-3 font-semibold text-slate-900">{approval.className}</td>
                      <td className="px-4 py-3">{note.subject}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{note.title}</p>
                        <p className="text-xs text-slate-500">Week {note.week} • {note.topic}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{approval.submittedBy || 'Subject Teacher'}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(approval.submittedAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(approval.status)}`}>{approval.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div>{approval.headOfSection ? `${approval.headOfSection.roleLabel}: ${approval.headOfSection.signedBy}` : `${getSectionHeadLabel(approval.classSection)}: Pending`}</div>
                        <div>{approval.hos ? `HOS: ${approval.hos.signedBy}` : 'HOS: Pending'}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => setSelectedNoteId(note.id)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                          <FileStack className="h-3.5 w-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">Loading lesson notes…</div> : null}

      {selectedNote ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <button type="button" onClick={() => setSelectedNoteId(null)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            <ArrowLeft className="h-4 w-4" />
            Back to note cards
          </button>

          <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{selectedNote.subject}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{selectedApproval?.className || 'Unassigned class'}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Week {selectedNote.week}</span>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{selectedNote.format}</span>
                {selectedApproval ? <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(selectedApproval.status)}`}>{selectedApproval.status}</span> : null}
                {selectedNote.viewerType ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{selectedNote.viewerType}</span> : null}
              </div>
              <h3 className="mt-3 text-2xl font-semibold text-slate-900">{selectedNote.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{selectedNote.topic} • {selectedNote.duration}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {signatureCapability ? (
                <button type="button" onClick={() => void signSelectedNote()} disabled={signing || (signatureCapability.activeSignatureKey === 'hos' && !selectedApproval?.headOfSection)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${signatureCapability.tone}`}>
                  {signatureCapability.activeSignatureKey === 'hos' ? <CheckCheck className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {signing ? 'Applying signature…' : signatureCapability.activeSignatureKey === 'hos' && !selectedApproval?.headOfSection ? 'Await sectional head signature' : `Apply ${signatureCapability.roleLabel} signature`}
                </button>
              ) : null}
              <button type="button" onClick={() => printLessonNote(selectedNote, schoolName, schoolLogoUrl, schoolPrimaryColor)} disabled={!printable} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Printer className="h-4 w-4" />
                Print approved note
              </button>
            </div>
          </div>

          {actionError ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</p> : null}

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Submitted</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{selectedApproval?.submittedBy || 'Subject Teacher'}</p>
              <p className="mt-1 text-sm text-slate-500">{formatDateTime(selectedApproval?.submittedAt)}</p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700">{sectionHeadLabel}</p>
              <p className="mt-2 text-sm font-semibold text-amber-900">{selectedApproval?.headOfSection?.signedBy || 'Pending signature'}</p>
              <p className="mt-1 text-sm text-amber-800/80">{formatDateTime(selectedApproval?.headOfSection?.signedAt)}</p>
            </div>
            <div className="rounded-3xl bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700">HOS</p>
              <p className="mt-2 text-sm font-semibold text-emerald-900">{selectedApproval?.hos?.signedBy || 'Pending signature'}</p>
              <p className="mt-1 text-sm text-emerald-800/80">{formatDateTime(selectedApproval?.hos?.signedAt)}</p>
            </div>
          </div>

          {!printable ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">The lesson note becomes printable after both the {sectionHeadLabel} and HOS signatures are present.</p> : null}

          <div className="mt-6 space-y-4">
            <ClassroomMaterialViewer note={selectedNote} />

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Analytics</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-slate-50 px-3 py-3"><p className="font-semibold text-slate-900">Views</p><p>{selectedNote.analytics.views}</p></div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3"><p className="font-semibold text-slate-900">Downloads</p><p>{selectedNote.analytics.downloads}</p></div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3"><p className="font-semibold text-slate-900">Completion</p><p>{selectedNote.analytics.completion}</p></div>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Study summary</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{selectedNote.summary}</p>
            </div>
          </div>
        </section>
      ) : (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleNotes.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => setSelectedNoteId(note.id)}
            className="overflow-hidden rounded-3xl border bg-white p-6 text-left shadow-sm transition hover:border-sky-200"
            style={buildMaterialSurface(note.format)}
          >
            <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1 overflow-hidden rounded-[1.6rem] border border-amber-200/18 bg-[linear-gradient(180deg,rgba(12,22,52,0.26)_0%,rgba(18,31,70,0.36)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-amber-300/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.18)_0%,rgba(180,83,9,0.24)_100%)] px-3 py-1 text-xs font-semibold text-yellow-100">{note.subject}</span>
                  <span className="rounded-full border border-emerald-300/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.18)_0%,rgba(5,150,105,0.24)_100%)] px-3 py-1 text-xs font-semibold text-emerald-100">{normalizeApproval(note).className}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Week {note.week}</span>
                  <span className="rounded-full border border-orange-300/20 bg-[linear-gradient(180deg,rgba(249,115,22,0.18)_0%,rgba(194,65,12,0.24)_100%)] px-3 py-1 text-xs font-semibold text-orange-100">{note.format}</span>
                  <span className="rounded-full border border-amber-900/30 bg-[linear-gradient(180deg,rgba(120,53,15,0.3)_0%,rgba(92,39,12,0.42)_100%)] px-3 py-1 text-xs font-semibold text-amber-100">{note.visibility}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(normalizeApproval(note).status)}`}>{normalizeApproval(note).status}</span>
                  {note.viewerType ? <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-sky-100">{note.viewerType}</span> : null}
                </div>
                <h3 className="mt-3 line-clamp-2 wrap-break-word text-xl font-semibold text-white">{note.title}</h3>
                <p className="mt-2 truncate text-sm font-semibold text-amber-300">{note.topic} • {note.duration}</p>
                <p className="mt-4 line-clamp-4 wrap-break-word text-sm leading-7 text-orange-100/92">{note.summary}</p>
              </div>

              <div className="grid shrink-0 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.18)_0%,rgba(180,83,9,0.24)_100%)] px-4 py-3 text-sm text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <p className="font-semibold text-yellow-100">Views</p>
                  <p className="font-extrabold text-yellow-300">{note.analytics.views}</p>
                </div>
                <div className="rounded-2xl border border-orange-300/20 bg-[linear-gradient(180deg,rgba(249,115,22,0.18)_0%,rgba(194,65,12,0.24)_100%)] px-4 py-3 text-sm text-orange-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <p className="font-semibold text-amber-50">Downloads</p>
                  <p className="font-extrabold text-orange-300">{note.analytics.downloads}</p>
                </div>
                <div className="rounded-2xl border border-amber-900/30 bg-[linear-gradient(180deg,rgba(120,53,15,0.3)_0%,rgba(92,39,12,0.42)_100%)] px-4 py-3 text-sm text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <p className="font-semibold text-orange-100">Completion</p>
                  <p className="font-extrabold text-amber-200">{note.analytics.completion}</p>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
