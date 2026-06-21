import React, { useEffect, useMemo, useState } from 'react';
import { getAuditLog, getPeople } from '../services/schoolApi';

const SHELL = 'p-8 max-w-7xl mx-auto space-y-6';
const SURFACE = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-6 shadow-[0_18px_42px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:shadow-[0_0_28px_rgba(191,0,255,0.18)]';
const PANEL = 'rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/35 dark:bg-black/20';
const LABEL = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]';
const BODY = 'text-sm text-[#191970] dark:text-[#39ff14]';
const INPUT = 'rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] px-4 py-3 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff] dark:focus:ring-[#00ffff]';

const CATEGORY_RULES = {
  finance: ['fee', 'payment', 'payroll', 'receipt', 'claim'],
  people: ['person', 'password', 'settings', 'bulkimport'],
  admissions: ['admission', 'enquiry'],
  governance: ['tenant', 'announcement', 'approval', 'discount'],
  library: ['borrow', 'return'],
};

function extractAuditRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.logs || payload?.events || payload?.results || [];
}

function formatDateTime(value) {
  if (!value) return 'Now';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function humanizeAction(value) {
  const text = String(value || 'event').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function prettifyKey(value) {
  const text = String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/\bid\b/i, 'ID');
}

// Keys whose values are user/student/tenant identifiers we should resolve to a readable name.
function looksLikeIdentifier(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return /^(user|student|tenant|usr|stu)[_-]/i.test(text) || /^[A-Za-z0-9]+_\d{10,}/.test(text);
}

// Keys that are noisy/internal and add no value in the plain-text view.
const HIDDEN_DETAIL_KEYS = new Set(['tenantid', 'tenant', 'id', 'ip', 'useragent', 'ua']);

function getCategory(entry) {
  const actionText = String(entry?.action || '').toLowerCase();
  const payloadText = JSON.stringify(entry?.data || {}).toLowerCase();
  const combined = `${actionText} ${payloadText}`;

  if (CATEGORY_RULES.finance.some(keyword => combined.includes(keyword))) return 'finance';
  if (CATEGORY_RULES.people.some(keyword => combined.includes(keyword))) return 'people';
  if (CATEGORY_RULES.admissions.some(keyword => combined.includes(keyword))) return 'admissions';
  if (CATEGORY_RULES.governance.some(keyword => combined.includes(keyword))) return 'governance';
  if (CATEGORY_RULES.library.some(keyword => combined.includes(keyword))) return 'library';
  return 'operations';
}

function buildPreview(data) {
  if (!data || typeof data !== 'object') return '';
  return Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' | ');
}

function MetricCard({ label, value }) {
  return (
    <div className={PANEL}>
      <p className={LABEL}>{label}</p>
      <p className="mt-2 text-2xl font-black text-[#191970] dark:text-[#39ff14]">{value}</p>
    </div>
  );
}

export default function SchoolAuditTrailPage({
  roleLabel = 'Leadership',
  title = 'Live Audit Trail',
  subtitle = 'Critical school actions refresh automatically.',
}) {
  const [events, setEvents] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [lastUpdated, setLastUpdated] = useState('');

  // Build a directory so audit IDs/emails display as readable names.
  useEffect(() => {
    let active = true;
    getPeople({ limit: 500 })
      .then(data => { if (active) setPeople(data?.people || []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const nameMap = useMemo(() => {
    const map = new Map();
    people.forEach(person => {
      const name = String(person?.name || '').trim();
      if (!name) return;
      [person.id, person.email, person.displayId].forEach(key => {
        const normalized = String(key || '').trim().toLowerCase();
        if (normalized) map.set(normalized, name);
      });
    });
    return map;
  }, [people]);

  const resolveName = useMemo(() => (value) => {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    return nameMap.get(raw.toLowerCase()) || raw;
  }, [nameMap]);

  // Convert an audit data object into readable label/value lines (no raw JSON, IDs resolved to names).
  const buildDetailLines = useMemo(() => (data) => {
    if (!data || typeof data !== 'object') return [];
    return Object.entries(data)
      .filter(([key, value]) => {
        if (HIDDEN_DETAIL_KEYS.has(String(key).toLowerCase())) return false;
        return value !== undefined && value !== null && value !== '';
      })
      .map(([key, value]) => {
        let display;
        if (Array.isArray(value)) {
          display = value.map(item => (looksLikeIdentifier(item) ? resolveName(item) : String(item))).join(', ');
        } else if (typeof value === 'object') {
          display = Object.entries(value)
            .map(([innerKey, innerValue]) => `${prettifyKey(innerKey)}: ${looksLikeIdentifier(innerValue) ? resolveName(innerValue) : innerValue}`)
            .join(', ');
        } else {
          const text = String(value);
          display = (looksLikeIdentifier(text) || text.includes('@')) ? resolveName(text) : text;
        }
        return { label: prettifyKey(key), value: display };
      })
      .filter(line => line.value !== '');
  }, [resolveName]);

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      if (active) setError('');
      try {
        const response = await getAuditLog();
        if (!active) return;
        setEvents(extractAuditRows(response));
        setLastUpdated(new Date().toISOString());
      } catch (loadError) {
        if (!active) return;
        setEvents([]);
        setError(loadError instanceof Error ? loadError.message : 'Could not load audit logs.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEvents();
    const intervalId = window.setInterval(loadEvents, 15000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const normalizedEvents = useMemo(() => events.map(event => ({
    ...event,
    category: getCategory(event),
    ts: event?.ts || event?.createdAt || '',
    preview: buildPreview(event?.data),
  })), [events]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return normalizedEvents.filter(event => {
      if (category !== 'all' && event.category !== category) return false;
      if (!query) return true;
      const haystack = `${event.action || ''} ${event.preview || ''} ${JSON.stringify(event.data || {})}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [category, normalizedEvents, search]);

  const summary = useMemo(() => {
    const recentThreshold = Date.now() - (24 * 60 * 60 * 1000);
    return {
      total: normalizedEvents.length,
      recent: normalizedEvents.filter(event => {
        const timestamp = new Date(event.ts || 0).getTime();
        return Number.isFinite(timestamp) && timestamp >= recentThreshold;
      }).length,
      finance: normalizedEvents.filter(event => event.category === 'finance').length,
      admissions: normalizedEvents.filter(event => event.category === 'admissions').length,
      people: normalizedEvents.filter(event => event.category === 'people').length,
    };
  }, [normalizedEvents]);

  return (
    <div className={SHELL}>
      <section className={SURFACE}>
        <p className={LABEL}>{roleLabel}</p>
        <h1 className="mt-2 text-3xl font-black text-[#800000] dark:text-[#ffffff]">{title}</h1>
        <p className={`${BODY} mt-2 max-w-4xl`}>{subtitle}</p>
        <p className={`${BODY} mt-3`}>Auto-refresh interval: 15 seconds{lastUpdated ? ` • Last sync ${formatDateTime(lastUpdated)}` : ''}</p>
        {error ? <div className="mt-4 rounded-2xl border border-red-400/35 bg-red-50 px-4 py-3 text-sm text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">{error}</div> : null}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="All events" value={summary.total} />
        <MetricCard label="Last 24 hours" value={summary.recent} />
        <MetricCard label="Finance" value={summary.finance} />
        <MetricCard label="Admissions" value={summary.admissions} />
      </section>

      <section className={SURFACE}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.7fr_0.7fr]">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search action, actor, receipt, learner, or notes"
            className={INPUT}
          />
          <select value={category} onChange={event => setCategory(event.target.value)} className={INPUT}>
            <option value="all">All categories</option>
            <option value="finance">Finance</option>
            <option value="people">People</option>
            <option value="admissions">Admissions</option>
            <option value="governance">Governance</option>
            <option value="library">Library</option>
            <option value="operations">Operations</option>
          </select>
          <div className={PANEL}>
            <p className={LABEL}>Visible events</p>
            <p className="mt-2 text-2xl font-black text-[#191970] dark:text-[#39ff14]">{filteredEvents.length}</p>
          </div>
        </div>
      </section>

      <section className={SURFACE}>
        {loading ? <p className={BODY}>Loading live audit events...</p> : null}
        {!loading && filteredEvents.length === 0 ? <p className={BODY}>No audit events match the current filters.</p> : null}

        {!loading && filteredEvents.length > 0 ? (
          <div className="space-y-3">
            {filteredEvents.map((event, index) => (
              <article key={event.id || `${event.action}-${index}`} className={PANEL}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={LABEL}>{event.category}</p>
                    <h2 className="mt-1 text-lg font-bold text-[#800000] dark:text-[#ffffff]">{humanizeAction(event.action)}</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-[#b5e3f4] dark:bg-[#00ffff] dark:text-[#000000]">{resolveName(event.studentId) || 'School'}</span>
                    <span className="rounded-full border border-[#c9a96e]/45 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#bf00ff]">{formatDateTime(event.ts)}</span>
                  </div>
                </div>
                {(() => {
                  const detailLines = buildDetailLines(event.data);
                  if (detailLines.length === 0) return null;
                  return (
                    <dl className="mt-3 space-y-1">
                      {detailLines.map((line, lineIndex) => (
                        <div key={`${line.label}-${lineIndex}`} className="flex flex-wrap gap-x-2">
                          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#800020] dark:text-[#bf00ff]">{line.label}:</dt>
                          <dd className={`${BODY} text-sm`}>{line.value}</dd>
                        </div>
                      ))}
                    </dl>
                  );
                })()}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}