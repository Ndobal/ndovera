import type React from 'react';
import type { Role } from '../../types';

export type DashboardStat = {
  label: string;
  value: string | number;
  change: string;
  icon?: React.ReactNode;
  color?: string;
  bg?: string;
};

export type DashboardCommonProps = {
  role: Role;
  currentUser?: { name?: string } | null;
  stats: DashboardStat[];
  setActiveTab?: (tab: string) => void;
  announcements?: any[];
  liveClassData?: any[];
  financeStats?: any;
  students?: any[];
  teachers?: any[];
  children?: any[];
  dashboardSummary?: any;
  studentSummary?: any;
  teacherSummary?: any;
  genericSummary?: any;
};