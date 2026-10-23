import React from 'react';
import { useLocation } from 'react-router-dom';
import AmiFinancePage from './AmiFinancePage';
import AmiProfitLossPage from './AmiProfitLossPage';
import AmiShareholdersPage from './AmiShareholdersPage';

// A shareholder's pages, all read-only: Finance, Profit & Loss, and Shares & payouts.
export default function ShareholderHome() {
  const section = useLocation().pathname.split('/')[3] || '';
  if (section === 'profit-loss') return <AmiProfitLossPage readOnly />;
  if (section === 'shares') return <AmiShareholdersPage readOnly />;
  return <AmiFinancePage readOnly />;
}
