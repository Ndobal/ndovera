import React, { useEffect, useState } from 'react';
import {
  RESULT_BODY,
  RESULT_BUTTON,
  RESULT_HEADING,
  RESULT_INPUT,
  RESULT_INNER_SURFACE,
  RESULT_LABEL,
  RESULT_SECONDARY_BUTTON,
  RESULT_SURFACE,
} from './resultSheetTheme';

function normalizeDomainKey(label, index) {
  return String(label || `Domain ${index + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `domain_${index + 1}`;
}

function toLines(entries = [], mode = 'grading') {
  return (Array.isArray(entries) ? entries : []).map(entry => {
    if (mode === 'grading') return `${entry.minScore || 0}|${entry.grade || ''}|${entry.remark || ''}`;
    return `${entry.value || 0}|${entry.label || ''}`;
  }).join('\n');
}

function toDomainText(entries = []) {
  return (Array.isArray(entries) ? entries : []).map(entry => entry.label || entry.key || '').filter(Boolean).join(', ');
}

function toCaComponentLines(entries = []) {
  return (Array.isArray(entries) ? entries : []).map(entry => `${entry.maxScore || 0}|${entry.label || ''}`).join('\n');
}

function parseLines(text = '', mode = 'grading') {
  return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const [first = '', second = '', third = ''] = line.split('|').map(part => part.trim());
    if (mode === 'grading') return { minScore: Number(first || 0), grade: second, remark: third };
    return { value: Number(first || 0), label: second };
  }).filter(entry => (mode === 'grading' ? entry.grade : entry.label));
}

function parseDomains(text = '') {
  return String(text || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((label, index) => ({ key: normalizeDomainKey(label, index), label }));
}

function parseCaComponentLines(text = '') {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [first = '', second = ''] = line.split('|').map(part => part.trim());
      return {
        key: normalizeDomainKey(second, index),
        label: second || `CA ${index + 1}`,
        maxScore: Number(first || 0),
      };
    })
    .filter(entry => entry.label && Number(entry.maxScore || 0) > 0);
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function buildTemplatePreviewHtml(template = {}, branding = {}) {
  const strengths = Array.isArray(template?.preview?.strengths) ? template.preview.strengths : [];
  const schoolName = String(branding.schoolName || 'School Result Office').trim() || 'School Result Office';
  const reportTitle = String(branding.reportTitle || template?.name || 'Result Template Preview').trim() || 'Result Template Preview';
  const primaryColor = String(branding.primaryColor || '#800000').trim() || '#800000';
  const accentColor = String(branding.accentColor || '#1a5c38').trim() || '#1a5c38';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${template?.name || 'Result Template'} Preview</title>
    <style>
      body { font-family: Georgia, "Times New Roman", serif; margin: 0; padding: 32px; background: #fdf7ec; color: #191970; }
      .sheet { max-width: 900px; margin: 0 auto; border: 1px solid rgba(128, 0, 0, 0.18); border-radius: 24px; overflow: hidden; background: #fffaf0; }
      .hero { padding: 28px 32px; color: #ffffff; background: linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%); }
      .hero p { margin: 0; opacity: 0.85; letter-spacing: 0.14em; text-transform: uppercase; font-size: 12px; }
      .hero h1 { margin: 12px 0 0; font-size: 32px; }
      .content { padding: 28px 32px 32px; }
      .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
      .card { border: 1px solid rgba(128, 0, 0, 0.16); border-radius: 18px; padding: 16px; background: #fff; }
      .card p { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #800020; }
      .card strong { display: block; margin-top: 8px; font-size: 24px; color: #191970; }
      h2 { margin: 0 0 12px; color: #800000; }
      ul { margin: 0; padding-left: 20px; }
      li + li { margin-top: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { padding: 12px; border-bottom: 1px solid rgba(25, 25, 112, 0.12); text-align: left; }
      th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #800020; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="hero">
        <p>${schoolName}</p>
        <h1>${reportTitle}</h1>
      </div>
      <div class="content">
        <div class="summary">
          <div class="card"><p>Template</p><strong>${template?.name || 'Configured Template'}</strong></div>
          <div class="card"><p>Mood</p><strong>${template?.preview?.mood || 'Official'}</strong></div>
          <div class="card"><p>Use Case</p><strong>${template?.description || 'Published result records'}</strong></div>
        </div>
        <h2>Preview Highlights</h2>
        <ul>
          ${strengths.map(item => `<li>${item}</li>`).join('') || '<li>Structured subject table</li><li>Summary header</li><li>Approval and remark space</li>'}
        </ul>
        <h2 style="margin-top: 28px;">Sample Result Layout</h2>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>CA</th>
              <th>Exam</th>
              <th>Total</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Mathematics</td>
              <td>32</td>
              <td>58</td>
              <td>90</td>
              <td>A</td>
            </tr>
            <tr>
              <td>English Language</td>
              <td>28</td>
              <td>54</td>
              <td>82</td>
              <td>B+</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </body>
</html>`;
}

function downloadTemplatePreview(template = {}, branding = {}) {
  if (!template?.key || typeof window === 'undefined') return;

  const blob = new Blob([buildTemplatePreviewHtml(template, branding)], { type: 'text/html;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${template.key}-preview.html`;
  link.click();
  window.URL.revokeObjectURL(url);
}

function buildFormState(settings = {}, suggestedSettings = {}) {
  const source = settings?.templateKey || settings?.updatedAt ? settings : suggestedSettings;
  const branding = source?.metadata?.branding || suggestedSettings?.metadata?.branding || {};
  return {
    templateKey: source?.templateKey || '',
    gradingScaleText: toLines(source?.gradingScale || suggestedSettings?.gradingScale || [], 'grading'),
    ratingScaleText: toLines(source?.ratingScale || suggestedSettings?.ratingScale || [], 'value'),
    affectiveScaleText: toLines(source?.affectiveScale || suggestedSettings?.affectiveScale || [], 'value'),
    affectiveDomainsText: toDomainText(source?.affectiveDomains || suggestedSettings?.affectiveDomains || []),
    ratingDomainsText: toDomainText(source?.metadata?.ratingDomains || suggestedSettings?.metadata?.ratingDomains || []),
    caComponentsText: toCaComponentLines(source?.metadata?.caComponents || suggestedSettings?.metadata?.caComponents || []),
    caMaxScore: source?.metadata?.caMaxScore ?? suggestedSettings?.metadata?.caMaxScore ?? 40,
    examMaxScore: source?.metadata?.examMaxScore ?? suggestedSettings?.metadata?.examMaxScore ?? 60,
    affectiveWriteUp: source?.metadata?.affectiveWriteUp || suggestedSettings?.metadata?.affectiveWriteUp || '',
    brandingSchoolName: branding.schoolName || '',
    brandingReportTitle: branding.reportTitle || '',
    brandingLogoUrl: branding.logoUrl || '',
    brandingPrimaryColor: branding.primaryColor || '#800000',
    brandingAccentColor: branding.accentColor || '#1a5c38',
  };
}

// Kid-friendly editor: each entry is a labeled row with add/remove buttons,
// instead of pipe-delimited text. Rows serialize back to the same text the
// save logic already understands, so nothing downstream changes.
function RowEditor({ title, help, rows, columns, addLabel, emptyRow, disabled, onChange }) {
  function update(index, key, value) {
    onChange(rows.map((row, idx) => (idx === index ? { ...row, [key]: value } : row)));
  }
  return (
    <div className={`${RESULT_INNER_SURFACE} p-4`}>
      <p className={`micro-label ${RESULT_LABEL}`}>{title}</p>
      {help && <p className={`text-xs mt-1 ${RESULT_BODY}`}>{help}</p>}
      <div className="mt-3 space-y-2">
        {rows.length === 0 && <p className={`text-xs ${RESULT_BODY}`}>Nothing yet — tap “{addLabel}” to add the first one.</p>}
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            {columns.map(col => (
              <label key={col.key} className="flex-1 min-w-[100px]">
                <span className={`block text-[11px] font-semibold ${RESULT_LABEL}`}>{col.label}</span>
                <input
                  type={col.type || 'text'}
                  inputMode={col.type === 'number' ? 'numeric' : undefined}
                  disabled={disabled}
                  value={row[col.key] ?? ''}
                  placeholder={col.placeholder || ''}
                  onChange={event => update(index, col.key, event.target.value)}
                  className={`mt-1 ${RESULT_INPUT}`}
                />
              </label>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(rows.filter((_, idx) => idx !== index))}
              className={`${RESULT_SECONDARY_BUTTON} px-3`}
              aria-label="Remove"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...rows, { ...emptyRow }])}
        className={`mt-3 ${RESULT_SECONDARY_BUTTON}`}
      >
        + {addLabel}
      </button>
    </div>
  );
}

export default function ResultSettingsPanel({
  settings = {},
  templates = [],
  suggestedSettings = {},
  canManageSettings = false,
  saving = false,
  onSave = async () => {},
}) {
  const [form, setForm] = useState(buildFormState(settings, suggestedSettings));
  const [previewTemplateKey, setPreviewTemplateKey] = useState('');
  const [configOpen, setConfigOpen] = useState(true);
  // Beginner-friendly row state, kept in sync with the text fields the save uses.
  const [gradeRows, setGradeRows] = useState(() => parseLines(form.gradingScaleText, 'grading'));
  const [ratingRows, setRatingRows] = useState(() => parseLines(form.ratingScaleText, 'value'));
  const [affectiveRows, setAffectiveRows] = useState(() => parseLines(form.affectiveScaleText, 'value'));
  const [caRows, setCaRows] = useState(() => parseCaComponentLines(form.caComponentsText));

  useEffect(() => {
    const next = buildFormState(settings, suggestedSettings);
    setForm(next);
    setGradeRows(parseLines(next.gradingScaleText, 'grading'));
    setRatingRows(parseLines(next.ratingScaleText, 'value'));
    setAffectiveRows(parseLines(next.affectiveScaleText, 'value'));
    setCaRows(parseCaComponentLines(next.caComponentsText));
  }, [settings, suggestedSettings]);

  function applyGradeRows(rows) {
    setGradeRows(rows);
    setForm(current => ({ ...current, gradingScaleText: rows.map(r => `${r.minScore ?? ''}|${r.grade ?? ''}|${r.remark ?? ''}`).join('\n') }));
  }
  function applyRatingRows(rows) {
    setRatingRows(rows);
    setForm(current => ({ ...current, ratingScaleText: rows.map(r => `${r.value ?? ''}|${r.label ?? ''}`).join('\n') }));
  }
  function applyAffectiveRows(rows) {
    setAffectiveRows(rows);
    setForm(current => ({ ...current, affectiveScaleText: rows.map(r => `${r.value ?? ''}|${r.label ?? ''}`).join('\n') }));
  }
  function applyCaRows(rows) {
    setCaRows(rows);
    setForm(current => ({ ...current, caComponentsText: rows.map(r => `${r.maxScore ?? ''}|${r.label ?? ''}`).join('\n') }));
  }

  useEffect(() => {
    setPreviewTemplateKey(current => {
      if (current && templates.some(template => template.key === current)) return current;
      return form.templateKey || templates[0]?.key || '';
    });
  }, [form.templateKey, templates]);

  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const caComponentEntries = parseCaComponentLines(form.caComponentsText);
  const caComponentTotal = caComponentEntries.reduce((sum, entry) => sum + Number(entry.maxScore || 0), 0);
  const scoreTotal = toNumber(form.caMaxScore, 0) + toNumber(form.examMaxScore, 0);
  const previewTemplate = templates.find(template => template.key === previewTemplateKey)
    || templates.find(template => template.key === form.templateKey)
    || templates[0]
    || null;

  // Mirror the server-side save gate so the user sees exactly what is still blocking the save,
  // right where the Save button is — instead of a generic failure scrolled far up the page.
  const affectiveAreas = parseDomains(form.affectiveDomainsText);
  const validationIssues = [];
  if (!String(form.templateKey || '').trim()) validationIssues.push('Choose a result template.');
  if (gradeRows.filter(row => String(row.grade || '').trim()).length === 0) validationIssues.push('Add at least one grade to the grading scale.');
  if (ratingRows.filter(row => String(row.label || '').trim()).length === 0) validationIssues.push('Add at least one rating to the rating scale.');
  if (affectiveRows.filter(row => String(row.label || '').trim()).length === 0) validationIssues.push('Add at least one level to the affective scale.');
  if (affectiveAreas.length === 0) validationIssues.push('Add at least one affective area.');
  if (affectiveAreas.length > 8) validationIssues.push('Affective areas can be at most 8.');
  if (scoreTotal !== 100) validationIssues.push(`CA max + exam max must add up to 100 (currently ${scoreTotal}).`);
  if (caComponentEntries.length === 0) validationIssues.push('Add at least one CA component.');
  if (caComponentTotal !== toNumber(form.caMaxScore, 40)) validationIssues.push(`CA components must add up to the CA max score (${toNumber(form.caMaxScore, 40)}); they total ${caComponentTotal}.`);
  if (!String(form.affectiveWriteUp || '').trim()) validationIssues.push('Add the affective write-up guide.');

  async function handleSubmit(event) {
    event.preventDefault();
    setSaveError('');
    setSaveMessage('');
    const existingMetadata = settings?.metadata && typeof settings.metadata === 'object' ? settings.metadata : {};
    const existingBranding = existingMetadata?.branding && typeof existingMetadata.branding === 'object' ? existingMetadata.branding : {};
    try {
      await onSave({
        templateKey: form.templateKey,
        gradingScale: parseLines(form.gradingScaleText, 'grading'),
        ratingScale: parseLines(form.ratingScaleText, 'value'),
        affectiveScale: parseLines(form.affectiveScaleText, 'value'),
        affectiveDomains: parseDomains(form.affectiveDomainsText),
        metadata: {
          ...existingMetadata,
          affectiveWriteUp: form.affectiveWriteUp,
          ratingDomains: parseDomains(form.ratingDomainsText),
          caMaxScore: toNumber(form.caMaxScore, 40),
          examMaxScore: toNumber(form.examMaxScore, 60),
          caComponents: parseCaComponentLines(form.caComponentsText),
          branding: {
            ...existingBranding,
            reportTitle: form.brandingReportTitle,
            primaryColor: form.brandingPrimaryColor,
            accentColor: form.brandingAccentColor,
          },
        },
      });
      setSaveMessage('Result settings saved. They will stay saved after a refresh.');
    } catch (error) {
      setSaveError(error?.message || 'Could not save result settings. Please fix the highlighted items and try again.');
    }
  }

  return (
    <section className={`${RESULT_SURFACE} p-6`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className={`micro-label ${RESULT_LABEL}`}>Result Configuration</p>
          <h2 className={`text-xl command-title mt-2 ${RESULT_HEADING}`}>Template, grading, CA components, and affective setup</h2>
        </div>
        {!canManageSettings && <p className={`micro-label ${RESULT_LABEL}`}>View only</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className={`micro-label ${RESULT_LABEL}`}>Result Template</span>
          <select
            value={form.templateKey}
            disabled={!canManageSettings || saving}
            onChange={event => {
              const nextKey = event.target.value;
              setForm(current => ({ ...current, templateKey: nextKey }));
              setPreviewTemplateKey(nextKey);
            }}
            className={`mt-2 ${RESULT_INPUT}`}
          >
            <option value="">Choose template</option>
            {templates.map(template => (
              <option key={template.key} value={template.key}>{template.name}</option>
            ))}
          </select>
        </label>

        {templates.length > 0 && (
          <section className={`${RESULT_INNER_SURFACE} p-4 space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={`micro-label ${RESULT_LABEL}`}>Template Gallery</p>
                <p className={`text-xs mt-2 ${RESULT_BODY}`}>Preview or download a sample before you choose the final result template.</p>
              </div>
              {previewTemplate && (
                <button
                  type="button"
                  onClick={() => downloadTemplatePreview(previewTemplate, {
                    schoolName: form.brandingSchoolName,
                    reportTitle: form.brandingReportTitle,
                    primaryColor: form.brandingPrimaryColor,
                    accentColor: form.brandingAccentColor,
                  })}
                  className={RESULT_SECONDARY_BUTTON}
                >
                  Download Preview
                </button>
              )}
            </div>

            {previewTemplate && (
              <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#fff8f0] p-5 dark:border-white/10 dark:bg-slate-800/40">
                <p className={`micro-label ${RESULT_LABEL}`}>Live Sample — {previewTemplate.name}</p>
                <div
                  className="mt-4 rounded-3xl border border-white/10 p-5"
                  style={{
                    background: `linear-gradient(135deg, ${form.brandingPrimaryColor} 0%, ${form.brandingAccentColor} 100%)`,
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">{form.brandingSchoolName || 'School Branding'}</p>
                  <h3 className="mt-3 text-2xl font-black text-white">{form.brandingReportTitle || previewTemplate.name}</h3>
                  <p className="mt-2 max-w-2xl text-sm text-white/85">{previewTemplate.description}</p>
                </div>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-4">
                  <div className={`${RESULT_INNER_SURFACE} p-4`}>
                    <p className={`micro-label ${RESULT_LABEL}`}>Layout Strengths</p>
                    <div className="mt-3 space-y-2">
                      {(previewTemplate.preview?.strengths || []).map(item => (
                        <p key={`${previewTemplate.key}-preview-${item}`} className={`text-sm ${RESULT_BODY}`}>{item}</p>
                      ))}
                    </div>
                  </div>
                  <div className={`${RESULT_INNER_SURFACE} p-4`}>
                    <p className={`micro-label ${RESULT_LABEL}`}>Your grading &amp; CA (live)</p>
                    <div className="mt-3 space-y-1">
                      {gradeRows.filter(row => row.grade).length === 0 && (
                        <p className={`text-xs ${RESULT_BODY}`}>Add grades in the configuration below to see them here.</p>
                      )}
                      {gradeRows.filter(row => row.grade).slice(0, 6).map((row, index) => (
                        <div key={`grade-preview-${index}`} className={`flex justify-between text-sm ${RESULT_BODY}`}>
                          <span className="font-semibold">{row.grade} <span className="opacity-70">{row.remark}</span></span>
                          <span>from {row.minScore || 0}%</span>
                        </div>
                      ))}
                      {caRows.filter(row => row.label).length > 0 && (
                        <div className={`mt-2 pt-2 border-t border-[#c9a96e]/30 dark:border-white/10 flex justify-between text-sm ${RESULT_HEADING}`}>
                          <span className="font-bold">CA total</span>
                          <span className="font-bold">{caComponentTotal} / {toNumber(form.caMaxScore, 40)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Configuration — its own collapsible section, separate from the template. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`micro-label ${RESULT_LABEL}`}>Configuration</p>
            <p className={`text-xs mt-1 ${RESULT_BODY}`}>Set the score split, grading scale, CA components, ratings and affective areas. The live sample above updates as you change them.</p>
          </div>
          <button type="button" onClick={() => setConfigOpen(open => !open)} className={RESULT_SECONDARY_BUTTON}>
            {configOpen ? 'Hide configuration' : 'Show configuration'}
          </button>
        </div>

        {configOpen && (
        <>
        <section className={`${RESULT_INNER_SURFACE} p-4 space-y-4`}>
          <div>
            <p className={`micro-label ${RESULT_LABEL}`}>Score Model</p>
            <p className={`text-xs mt-2 ${RESULT_BODY}`}>Configure how many marks belong to CA and exam. The grading scale still assumes a 100-point total.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <label className="block">
              <span className={`micro-label ${RESULT_LABEL}`}>CA Max Score</span>
              <input
                type="number"
                min={1}
                max={99}
                disabled={!canManageSettings || saving}
                value={form.caMaxScore}
                onChange={event => setForm(current => ({ ...current, caMaxScore: event.target.value }))}
                className={`mt-2 ${RESULT_INPUT}`}
              />
            </label>

            <label className="block">
              <span className={`micro-label ${RESULT_LABEL}`}>Exam Max Score</span>
              <input
                type="number"
                min={1}
                max={99}
                disabled={!canManageSettings || saving}
                value={form.examMaxScore}
                onChange={event => setForm(current => ({ ...current, examMaxScore: event.target.value }))}
                className={`mt-2 ${RESULT_INPUT}`}
              />
            </label>

            <div className={`${RESULT_INNER_SURFACE} p-4`}>
              <p className={`micro-label ${RESULT_LABEL}`}>Score Check</p>
              <p className={`mt-2 text-sm font-semibold ${RESULT_HEADING}`}>Configured Total: {scoreTotal}</p>
              <p className={`mt-2 text-xs ${RESULT_BODY}`}>CA components currently add up to {caComponentTotal}. Save only when the CA total matches the CA max score and the full total equals 100.</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RowEditor
            title="Grading Scale"
            help="Each grade: the lowest score that earns it, the grade name, and a short remark."
            rows={gradeRows}
            onChange={applyGradeRows}
            disabled={!canManageSettings || saving}
            addLabel="Add grade"
            emptyRow={{ minScore: '', grade: '', remark: '' }}
            columns={[
              { key: 'minScore', label: 'From score', type: 'number', placeholder: '70' },
              { key: 'grade', label: 'Grade', placeholder: 'A' },
              { key: 'remark', label: 'Remark', placeholder: 'Excellent' },
            ]}
          />

          <RowEditor
            title="Rating Scale"
            help="Each rating: a number and what it means."
            rows={ratingRows}
            onChange={applyRatingRows}
            disabled={!canManageSettings || saving}
            addLabel="Add rating"
            emptyRow={{ value: '', label: '' }}
            columns={[
              { key: 'value', label: 'Value', type: 'number', placeholder: '5' },
              { key: 'label', label: 'Means', placeholder: 'Excellent' },
            ]}
          />
        </div>

        <RowEditor
          title="CA Components"
          help={`Each CA piece: its name and how many marks it is worth. They must add up to the CA max score (currently ${toNumber(form.caMaxScore, 40)}); right now they total ${caComponentTotal}.`}
          rows={caRows}
          onChange={applyCaRows}
          disabled={!canManageSettings || saving}
          addLabel="Add CA component"
          emptyRow={{ label: '', maxScore: '' }}
          columns={[
            { key: 'label', label: 'Name', placeholder: 'Test 1' },
            { key: 'maxScore', label: 'Marks', type: 'number', placeholder: '20' },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RowEditor
            title="Affective Scale"
            help="Each level: a number and what it means (e.g. 5 = Excellent)."
            rows={affectiveRows}
            onChange={applyAffectiveRows}
            disabled={!canManageSettings || saving}
            addLabel="Add level"
            emptyRow={{ value: '', label: '' }}
            columns={[
              { key: 'value', label: 'Value', type: 'number', placeholder: '5' },
              { key: 'label', label: 'Means', placeholder: 'Excellent' },
            ]}
          />

          <div className="space-y-4">
            <label className="block">
              <span className={`micro-label ${RESULT_LABEL}`}>Affective Areas</span>
              <input
                type="text"
                disabled={!canManageSettings || saving}
                value={form.affectiveDomainsText}
                onChange={event => setForm(current => ({ ...current, affectiveDomainsText: event.target.value }))}
                className={`mt-2 ${RESULT_INPUT}`}
              />
              <p className={`text-xs mt-2 ${RESULT_BODY}`}>Comma-separated, up to 8 areas.</p>
            </label>

            <label className="block">
              <span className={`micro-label ${RESULT_LABEL}`}>Rating Areas</span>
              <input
                type="text"
                disabled={!canManageSettings || saving}
                value={form.ratingDomainsText}
                onChange={event => setForm(current => ({ ...current, ratingDomainsText: event.target.value }))}
                className={`mt-2 ${RESULT_INPUT}`}
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className={`micro-label ${RESULT_LABEL}`}>Affective Write-up Guide</span>
          <textarea
            rows={4}
            disabled={!canManageSettings || saving}
            value={form.affectiveWriteUp}
            onChange={event => setForm(current => ({ ...current, affectiveWriteUp: event.target.value }))}
            className={`mt-2 ${RESULT_INPUT}`}
          />
        </label>

        <section className={`${RESULT_INNER_SURFACE} p-4 space-y-4`}>
          <div>
            <p className={`micro-label ${RESULT_LABEL}`}>Document Branding</p>
            <p className={`text-xs mt-2 ${RESULT_BODY}`}>School name and logo now come from School Branding settings. Result settings only control the report title and color accents.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`${RESULT_INNER_SURFACE} p-4 flex items-center gap-4`}>
              {form.brandingLogoUrl ? (
                <img
                  src={form.brandingLogoUrl}
                  alt={form.brandingSchoolName || 'School branding logo'}
                  className="h-16 w-16 rounded-2xl object-contain border border-white/10 bg-white/10 p-2"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-white/10 text-xs text-slate-400">
                  No logo
                </div>
              )}
              <div>
                <p className={`micro-label ${RESULT_LABEL}`}>School Branding Source</p>
                <p className={`mt-2 text-sm font-semibold ${RESULT_HEADING}`}>{form.brandingSchoolName || 'School Branding settings'}</p>
                <p className={`mt-2 text-xs ${RESULT_BODY}`}>{form.brandingLogoUrl ? 'Logo is pulled from School Branding settings.' : 'Add a logo in School Branding settings to show it on result records.'}</p>
              </div>
            </div>

            <label className="block">
              <span className={`micro-label ${RESULT_LABEL}`}>Report Title</span>
              <input
                type="text"
                disabled={!canManageSettings || saving}
                value={form.brandingReportTitle}
                onChange={event => setForm(current => ({ ...current, brandingReportTitle: event.target.value }))}
                className={`mt-2 ${RESULT_INPUT}`}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <label className="block">
              <span className={`micro-label ${RESULT_LABEL}`}>Primary Color</span>
              <div className={`mt-2 flex items-center gap-3 px-3 py-2 ${RESULT_INNER_SURFACE}`}>
                <input
                  type="color"
                  disabled={!canManageSettings || saving}
                  value={form.brandingPrimaryColor}
                  onChange={event => setForm(current => ({ ...current, brandingPrimaryColor: event.target.value }))}
                  className="h-10 w-12 rounded-lg bg-transparent"
                />
                <span className={`text-sm ${RESULT_BODY}`}>{form.brandingPrimaryColor}</span>
              </div>
            </label>

            <label className="block">
              <span className={`micro-label ${RESULT_LABEL}`}>Accent Color</span>
              <div className={`mt-2 flex items-center gap-3 px-3 py-2 ${RESULT_INNER_SURFACE}`}>
                <input
                  type="color"
                  disabled={!canManageSettings || saving}
                  value={form.brandingAccentColor}
                  onChange={event => setForm(current => ({ ...current, brandingAccentColor: event.target.value }))}
                  className="h-10 w-12 rounded-lg bg-transparent"
                />
                <span className={`text-sm ${RESULT_BODY}`}>{form.brandingAccentColor}</span>
              </div>
            </label>
          </div>
        </section>
        </>
        )}

        {canManageSettings && (
          <div className="space-y-3">
            {/* The live checklist is the most actionable, so it takes priority; a server-only
                rejection shows next, and the success note only when everything is clear. */}
            {validationIssues.length > 0 ? (
              <div className="rounded-2xl border border-amber-300/45 bg-amber-100/70 px-4 py-3 text-sm text-[#800020] dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                <p className="font-bold">Finish these before the settings can save:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {validationIssues.map(issue => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : saveError ? (
              <div className="rounded-2xl border border-rose-300/40 bg-rose-100/70 px-4 py-3 text-sm font-semibold text-[#800020] dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200">
                {saveError}
              </div>
            ) : saveMessage ? (
              <div className="rounded-2xl border border-emerald-300/40 bg-emerald-100/70 px-4 py-3 text-sm font-semibold text-[#1a5c38] dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                {saveMessage}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className={RESULT_BUTTON}
            >
              {saving ? 'Saving settings...' : 'Save Result Settings'}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}