import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { getApiBase } from '../../../config/apiBase';
import MaterialViewer from '../../classroom/materials/MaterialViewer';
import Flipbook from '../../classroom/materials/Flipbook';

function normalizeBrandColor(value, fallback) {
  const color = String(value || '').trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback;
}

function resolveRecordBranding(record = null) {
  const source = record?.payload?.branding && typeof record.payload.branding === 'object'
    ? record.payload.branding
    : (record?.payload?.settingsSnapshot?.metadata?.branding && typeof record.payload.settingsSnapshot.metadata.branding === 'object'
        ? record.payload.settingsSnapshot.metadata.branding
        : {});

  return {
    schoolName: String(source.schoolName || '').trim(),
    reportTitle: String(source.reportTitle || 'Official Result Record').trim() || 'Official Result Record',
    logoUrl: String(source.logoUrl || '').trim(),
    primaryColor: normalizeBrandColor(source.primaryColor, '#800000'),
    accentColor: normalizeBrandColor(source.accentColor, '#1a5c38'),
  };
}

function resolveRecordScoreModel(record = null) {
  const payloadModel = record?.payload?.scoreModel && typeof record.payload.scoreModel === 'object' ? record.payload.scoreModel : {};
  const metadata = record?.payload?.settingsSnapshot?.metadata && typeof record.payload.settingsSnapshot.metadata === 'object'
    ? record.payload.settingsSnapshot.metadata
    : {};
  const configuredCa = Number(payloadModel.caMaxScore ?? metadata.caMaxScore);
  const configuredExam = Number(payloadModel.examMaxScore ?? metadata.examMaxScore);
  const caMaxScore = Number.isFinite(configuredCa) && configuredCa > 0 ? Math.max(1, Math.min(99, configuredCa)) : 40;
  const examMaxScore = Number.isFinite(configuredExam) && configuredExam > 0 ? Math.max(1, Math.min(99, configuredExam)) : 60;

  return {
    caMaxScore,
    examMaxScore,
    totalMaxScore: caMaxScore + examMaxScore,
  };
}

// Group every uploaded result PDF by session + term so they always show — even when the school
// only uploaded PDFs and never published a CA-score record (the common bulk-upload case).
function groupDocumentsByPeriod(documents = []) {
  const groups = new Map();
  (Array.isArray(documents) ? documents : []).forEach(document => {
    const sessionName = String(document?.sessionName || '').trim() || 'Session';
    const termName = String(document?.termName || '').trim() || 'Term';
    const key = `${sessionName}::${termName}`;
    if (!groups.has(key)) groups.set(key, { sessionName, termName, items: [] });
    groups.get(key).items.push(document);
  });
  return Array.from(groups.values()).sort((left, right) => `${right.sessionName} ${right.termName}`.localeCompare(`${left.sessionName} ${left.termName}`));
}

function buildVerificationLabel(url) {
  if (!url) return '';
  return url.length > 72 ? `${url.slice(0, 69)}...` : url;
}

function resolvePublicVerificationOrigin() {
  if (typeof window === 'undefined') return '';

  try {
    return new URL(getApiBase('/api'), window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export default function ResultRecordViewer({
  students = [],
  activeStudentId = '',
  onSelectStudent = () => {},
  records = [],
  selectedRecordId = '',
  onSelectRecord = () => {},
  documents = [],
  lockedByFees = false,
  feeStatus = '',
  emptyMessage = 'No published result records are available yet.',
  canManageDocuments = false,
  onDeleteDocument = null,
}) {
  const selectedRecord = records.find(record => record.id === selectedRecordId) || records[0] || null;
  const summary = selectedRecord?.summary || {};
  const documentGroups = useMemo(() => groupDocumentsByPeriod(documents), [documents]);
  const branding = resolveRecordBranding(selectedRecord);
  const scoreModel = resolveRecordScoreModel(selectedRecord);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [activeDocument, setActiveDocument] = useState(null);
  const [previewDocId, setPreviewDocId] = useState('');
  const [deletingId, setDeletingId] = useState('');

  // Default the inline flipbook to the most recent uploaded document.
  useEffect(() => {
    if (!documents.length) { setPreviewDocId(''); return; }
    setPreviewDocId(current => (documents.some(doc => doc.id === current) ? current : documents[0].id));
  }, [documents]);

  async function handleDeleteDocument(document) {
    if (!onDeleteDocument) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${document.fileName}"? This removes the uploaded result for this term.`)) return;
    setDeletingId(document.id);
    try {
      await onDeleteDocument(document.id);
    } finally {
      setDeletingId('');
    }
  }

  const verificationUrl = useMemo(() => {
    const existingUrl = String(selectedRecord?.verificationUrl || '').trim();
    if (existingUrl) return existingUrl;
    if (typeof window === 'undefined' || !selectedRecord?.id) return '';
    return `${resolvePublicVerificationOrigin()}/result-verification/${encodeURIComponent(String(selectedRecord.id || ''))}`;
  }, [selectedRecord?.id, selectedRecord?.verificationUrl]);

  useEffect(() => {
    let cancelled = false;

    if (!verificationUrl) {
      setQrDataUrl('');
      return undefined;
    }

    QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 220,
      color: { dark: '#800000', light: '#b5e3f4' },
    }).then(url => {
      if (!cancelled) setQrDataUrl(url);
    }).catch(() => {
      if (!cancelled) setQrDataUrl('');
    });

    return () => {
      cancelled = true;
    };
  }, [verificationUrl]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
          }

          .result-record-print-hide {
            display: none !important;
          }

          .result-record-print-page {
            padding: 0 !important;
            gap: 1rem !important;
          }

          .result-record-print-surface {
            background: #ffffff !important;
            border: 1px solid rgba(15, 23, 42, 0.12) !important;
            box-shadow: none !important;
            break-inside: avoid;
          }

          .result-record-print-link {
            color: #0f172a !important;
            text-decoration: none !important;
          }

          .result-record-print-gradient {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .result-record-print-qr-wrap {
            width: min(58vw, 420px) !important;
            height: min(58vw, 420px) !important;
          }
        }
      `}</style>
      {students.length > 1 && (
        <div className="result-record-print-hide flex flex-wrap gap-2">
          {students.map(student => (
            <button
              key={student.id}
              type="button"
              onClick={() => onSelectStudent(student.id)}
              className={activeStudentId === student.id
                ? 'px-4 py-2 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white'
                : 'px-4 py-2 rounded-2xl bg-white/70 dark:bg-slate-900/30 border border-[#c9a96e]/35 dark:border-white/10 text-[#191970] dark:text-slate-200'}
            >
              {student.name}
            </button>
          ))}
        </div>
      )}

      {lockedByFees && (
        <section className="border border-[#c9a96e]/45 bg-[#fff8f0] shadow-sm dark:border-white/10 dark:bg-slate-900/40 rounded-3xl p-6">
          <p className="text-[#191970] dark:text-slate-200">Result access is locked because the current fee status is {feeStatus || 'unpaid'}.</p>
          <p className="micro-label mt-3 accent-rose">State: Locked by fees</p>
        </section>
      )}

      {!lockedByFees && records.length === 0 && documents.length === 0 && (
        <section className="border border-[#c9a96e]/45 bg-[#fff8f0] shadow-sm dark:border-white/10 dark:bg-slate-900/40 rounded-3xl p-6">
          <p className="micro-label accent-amber">No published records</p>
          <p className="mt-2 text-[#191970] dark:text-slate-200">{emptyMessage}</p>
        </section>
      )}

      {!lockedByFees && records.length > 0 && selectedRecord && (
        <>
          <div className="result-record-print-hide flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
            {records.map(record => (
              <button
                key={record.id}
                type="button"
                onClick={() => onSelectRecord(record.id)}
                className={selectedRecord.id === record.id
                  ? 'px-4 py-2 rounded-2xl bg-emerald-500/30 border border-emerald-300/40 text-white'
                  : 'px-4 py-2 rounded-2xl bg-white/70 dark:bg-slate-900/30 border border-[#c9a96e]/35 dark:border-white/10 text-[#191970] dark:text-slate-200'}
              >
                {record.label}
              </button>
            ))}
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-2xl text-sm font-bold text-white border"
              style={{
                backgroundColor: branding.accentColor,
                borderColor: branding.primaryColor,
              }}
            >
              Print / Save PDF
            </button>
          </div>

          <section
            className="result-record-print-gradient result-record-print-surface rounded-3xl p-6 border border-[#c9a96e]/35 dark:border-white/10 overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.accentColor} 100%)`,
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {branding.logoUrl && (
                  <img
                    src={branding.logoUrl}
                    alt={branding.schoolName || 'School logo'}
                    className="h-16 w-16 rounded-2xl object-contain border border-white/20 bg-white/10 p-2"
                  />
                )}
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/75">{branding.schoolName || 'Official School Result'}</p>
                  <h2 className="text-2xl command-title text-white mt-2">{branding.reportTitle}</h2>
                  <p className="text-sm text-white/80 mt-2">{selectedRecord.termName || 'Term'} • {selectedRecord.sessionName || 'Session'}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 min-w-[180px]">
                <p className="text-xs uppercase tracking-[0.24em] text-white/70">Template</p>
                <p className="text-sm font-semibold text-white mt-1">{selectedRecord.payload?.templateKey || 'Configured template'}</p>
              </div>
            </div>
          </section>

          <section className="result-record-print-page grid grid-cols-1 gap-4">
          <section className="result-record-print-surface border border-[#c9a96e]/45 bg-[#fff8f0] shadow-sm dark:border-white/10 dark:bg-slate-900/40 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><p className="micro-label accent-indigo">Student</p><p className="text-[#191970] dark:text-slate-100 font-semibold mt-1">{selectedRecord.student?.name || 'Unavailable'}</p></div>
            <div><p className="micro-label accent-emerald">Average</p><p className="text-[#191970] dark:text-slate-100 font-semibold mt-1">{summary.average || 0}%</p></div>
            <div><p className="micro-label accent-amber">Grade</p><p className="text-[#191970] dark:text-slate-100 font-semibold mt-1">{summary.grade || '—'}</p></div>
            <div><p className="micro-label accent-rose">Attendance</p><p className="text-[#191970] dark:text-slate-100 font-semibold mt-1">{summary.attendanceRate || 0}%</p></div>
          </section>

          <section className="result-record-print-surface border border-[#c9a96e]/45 bg-[#fff8f0] shadow-sm dark:border-white/10 dark:bg-slate-900/40 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="micro-label accent-indigo">Promotion Status</p>
              <p className="text-[#191970] dark:text-slate-100 font-semibold mt-1">{summary.promotionStatus || 'Pending'}</p>
              <p className="text-xs text-[#6b5836] dark:text-slate-300 mt-3">Position: {summary.position || '—'} of {summary.classSize || '—'}</p>
            </div>
            <div>
              <p className="micro-label accent-amber">Approval Trail</p>
              <p className="text-[#191970] dark:text-slate-100 text-sm mt-1">Published: {selectedRecord.publishedAt ? new Date(selectedRecord.publishedAt).toLocaleString() : '—'}</p>
              <p className="text-[#6b5836] dark:text-slate-300 text-sm mt-2">Approved by: {selectedRecord.payload?.approvals?.approvedBy || 'HoS / Owner'}</p>
            </div>
          </section>

          {qrDataUrl ? (
            <section className="result-record-print-surface rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-6 text-center text-[#191970] shadow-[0_18px_42px_rgba(128,0,0,0.12)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:text-[#39ff14]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Result Verification QR</p>
              <h3 className="mt-2 text-2xl font-black text-[#800000] dark:text-white">Scan To Verify This Published Result</h3>
              <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">The QR code is centered for printing so the full code remains clear on paper and PDF exports.</p>
              <div className="result-record-print-qr-wrap mx-auto mt-6 flex h-[300px] w-[300px] items-center justify-center rounded-[32px] border border-[#c9a96e]/40 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/30 dark:bg-black/25">
                <img src={qrDataUrl} alt="Result verification QR code" className="h-full w-full rounded-3xl object-contain" />
              </div>
              <p className="mt-3 text-sm font-bold text-[#800000] dark:text-white">Public verification page</p>
              <p className="mt-2 break-all text-[11px] font-semibold text-[#800020] dark:text-[#bf00ff]">{buildVerificationLabel(verificationUrl)}</p>
            </section>
          ) : null}

          <div className="result-record-print-surface border border-[#c9a96e]/45 bg-[#fff8f0] shadow-sm dark:border-white/10 dark:bg-slate-900/40 rounded-3xl p-6 overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead>
                <tr className="text-left">
                  <th className="micro-label py-2 pr-4">Subject</th>
                  <th className="micro-label py-2 pr-4">CA ({scoreModel.caMaxScore})</th>
                  <th className="micro-label py-2 pr-4">Exam ({scoreModel.examMaxScore})</th>
                  <th className="micro-label py-2 pr-4">Total ({scoreModel.totalMaxScore})</th>
                  <th className="micro-label py-2 pr-4">Grade</th>
                  <th className="micro-label py-2">Remark</th>
                </tr>
              </thead>
              <tbody>
                {selectedRecord.subjects.map(row => (
                  <tr key={`${selectedRecord.id}-${row.subjectId || row.subjectName}`} className="border-t border-[#c9a96e]/35 dark:border-white/10">
                    <td className="py-3 pr-4 text-[#191970] dark:text-slate-100">{row.subjectName}</td>
                    <td className="py-3 pr-4 mono-metric">{row.caScore}</td>
                    <td className="py-3 pr-4 mono-metric">{row.examScore}</td>
                    <td className="py-3 pr-4 mono-metric">{row.total}</td>
                    <td className="py-3 pr-4 command-title accent-emerald">{row.grade}</td>
                    <td className="py-3 text-[#6b5836] dark:text-slate-300">{row.remark || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(selectedRecord.affective.length > 0 || selectedRecord.ratings.length > 0) && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {selectedRecord.affective.length > 0 && (
                <div className="result-record-print-surface border border-[#c9a96e]/45 bg-[#fff8f0] shadow-sm dark:border-white/10 dark:bg-slate-900/40 rounded-3xl p-6">
                  <h2 className="text-lg command-title neon-title mb-4">Affective Areas</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedRecord.affective.map(item => (
                      <div key={`${selectedRecord.id}-${item.key}`} className="rounded-2xl border border-[#c9a96e]/35 dark:border-white/10 bg-white/70 dark:bg-slate-900/20 p-4">
                        <p className="micro-label accent-indigo">{item.label}</p>
                        <p className="text-[#191970] dark:text-slate-100 font-semibold mt-1">{item.score || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecord.ratings.length > 0 && (
                <div className="result-record-print-surface border border-[#c9a96e]/45 bg-[#fff8f0] shadow-sm dark:border-white/10 dark:bg-slate-900/40 rounded-3xl p-6">
                  <h2 className="text-lg command-title neon-title mb-4">Ratings</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedRecord.ratings.map(item => (
                      <div key={`${selectedRecord.id}-${item.key}`} className="rounded-2xl border border-[#c9a96e]/35 dark:border-white/10 bg-white/70 dark:bg-slate-900/20 p-4">
                        <p className="micro-label accent-amber">{item.label}</p>
                        <p className="text-[#191970] dark:text-slate-100 font-semibold mt-1">{item.score || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="result-record-print-surface border border-[#c9a96e]/45 bg-[#fff8f0] shadow-sm dark:border-white/10 dark:bg-slate-900/40 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="micro-label accent-indigo">Teacher Remark</p>
              <p className="text-[#191970] dark:text-slate-200 mt-2">{summary.teacherRemark || 'No teacher remark yet.'}</p>
            </div>
            <div>
              <p className="micro-label accent-amber">Principal Remark</p>
              <p className="text-[#191970] dark:text-slate-200 mt-2">{summary.principalRemark || 'No principal remark yet.'}</p>
            </div>
          </section>
          </section>
        </>
      )}

      {/* Uploaded result PDFs always show (grouped by term), even when no CA record was published. */}
      {!lockedByFees && documents.length > 0 && (
        <section className="result-record-print-hide rounded-3xl border border-[#c9a96e]/45 bg-[#fff8f0] p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/40 md:p-6">
          <h2 className="mb-1 text-lg command-title text-[#800000] dark:text-white dark:neon-title">Uploaded Result Documents</h2>
          <p className="mb-4 text-xs text-[#6b5836] dark:text-slate-300">Read each result as a flipbook, open it fullscreen, or download it.</p>
          <div className="space-y-6">
            {documentGroups.map(group => (
              <div key={`${group.sessionName}::${group.termName}`}>
                <p className="mb-2 micro-label accent-indigo text-[#800020] dark:text-[#bf00ff]">{group.termName} • {group.sessionName}</p>
                <div className="space-y-4">
                  {group.items.map(document => {
                    const isActive = previewDocId === document.id;
                    return (
                      <div key={document.id} className="overflow-hidden rounded-2xl border border-[#c9a96e]/45 bg-white/85 dark:border-white/10 dark:bg-slate-900/30">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c9a96e]/35 px-4 py-3 dark:border-white/10">
                          <p className="min-w-0 flex-1 truncate text-sm font-bold text-[#191970] dark:text-white">{document.fileName}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => setActiveDocument(document)} className="rounded-xl bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-black">
                              Open fullscreen
                            </button>
                            <a href={document.fileUrl} download={document.fileName} target="_blank" rel="noreferrer" className="rounded-xl border border-[#c9a96e]/50 px-3 py-1.5 text-xs font-bold text-[#800020] transition hover:bg-white dark:border-white/15 dark:text-slate-100">
                              Download
                            </a>
                            {canManageDocuments && onDeleteDocument ? (
                              <button type="button" onClick={() => handleDeleteDocument(document)} disabled={deletingId === document.id} className="rounded-xl border border-rose-400/50 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-500/10">
                                {deletingId === document.id ? 'Deleting…' : 'Delete'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="h-[62vh] min-h-[360px] w-full bg-[#e9dcc0] dark:bg-slate-950">
                          {isActive ? (
                            <Flipbook url={document.fileUrl} onFallback={() => setActiveDocument(document)} />
                          ) : (
                            <button type="button" onClick={() => setPreviewDocId(document.id)} className="flex h-full w-full items-center justify-center text-sm font-bold text-[#800020] transition hover:bg-[#e0d0ad] dark:text-slate-200 dark:hover:bg-slate-900">
                              ▦ Show flipbook preview
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeDocument ? (
        <MaterialViewer
          material={{
            id: activeDocument.id,
            url: activeDocument.fileUrl,
            title: activeDocument.fileName,
            fileName: activeDocument.fileName,
            type: 'pdf',
            subjectName: `${activeDocument.termName || 'Term'} • ${activeDocument.sessionName || 'Session'}`,
          }}
          onClose={() => setActiveDocument(null)}
        />
      ) : null}
    </div>
  );
}