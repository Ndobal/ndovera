import React, { useCallback, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { getMyGrowthPartner } from '../../../features/public/services/publicSiteApi';
import PartnerShell from './PartnerShell';
import { CARD, BODY } from './partnerUi';
import {
  OverviewPage,
  ReferralsPage,
  EarningsPage,
  PricingPage,
  ToolkitPage,
  VerificationPage,
  BankPage,
  SecurityPage,
  ConversationsPage,
} from './PartnerPages';

export default function GrowthPartnerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      setData(await getMyGrowthPartner());
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load your partner dashboard.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#fff8ee] p-6 dark:bg-slate-950">
        <div className={`mx-auto max-w-2xl ${CARD}`}>
          <p className="text-sm font-semibold text-[#800020] dark:text-rose-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#fff8ee] p-6 dark:bg-slate-950">
        <div className={`mx-auto max-w-2xl ${CARD}`}><p className={BODY}>Loading your partner dashboard…</p></div>
      </div>
    );
  }

  return (
    <PartnerShell partnerName={data.partner?.name} unreadCount={unread}>
      <Routes>
        <Route index element={<OverviewPage data={data} reload={load} />} />
        <Route path="referrals" element={<ReferralsPage data={data} reload={load} />} />
        <Route path="earnings" element={<EarningsPage data={data} reload={load} />} />
        <Route path="pricing" element={<PricingPage data={data} reload={load} />} />
        <Route path="toolkit" element={<ToolkitPage data={data} />} />
        <Route path="verification" element={<VerificationPage data={data} reload={load} />} />
        <Route path="bank" element={<BankPage data={data} reload={load} />} />
        <Route path="security" element={<SecurityPage />} />
        <Route
          path="messages"
          element={(
            <ConversationsPage
              kind="school"
              title="Messages"
              subtitle="Talk to the owner, head of school and ICT team at each school you referred. Ami is in every thread."
              onUnreadChange={setUnread}
            />
          )}
        />
        <Route
          path="community"
          element={(
            <ConversationsPage
              kind="community"
              title="Growth Partner Community"
              subtitle="Announcements from Ami and discussion with every other growth partner."
            />
          )}
        />
      </Routes>
    </PartnerShell>
  );
}
