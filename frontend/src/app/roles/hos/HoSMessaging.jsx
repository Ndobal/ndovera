import React from 'react';
import StudentMessaging from '../student/StudentMessaging';

// HoS uses the shared messaging workspace. Render it directly (no extra wrapper) so the
// chat fills the viewport and the composer stays pinned above the bottom navigation.
export default function HoSMessaging() {
  return (
    <StudentMessaging
      viewerRole="teacher"
      dashboardLabel="Head Of School"
      title="Messaging"
      subtitle="Send and receive messages with staff, parents, and teachers."
    />
  );
}
