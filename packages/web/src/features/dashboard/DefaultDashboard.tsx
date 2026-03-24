import React from 'react';
import { DashboardShell } from './DashboardShell';
import { StatGrid } from './StatGrid';
import type { DashboardCommonProps } from './types';

export function DefaultDashboard({ currentUser, role, stats }: DashboardCommonProps) {
  return (
    <DashboardShell title={`Welcome back, ${currentUser?.name || role}`} subtitle="Here's what's happening at Ndovera Academy today.">
      <StatGrid stats={stats} />
    </DashboardShell>
  );
}