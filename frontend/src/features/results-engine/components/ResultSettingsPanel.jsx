import React, { useEffect, useState } from 'react';

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

  useEffect(() => {
    setForm(buildFormState(settings, suggestedSettings));
  }, [settings, suggestedSettings]);

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
        branding: {
          ...existingBranding,
          schoolName: form.brandingSchoolName,
          reportTitle: form.brandingReportTitle,
          logoUrl: form.brandingLogoUrl,
          primaryColor: form.brandingPrimaryColor,
          accentColor: form.brandingAccentColor,
        },
      },
    });
  }

  return (
    <section className="glass-surface rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="micro-label neon-subtle">Result Configuration</p>
          <h2 className="text-xl command-title neon-title">Template, grading, and affective setup</h2>
        </div>
        {!canManageSettings && <p className="micro-label accent-amber">View only</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="micro-label accent-indigo">Result Template</span>
          <select
            value={form.templateKey}
            disabled={!canManageSettings || saving}
            onChange={event => setForm(current => ({ ...current, templateKey: event.target.value }))}
            className="mt-2 w-full rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100"
          >
            <option value="">Choose template</option>
            {templates.map(template => (
              <option key={template.key} value={template.key}>{template.name}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label className="block">
            <span className="micro-label accent-emerald">Grading Scale</span>
            <textarea
              rows={6}
              disabled={!canManageSettings || saving}
              value={form.gradingScaleText}
              onChange={event => setForm(current => ({ ...current, gradingScaleText: event.target.value }))}
              className="mt-2 w-full rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100"
            />
            <p className="text-xs text-slate-400 mt-2">One line per grade: minimum score | grade | remark</p>
          </label>

          <label className="block">
            <span className="micro-label accent-amber">Rating Scale</span>
            <textarea
              rows={6}
              disabled={!canManageSettings || saving}
              value={form.ratingScaleText}
              onChange={event => setForm(current => ({ ...current, ratingScaleText: event.target.value }))}
              className="mt-2 w-full rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100"
            />
            <p className="text-xs text-slate-400 mt-2">One line per rating: value | label</p>
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label className="block">
            <span className="micro-label accent-rose">Affective Scale</span>
            <textarea
              rows={6}
              disabled={!canManageSettings || saving}
              value={form.affectiveScaleText}
              onChange={event => setForm(current => ({ ...current, affectiveScaleText: event.target.value }))}
              className="mt-2 w-full rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100"
            />
            <p className="text-xs text-slate-400 mt-2">One line per affective score: value | label</p>
          </label>

          <div className="space-y-4">
            <label className="block">
              <span className="micro-label accent-indigo">Affective Areas</span>
              <input
                type="text"
                disabled={!canManageSettings || saving}
                value={form.affectiveDomainsText}
                onChange={event => setForm(current => ({ ...current, affectiveDomainsText: event.target.value }))}
                className="mt-2 w-full rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100"
              />
              <p className="text-xs text-slate-400 mt-2">Comma-separated, up to 8 areas.</p>
            </label>

            <label className="block">
              <span className="micro-label accent-amber">Rating Areas</span>
              <input
                type="text"
                disabled={!canManageSettings || saving}
                value={form.ratingDomainsText}
                onChange={event => setForm(current => ({ ...current, ratingDomainsText: event.target.value }))}
                className="mt-2 w-full rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100"
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="micro-label accent-indigo">Affective Write-up Guide</span>
          <textarea
            rows={4}
            disabled={!canManageSettings || saving}
            value={form.affectiveWriteUp}
            onChange={event => setForm(current => ({ ...current, affectiveWriteUp: event.target.value }))}
            className="mt-2 w-full rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100"
          />
        </label>

        <section className="rounded-2xl border border-white/10 bg-slate-950/20 p-4 space-y-4">
          <div>
            <p className="micro-label accent-emerald">Document Branding</p>
            <p className="text-xs text-slate-400 mt-2">Applied to the published result viewer now and carried in the result payload for future generated document exports.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <label className="block">
              <span className="micro-label accent-indigo">School Name</span>
              <input
                type="text"
                disabled={!canManageSettings || saving}
                value={form.brandingSchoolName}
                onChange={event => setForm(current => ({ ...current, brandingSchoolName: event.target.value }))}
                className="mt-2 w-full rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="block">
              <span className="micro-label accent-amber">Report Title</span>
              <input
                type="text"
                disabled={!canManageSettings || saving}
                value={form.brandingReportTitle}
                onChange={event => setForm(current => ({ ...current, brandingReportTitle: event.target.value }))}
                className="mt-2 w-full rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <label className="block lg:col-span-1">
              <span className="micro-label accent-indigo">Logo URL</span>
              <input
                type="url"
                disabled={!canManageSettings || saving}
                value={form.brandingLogoUrl}
                onChange={event => setForm(current => ({ ...current, brandingLogoUrl: event.target.value }))}
                className="mt-2 w-full rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="block">
              <span className="micro-label accent-emerald">Primary Color</span>
              <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2">
                <input
                  type="color"
                  disabled={!canManageSettings || saving}
                  value={form.brandingPrimaryColor}
                  onChange={event => setForm(current => ({ ...current, brandingPrimaryColor: event.target.value }))}
                  className="h-10 w-12 rounded-lg bg-transparent"
                />
                <span className="text-sm text-slate-200">{form.brandingPrimaryColor}</span>
              </div>
            </label>

            <label className="block">
              <span className="micro-label accent-rose">Accent Color</span>
              <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2">
                <input
                  type="color"
                  disabled={!canManageSettings || saving}
                  value={form.brandingAccentColor}
                  onChange={event => setForm(current => ({ ...current, brandingAccentColor: event.target.value }))}
                  className="h-10 w-12 rounded-lg bg-transparent"
                />
                <span className="text-sm text-slate-200">{form.brandingAccentColor}</span>
              </div>
            </label>
          </div>
        </section>

        {canManageSettings && (
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/20 text-emerald-100 text-sm disabled:opacity-50"
          >
            {saving ? 'Saving settings...' : 'Save Result Settings'}
          </button>
        )}
      </form>
    </section>
  );
}