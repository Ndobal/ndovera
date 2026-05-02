import React from 'react';
import { useParams } from 'react-router-dom';
import CommandPageShell from '../shared/components/CommandPageShell';
import LibraryTab from '../features/library';

export default function Library(props) {
  const params = useParams();
  const role = params && params.role ? params.role : (props.user && props.user.role) || 'student';
  const user = props.user || { id: 'guest', schoolId: 'school-001', aura: 0, role };

  return (
    <CommandPageShell
      section="Knowledge Grid"
      title="Library"
      description="Browse NDOVERA and premium books, track your reading history, and access reference materials."
      chips={[
        { label: 'Catalog', accent: 'accent-indigo' },
        { label: 'Reading Progress', accent: 'accent-emerald' },
        { label: 'Due Soon', accent: 'accent-amber' },
      ]}
    >
      <div className="mt-6">
        <LibraryTab user={user} />
      </div>
    </CommandPageShell>
  );
}
