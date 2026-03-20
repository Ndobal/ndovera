import React from 'react';

import { NdoveraMessagingPanel } from '../../classroom/components/NdoveraMessagingPanel';

export default function MessagingModule({ role }: { role?: string }) {
  return (
    <div className="min-h-[calc(100vh-14rem)] overflow-hidden rounded-4xl border border-white/5 bg-[#020617] shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
      <NdoveraMessagingPanel role={role || 'School Admin'} />
    </div>
  );
}
