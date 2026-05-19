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

  useEffect(() => {
    setForm(buildFormState(settings, suggestedSettings));
  }, [settings, suggestedSettings]);

  useEffect(() => {
    setPreviewTemplateKey(current => {
      if (current && templates.some(template => template.key === current)) return current;
      return form.templateKey || templates[0]?.key || '';
    });
  }, [form.templateKey, templates]);

  const caComponentEntries = parseCaComponentLines(form.caComponentsText);
  const caComponentTotal = caComponentEntries.reduce((sum, entry) => sum + Number(entry.maxScore || 0), 0);
  const scoreTotal = toNumber(form.caMaxScore, 0) + toNumber(form.examMaxScore, 0);
  const previewTemplate = templates.find(template => template.key === previewTemplateKey)
    || templates.find(template => template.key === form.templateKey)
    || templates[0]
    || null;

  async function handleSubmit(event) {
    event.preventDefault();
    const existingMetadata = settings?.metadata && typeof settings.metadata === 'object' ? settings.metadata : {};
    const existingBranding = existingMetadata?.branding && typeof existingMetadata.branding === 'object' ? existingMetadata.branding : {};
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

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {templates.map(template => {
                const isSelected = form.templateKey === template.key;
                const isPreviewed = previewTemplateKey === template.key;
                return (
                  <article
                    key={template.key}
                    className={`${RESULT_INNER_SURFACE} p-4 border ${isSelected ? 'border-[#1a5c38] dark:border-[#00ffff]' : 'border-transparent'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`micro-label ${RESULT_LABEL}`}>{template.preview?.mood || 'Official'}</p>
                        <h3 className={`mt-2 text-lg font-semibold ${RESULT_HEADING}`}>{template.name}</h3>
                      </div>
                      {isSelected && <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${RESULT_LABEL}`}>Selected</span>}
                    </div>
                    <p className={`mt-3 text-sm ${RESULT_BODY}`}>{template.description}</p>
                    <div className="mt-4 space-y-2">
                      {(template.preview?.strengths || []).map(item => (
                        <p key={`${template.key}-${item}`} className={`text-xs ${RESULT_BODY}`}>{item}</p>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewTemplateKey(template.key)}
                        className={RESULT_SECONDARY_BUTTON}
                      >
                        {isPreviewed ? 'Previewing' : 'Preview'}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadTemplatePreview(template, {
                          schoolName: form.brandingSchoolName,
                          reportTitle: form.brandingReportTitle,
                          primaryColor: form.brandingPrimaryColor,
                          accentColor: form.brandingAccentColor,
                        })}
                        className={RESULT_SECONDARY_BUTTON}
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        disabled={!canManageSettings || saving}
                        onClick={() => setForm(current => ({ ...current, templateKey: template.key }))}
                        className={RESULT_BUTTON}
                      >
                        Use Template
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {previewTemplate && (
              <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#fff8f0] p-5 dark:border-[#bf00ff]/35 dark:bg-black/20">
                <p className={`micro-label ${RESULT_LABEL}`}>Template Preview</p>
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
                    <p className={`micro-label ${RESULT_LABEL}`}>Sample Result Blocks</p>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {['Average', 'Attendance', 'Grade'].map(label => (
                        <div key={`${previewTemplate.key}-${label}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className={`text-xs ${RESULT_BODY}`}>{label}</p>
                          <p className={`mt-2 text-lg font-black ${RESULT_HEADING}`}>{label === 'Grade' ? 'A' : label === 'Attendance' ? '96%' : '84%'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

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
          <label className="block">
            <span className={`micro-label ${RESULT_LABEL}`}>Grading Scale</span>
            <textarea
              rows={6}
              disabled={!canManageSettings || saving}
              value={form.gradingScaleText}
              onChange={event => setForm(current => ({ ...current, gradingScaleText: event.target.value }))}
              className={`mt-2 ${RESULT_INPUT}`}
            />
            <p className={`text-xs mt-2 ${RESULT_BODY}`}>One line per grade: minimum score | grade | remark</p>
          </label>

          <label className="block">
            <span className={`micro-label ${RESULT_LABEL}`}>Rating Scale</span>
            <textarea
              rows={6}
              disabled={!canManageSettings || saving}
              value={form.ratingScaleText}
              onChange={event => setForm(current => ({ ...current, ratingScaleText: event.target.value }))}
              className={`mt-2 ${RESULT_INPUT}`}
            />
            <p className={`text-xs mt-2 ${RESULT_BODY}`}>One line per rating: value | label</p>
          </label>
        </div>

        <label className="block">
          <span className={`micro-label ${RESULT_LABEL}`}>CA Components</span>
          <textarea
            rows={4}
            disabled={!canManageSettings || saving}
            value={form.caComponentsText}
            onChange={event => setForm(current => ({ ...current, caComponentsText: event.target.value }))}
            className={`mt-2 ${RESULT_INPUT}`}
          />
          <p className={`text-xs mt-2 ${RESULT_BODY}`}>One line per component: max score | label. The configured maxima must add up to the CA max score, currently {toNumber(form.caMaxScore, 40)}.</p>
        </label>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label className="block">
            <span className={`micro-label ${RESULT_LABEL}`}>Affective Scale</span>
            <textarea
              rows={6}
              disabled={!canManageSettings || saving}
              value={form.affectiveScaleText}
              onChange={event => setForm(current => ({ ...current, affectiveScaleText: event.target.value }))}
              className={`mt-2 ${RESULT_INPUT}`}
            />
            <p className={`text-xs mt-2 ${RESULT_BODY}`}>One line per affective score: value | label</p>
          </label>

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

        {canManageSettings && (
          <button
            type="submit"
            disabled={saving}
            className={RESULT_BUTTON}
          >
            {saving ? 'Saving settings...' : 'Save Result Settings'}
          </button>
        )}
      </form>
    </section>
  );
}