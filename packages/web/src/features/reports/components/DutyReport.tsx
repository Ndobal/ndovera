import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  FileText,
  Mic,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';

import { fetchWithAuth } from '../../../services/apiClient';
import { loadUser } from '../../../services/authLocal';

type RosterType = 'DAILY_DUTY' | 'MORNING_ASSEMBLY' | 'GENDER_ASSEMBLY' | 'STAFF_FELLOWSHIP' | 'STUDENT_FELLOWSHIP';

type TeachingStaff = {
  userId: string;
  name: string;
  role: string;
  staffId?: string | null;
  specialization?: string | null;
  classIds: string[];
  classNames: string[];
  assignmentCount: number;
};

type RosterEntry = {
  id: string;
  rosterDate: string;
  dayLabel: string;
  rosterType: RosterType;
  note: string;
  isDraft: boolean;
  leadUserId: string | null;
  leadName: string | null;
  leadStaffId?: string | null;
  assistantOneUserId: string | null;
  assistantOneName: string | null;
  assistantOneStaffId?: string | null;
  assistantTwoUserId: string | null;
  assistantTwoName: string | null;
  assistantTwoStaffId?: string | null;
  myRole: string | null;
};

type RosterPayload = {
  rosterType: RosterType;
  monthKey: string;
  settings: { allowSameClassPairing: boolean };
  rosterMeta: { id: RosterType; label: string; assistantSlots: 0 | 1 | 2 };
  tabs: Array<{ id: RosterType; label: string; assistantSlots: 0 | 1 | 2 }>;
  teachingStaff: TeachingStaff[];
  coverage: { scheduledDays: number; expectedDays: number; unassignedDays: number };
  entries: RosterEntry[];
  myAssignments: Array<{ rosterDate: string; dayLabel: string; role: string; note: string }>;
};

type DutyReportRecord = {
  id: string;
  staff_name: string;
  date: string;
  report_data: Record<string, string>;
  ai_analysis?: {
    feedback?: string;
    coverage_score?: number;
    tone?: string;
    summary?: string;
  } | null;
  status?: string;
};

type EditorState = {
  leadUserId: string;
  assistantOneUserId: string;
  assistantTwoUserId: string;
  note: string;
};

const SECTIONS = [
  { id: 'morning_arrival', label: 'Morning Arrival & Entry' },
  { id: 'break_times', label: 'Break & Lunch Times' },
  { id: 'dismissal', label: 'Dismissal & Buses' },
  { id: 'incidents', label: 'Incidents & Interventions' },
  { id: 'general_notes', label: 'General Notes / Handover' },
];

const ROSTER_TAB_META: Record<RosterType, { label: string; description: string }> = {
  DAILY_DUTY: {
    label: 'Daily Duty',
    description: 'Monday to Friday supervision with one lead and two assistants.',
  },
  MORNING_ASSEMBLY: {
    label: 'Morning Assembly',
    description: 'Daily assembly lead rotation across the month.',
  },
  GENDER_ASSEMBLY: {
    label: 'Gender Assembly',
    description: 'Mid-week guidance roster with paired staff cover.',
  },
  STAFF_FELLOWSHIP: {
    label: 'Staff Fellowship',
    description: 'Weekly staff fellowship lead assignment.',
  },
  STUDENT_FELLOWSHIP: {
    label: 'Student Fellowship',
    description: 'Friday student fellowship supervision roster.',
  },
};

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function formatLongDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function emptyEditor(entry?: RosterEntry): EditorState {
  return {
    leadUserId: entry?.leadUserId || '',
    assistantOneUserId: entry?.assistantOneUserId || '',
    assistantTwoUserId: entry?.assistantTwoUserId || '',
    note: entry?.note || '',
  };
}

export default function DutyReport() {
  const user = loadUser();
  const normalizedRoles = useMemo(
    () => [user?.activeRole || '', ...(user?.roles || [])].map((role) => role.toLowerCase()).filter(Boolean),
    [user?.activeRole, user?.roles],
  );

  const canManageRoster = normalizedRoles.some((role) => ['hos', 'owner', 'ict manager', 'school admin'].includes(role));
  const canSubmitReport = normalizedRoles.some((role) => ['teacher', 'staff'].includes(role)) && !canManageRoster;

  const [rosterType, setRosterType] = useState<RosterType>('DAILY_DUTY');
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [rosterData, setRosterData] = useState<RosterPayload | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterMessage, setRosterMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>(emptyEditor());

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [reports, setReports] = useState<DutyReportRecord[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState<string>('');
  const [auras, setAuras] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);

  const assistantSlots = rosterData?.rosterMeta.assistantSlots ?? (rosterType === 'DAILY_DUTY' ? 2 : rosterType === 'GENDER_ASSEMBLY' || rosterType === 'STUDENT_FELLOWSHIP' ? 1 : 0);

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const response = await fetchWithAuth('/api/duty-report');
      setReports(Array.isArray(response?.reports) ? response.reports : []);
    } catch (error) {
      console.error(error);
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchAuras = async () => {
    try {
      const response = await fetchWithAuth('/api/auras/balance');
      setAuras(Number(response?.balance ?? response?.auras ?? 0));
    } catch (error) {
      console.error(error);
    }
  };

  const fetchRoster = async () => {
    setRosterLoading(true);
    try {
      const response = await fetchWithAuth(`/api/duty-report/roster?month=${encodeURIComponent(monthKey)}&rosterType=${encodeURIComponent(rosterType)}`);
      setRosterData(response as RosterPayload);
    } catch (error) {
      console.error(error);
      setRosterMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Failed to load the monthly roster.' });
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    void fetchReports();
    void fetchAuras();
  }, []);

  useEffect(() => {
    void fetchRoster();
  }, [monthKey, rosterType]);

  const handleTextChange = (sectionId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [sectionId]: value }));
  };

  const handleVoiceToText = async (sectionId: string) => {
    try {
      const response = await fetchWithAuth('/api/auras/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 5, reason: 'Voice to Text' }),
      });
      setAuras(Number(response?.new_balance ?? response?.balance ?? auras));
      handleTextChange(
        sectionId,
        `${formData[sectionId] || ''}${formData[sectionId] ? ' ' : ''}[Transcribed] All students arrived safely and the duty station remained calm throughout the shift.`,
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Voice to text failed.');
    }
  };

  const handleAIReview = async () => {
    try {
      const response = await fetchWithAuth('/api/duty-report/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_data: formData }),
      });
      setAiAnalysis(response?.analysis || response);
      alert('AI review completed. The feedback card has been updated.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'AI review failed.');
    }
  };

  const handleSubmitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    setReportSubmitting(true);
    setReportMessage('');
    try {
      await fetchWithAuth('/api/duty-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_data: formData, ai_analysis: aiAnalysis }),
      });
      setReportMessage('Duty report submitted successfully.');
      setFormData({});
      setAiAnalysis(null);
      await fetchReports();
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : 'Could not submit the duty report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleGenerateRoster = async () => {
    setRosterBusy(true);
    setRosterMessage(null);
    try {
      const response = await fetchWithAuth('/api/duty-report/roster/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: monthKey, rosterType }),
      });
      const warnings = Array.isArray(response?.warnings) ? response.warnings : [];
      setRosterMessage({
        kind: 'success',
        text: warnings.length > 0
          ? `Monthly roster generated with warnings: ${warnings.join(' | ')}`
          : 'Monthly roster generated with equal-duty rotation applied.',
      });
      await fetchRoster();
    } catch (error) {
      setRosterMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Roster generation failed.' });
    } finally {
      setRosterBusy(false);
    }
  };

  const handleTogglePolicy = async () => {
    if (!rosterData) return;
    setRosterBusy(true);
    setRosterMessage(null);
    try {
      await fetchWithAuth('/api/duty-report/roster/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rosterType,
          allowSameClassPairing: !rosterData.settings.allowSameClassPairing,
        }),
      });
      await fetchRoster();
      setRosterMessage({
        kind: 'success',
        text: !rosterData.settings.allowSameClassPairing
          ? 'Same-class pairing is now allowed for this roster type.'
          : 'Same-class pairing has been blocked again for this roster type.',
      });
    } catch (error) {
      setRosterMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not update the pairing rule.' });
    } finally {
      setRosterBusy(false);
    }
  };

  const startEditingRow = (entry: RosterEntry) => {
    setEditingDate(entry.rosterDate);
    setEditorState(emptyEditor(entry));
  };

  const cancelEditingRow = () => {
    setEditingDate(null);
    setEditorState(emptyEditor());
  };

  const saveEditingRow = async (rosterDate: string) => {
    setRosterBusy(true);
    setRosterMessage(null);
    try {
      await fetchWithAuth('/api/duty-report/roster/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rosterType,
          rosterDate,
          leadUserId: editorState.leadUserId,
          assistantOneUserId: assistantSlots >= 1 ? editorState.assistantOneUserId : '',
          assistantTwoUserId: assistantSlots >= 2 ? editorState.assistantTwoUserId : '',
          note: editorState.note,
        }),
      });
      setEditingDate(null);
      setRosterMessage({ kind: 'success', text: `Roster saved for ${formatLongDate(rosterDate)}.` });
      await fetchRoster();
    } catch (error) {
      setRosterMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not save the roster row.' });
    } finally {
      setRosterBusy(false);
    }
  };

  const topAssignments = useMemo(() => {
    const source = rosterData?.teachingStaff || [];
    return [...source].sort((left, right) => right.assignmentCount - left.assignmentCount).slice(0, 6);
  }, [rosterData]);

  const selectedTabDescription = ROSTER_TAB_META[rosterType];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
              <FileText className="text-indigo-500" /> Duty Management Hub
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Monthly duty rosters, auto-balanced teacher rotation, and daily reporting in one place.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 font-mono text-sm font-bold text-indigo-600 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-indigo-300">
            <Sparkles size={16} /> {auras} AURAS
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(rosterData?.tabs || (Object.keys(ROSTER_TAB_META) as RosterType[]).map((id) => ({ id, label: ROSTER_TAB_META[id].label, assistantSlots: id === 'DAILY_DUTY' ? 2 : id === 'GENDER_ASSEMBLY' || id === 'STUDENT_FELLOWSHIP' ? 1 : 0 }))).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setRosterType(tab.id);
                setEditingDate(null);
                setRosterMessage(null);
              }}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${rosterType === tab.id ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 hover:bg-indigo-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2.2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Calendar size={14} /> {selectedTabDescription.label}
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{selectedTabDescription.description}</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <span>Month</span>
                  <input
                    type="month"
                    value={monthKey}
                    onChange={(event) => setMonthKey(event.target.value || getCurrentMonthKey())}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
                  />
                </label>
                {canManageRoster && (
                  <button
                    onClick={handleGenerateRoster}
                    disabled={rosterBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {rosterBusy ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    Auto-generate monthly rotation
                  </button>
                )}
              </div>
            </div>

            {canManageRoster && rosterData && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Automatic duty pairing rules</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Equal rotation is enforced automatically. Staff who are class teachers for the same class are not paired on the same day unless you allow it.
                    </p>
                  </div>
                  <button
                    onClick={handleTogglePolicy}
                    disabled={rosterBusy}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${rosterData.settings.allowSameClassPairing ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'}`}
                  >
                    <ShieldCheck size={14} />
                    {rosterData.settings.allowSameClassPairing ? 'Same-class pairing allowed' : 'Same-class pairing blocked'}
                  </button>
                </div>
              </div>
            )}

            {rosterMessage && (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${rosterMessage.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>
                {rosterMessage.text}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Full monthly roster</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Staff can view the complete month. Managers can auto-generate and adjust individual days.
                </p>
              </div>
              {rosterData && (
                <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                  <div>{rosterData.coverage.scheduledDays}/{rosterData.coverage.expectedDays} days assigned</div>
                  <div>{rosterData.coverage.unassignedDays} days still blank</div>
                </div>
              )}
            </div>

            {rosterLoading ? (
              <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading roster...</div>
            ) : !rosterData ? (
              <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">No roster data available.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-800/60">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Teacher on duty</th>
                      {assistantSlots >= 1 && <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Assistant 1</th>}
                      {assistantSlots >= 2 && <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Assistant 2</th>}
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Notes</th>
                      {canManageRoster && <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rosterData.entries.map((entry) => {
                      const editing = canManageRoster && editingDate === entry.rosterDate;
                      return (
                        <tr key={entry.rosterDate} className="align-top hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-slate-900 dark:text-white">{entry.dayLabel}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{formatLongDate(entry.rosterDate)}</div>
                            {entry.myRole && (
                              <span className="mt-2 inline-flex rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                                You: {entry.myRole}
                              </span>
                            )}
                          </td>

                          {editing ? (
                            <>
                              <td className="px-4 py-4">
                                <select
                                  value={editorState.leadUserId}
                                  onChange={(event) => setEditorState((prev) => ({ ...prev, leadUserId: event.target.value }))}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
                                >
                                  <option value="">Select teacher on duty</option>
                                  {rosterData.teachingStaff.map((staff) => (
                                    <option key={staff.userId} value={staff.userId}>{staff.name}</option>
                                  ))}
                                </select>
                              </td>
                              {assistantSlots >= 1 && (
                                <td className="px-4 py-4">
                                  <select
                                    value={editorState.assistantOneUserId}
                                    onChange={(event) => setEditorState((prev) => ({ ...prev, assistantOneUserId: event.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
                                  >
                                    <option value="">Select assistant 1</option>
                                    {rosterData.teachingStaff.map((staff) => (
                                      <option key={staff.userId} value={staff.userId}>{staff.name}</option>
                                    ))}
                                  </select>
                                </td>
                              )}
                              {assistantSlots >= 2 && (
                                <td className="px-4 py-4">
                                  <select
                                    value={editorState.assistantTwoUserId}
                                    onChange={(event) => setEditorState((prev) => ({ ...prev, assistantTwoUserId: event.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
                                  >
                                    <option value="">Select assistant 2</option>
                                    {rosterData.teachingStaff.map((staff) => (
                                      <option key={staff.userId} value={staff.userId}>{staff.name}</option>
                                    ))}
                                  </select>
                                </td>
                              )}
                              <td className="px-4 py-4">
                                <textarea
                                  value={editorState.note}
                                  onChange={(event) => setEditorState((prev) => ({ ...prev, note: event.target.value }))}
                                  className="min-h-20.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
                                />
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => saveEditingRow(entry.rosterDate)}
                                    disabled={rosterBusy}
                                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                                  >
                                    <Save size={14} /> Save
                                  </button>
                                  <button
                                    onClick={cancelEditingRow}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-4">
                                <div className="font-medium text-slate-900 dark:text-white">{entry.leadName || 'Not assigned yet'}</div>
                                {entry.leadStaffId && <div className="text-xs text-slate-500 dark:text-slate-400">{entry.leadStaffId}</div>}
                              </td>
                              {assistantSlots >= 1 && (
                                <td className="px-4 py-4">
                                  <div className="font-medium text-slate-900 dark:text-white">{entry.assistantOneName || 'Not assigned yet'}</div>
                                  {entry.assistantOneStaffId && <div className="text-xs text-slate-500 dark:text-slate-400">{entry.assistantOneStaffId}</div>}
                                </td>
                              )}
                              {assistantSlots >= 2 && (
                                <td className="px-4 py-4">
                                  <div className="font-medium text-slate-900 dark:text-white">{entry.assistantTwoName || 'Not assigned yet'}</div>
                                  {entry.assistantTwoStaffId && <div className="text-xs text-slate-500 dark:text-slate-400">{entry.assistantTwoStaffId}</div>}
                                </td>
                              )}
                              <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{entry.note}</td>
                              {canManageRoster && (
                                <td className="px-4 py-4 text-right">
                                  <button
                                    onClick={() => startEditingRow(entry)}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                                  >
                                    {entry.isDraft ? 'Assign day' : 'Edit row'}
                                  </button>
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Your month at a glance</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Every day you appear on this roster is listed here, including assistant duty.
            </p>

            <div className="mt-4 space-y-3">
              {rosterData?.myAssignments?.length ? (
                rosterData.myAssignments.map((assignment) => (
                  <div key={`${assignment.rosterDate}-${assignment.role}`} className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 dark:border-slate-700 dark:bg-slate-800/80">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{assignment.role}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatLongDate(assignment.rosterDate)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{assignment.note}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  You are not yet assigned on this month’s {selectedTabDescription.label.toLowerCase()} roster.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Fairness tracker</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Automatic generation keeps appearances as even as possible across the teaching staff.
            </p>
            <div className="mt-4 space-y-3">
              {topAssignments.length > 0 ? (
                topAssignments.map((staff) => (
                  <div key={staff.userId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{staff.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {staff.classNames.length > 0 ? staff.classNames.join(', ') : 'No class teacher conflict on file'}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {staff.assignmentCount} times
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Generate a roster to see the monthly duty balance.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Reference rules applied</h3>
            <ul className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex gap-2"><CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" /> Monthly roster covers every required weekday for the selected duty type.</li>
              <li className="flex gap-2"><CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" /> Assignment generation balances total duty appearances across teaching staff.</li>
              <li className="flex gap-2"><CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" /> Staff paired for the same class are blocked by default unless school policy allows otherwise.</li>
              <li className="flex gap-2"><CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" /> Teachers and staff always see the full month and their own duty days on the right.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)]">
        {canSubmitReport ? (
          <form onSubmit={handleSubmitReport} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-700 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Smart duty report form</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Submit your duty notes after the shift. AI review helps tighten the summary before final submission.</p>
              </div>
              <button
                type="button"
                onClick={handleAIReview}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
              >
                <Sparkles size={16} /> AI Review
              </button>
            </div>

            {aiAnalysis && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                <h3 className="mb-2 flex items-center gap-2 font-semibold"><CheckCircle size={16} /> AI feedback</h3>
                <p>{aiAnalysis.feedback || aiAnalysis.summary || 'AI review is ready.'}</p>
                <p className="mt-2 text-xs opacity-80">Tone: {aiAnalysis.tone || 'Professional'} • Coverage: {aiAnalysis.coverage_score ?? '—'}/10</p>
              </div>
            )}

            <div className="space-y-4">
              {SECTIONS.map((section) => (
                <div key={section.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="font-medium text-slate-800 dark:text-slate-100">{section.label}</label>
                    <button
                      type="button"
                      onClick={() => handleVoiceToText(section.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <Mic size={14} /> Voice to text
                    </button>
                  </div>
                  <textarea
                    value={formData[section.id] || ''}
                    onChange={(event) => handleTextChange(section.id, event.target.value)}
                    placeholder="Write the duty observations for this section..."
                    className="min-h-22.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
                  />
                </div>
              ))}
            </div>

            {reportMessage && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${reportMessage.toLowerCase().includes('success') ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200'}`}>
                {reportMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={reportSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} /> {reportSubmitting ? 'Submitting...' : 'Submit duty report'}
            </button>
          </form>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Roster management access</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              HoS, Owner, ICT Manager, and School Admin can create monthly rosters here. Teaching staff can see the entire month and submit reports after serving duty.
            </p>
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
              Use the auto-generation button to create a balanced month instantly, then edit any day manually if the school needs exceptions.
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent duty reports</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {canManageRoster ? 'Managers can review all submissions.' : 'You can review your recent submissions here.'}
              </p>
            </div>
          </div>

          {reportsLoading ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No duty reports have been submitted yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {reports.map((report) => (
                <div key={report.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{report.staff_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(report.date).toLocaleDateString()}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${String(report.status || 'pending').toLowerCase() === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'}`}>
                      {String(report.status || 'pending').toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {Object.entries(report.report_data || {}).map(([key, value]) => (
                      value ? (
                        <div key={key}>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{key.replace(/_/g, ' ')}:</span>{' '}
                          <span>{String(value)}</span>
                        </div>
                      ) : null
                    ))}
                  </div>

                  {report.ai_analysis && (
                    <div className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-xs text-purple-700 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-200">
                      <strong>AI:</strong> {report.ai_analysis.feedback || report.ai_analysis.summary || 'Feedback available.'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!canManageRoster && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>
              You are seeing the full monthly roster exactly as published by the school leadership team. Your right-hand summary shows every day you are on duty, whether as lead or assistant.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
