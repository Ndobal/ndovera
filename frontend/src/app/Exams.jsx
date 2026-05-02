import React from 'react';
import { Link } from 'react-router-dom';
import CommandPageShell from '../shared/components/CommandPageShell';

export default function Exams() {
  return (
    <>
      <CommandPageShell
        section="Assessment Engine"
        title="Exams"
        description="Take online exams, view results, and access practice CBTs here."
        chips={[
          { label: 'CBT Mode', accent: 'accent-indigo' },
          { label: 'Live Now', accent: 'accent-rose' },
          { label: 'Results', accent: 'accent-emerald' },
        ]}
      />

      <div className="p-6">
        <Link to="/exams/create" className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">
          Create New Exam
        </Link>
      </div>
    </>
  );
}
