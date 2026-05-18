import React, { useEffect, useState } from 'react';
import StudentSectionShell from './StudentSectionShell';
import { getStudentResult } from '../../../features/results-engine';
import ResultRecordViewer from '../../../features/results-engine/components/ResultRecordViewer';

export default function StudentResults() {
  const [result, setResult] = useState({ publications: [], documents: [], students: [], activeRecord: null, feeStatus: '', lockedByFees: false });
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadResult() {
      setLoading(true);
      setError('');
      try {
        const nextResult = await getStudentResult();
        if (cancelled) return;
        setResult(nextResult);
        setSelectedRecordId(nextResult.activeRecord?.id || '');
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Unable to load student result records.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadResult();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StudentSectionShell title="Results" subtitle="See your scores and track your progress.">
      <div className="space-y-4">
        {error && <section className="glass-surface rounded-3xl p-6 text-sm text-rose-100 border border-rose-300/30 bg-rose-500/20">{error}</section>}
        {loading && <section className="glass-surface rounded-3xl p-6 text-slate-200">Loading your published results...</section>}

        {!loading && (
          <ResultRecordViewer
            students={result.students}
            activeStudentId={result.activeStudentId}
            records={result.publications}
            selectedRecordId={selectedRecordId}
            onSelectRecord={setSelectedRecordId}
            documents={result.documents}
            lockedByFees={result.lockedByFees}
            feeStatus={result.feeStatus}
            emptyMessage="Your result history will appear here after the school publishes approved records for your account."
          />
        )}
      </div>
    </StudentSectionShell>
  );
}
