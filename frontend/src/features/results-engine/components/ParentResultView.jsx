import React, { useEffect, useState } from 'react';
import { getParentResult } from '../service/resultEngineService';
import ResultRecordViewer from './ResultRecordViewer';
import { readActiveParentChildId, writeActiveParentChildId } from '../../../app/roles/parent/parentChildSelection';

export default function ParentResultView() {
  const [result, setResult] = useState({ students: [], publications: [], documents: [], activeRecord: null, activeStudentId: '' });
  const [activeChildId, setActiveChildId] = useState(() => readActiveParentChildId());
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadResult() {
      setLoading(true);
      setError('');
      try {
        const nextResult = await getParentResult(activeChildId);
        if (cancelled) return;
        setResult(nextResult);
        setSelectedRecordId(nextResult.activeRecord?.id || '');
        if (nextResult.activeStudentId && nextResult.activeStudentId !== activeChildId) {
          writeActiveParentChildId(nextResult.activeStudentId);
          setActiveChildId(nextResult.activeStudentId);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Unable to load parent result records.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadResult();
    return () => {
      cancelled = true;
    };
  }, [activeChildId]);

  useEffect(() => {
    if (activeChildId) {
      writeActiveParentChildId(activeChildId);
    }
  }, [activeChildId]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className="glass-surface rounded-3xl p-6">
        <p className="micro-label neon-subtle">Parent Dashboard</p>
        <h1 className="text-3xl command-title neon-title">Results</h1>
        <p className="text-slate-300 mt-1">Official published records grouped by child, session, and term.</p>
      </section>

      {error && <section className="glass-surface rounded-3xl p-6 text-sm text-rose-100 border border-rose-300/30 bg-rose-500/20">{error}</section>}
      {loading && <section className="glass-surface rounded-3xl p-6 text-slate-200">Loading result records...</section>}

      {!loading && (
        <ResultRecordViewer
          students={result.students}
          activeStudentId={activeChildId || result.activeStudentId}
          onSelectStudent={(studentId) => {
            writeActiveParentChildId(studentId);
            setActiveChildId(studentId);
          }}
          records={result.publications}
          selectedRecordId={selectedRecordId}
          onSelectRecord={setSelectedRecordId}
          documents={result.documents}
          lockedByFees={result.lockedByFees}
          feeStatus={result.feeStatus}
          emptyMessage="Parent result access will appear here after the school publishes approved student results."
        />
      )}
    </div>
  );
}
