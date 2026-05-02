const accountantConfig = {
  roleTitle: 'Accountant Dashboard',
  watermark: 'ACCOUNTANT',
  sections: {
    overview: {
      title: 'Overview',
      subtitle: 'Control school income, expenses, and finance health.',
      cards: [
        { label: 'Today Income', value: '₦1.2M', accent: 'accent-emerald' },
        { label: 'Pending Approvals', value: '7', accent: 'accent-amber' },
        { label: 'Overdue Balances', value: '19', accent: 'accent-rose' },
        { label: 'Reconciled', value: '94%', accent: 'accent-indigo' },
      ],
      panels: [
        { title: 'Finance Actions', items: [{ text: 'Approve verified payments.', tag: 'Pending', accent: 'accent-amber' }, { text: 'Resolve failed transactions.', tag: 'Urgent', accent: 'accent-rose' }, { text: 'Export daily reconciliation report.', tag: 'Today', accent: 'accent-indigo' }] },
        { title: 'Control Notes', items: [{ text: 'All finance changes are logged.' }, { text: 'Only finance roles can approve payments.' }, { text: 'Archived records are read-only.' }] },
      ],
    },
    fees: { title: 'Fee Management', subtitle: 'Manage tuition, transport, and other charges.', panels: [{ title: 'Fee Controls', items: [{ text: 'Create and update fee items.' }, { text: 'Set due dates and penalties.' }, { text: 'Track payment status clearly.' }] }] },
    receipts: { title: 'Receipts', subtitle: 'View and issue receipts for approved payments.', panels: [{ title: 'Receipt Rules', items: [{ text: 'Receipts are auto-generated after approval.' }, { text: 'Receipts cannot be deleted.' }, { text: 'Parents can download from their portal.' }] }] },
    expenses: { title: 'Expenses', subtitle: 'Track school spending and approvals.', panels: [{ title: 'Expense Flow', items: [{ text: 'Submit and review expense requests.' }, { text: 'Approve based on role policy.' }, { text: 'Archive approved records safely.' }] }] },
    payroll: { title: 'Payroll', subtitle: 'Process staff salary and payroll reports.', panels: [{ title: 'Payroll Steps', items: [{ text: 'Review staff salary list.' }, { text: 'Apply approved deductions.' }, { text: 'Release payroll summary.' }] }] },
    reconciliation: { title: 'Reconciliation', subtitle: 'Match bank records with platform transactions.', panels: [{ title: 'Reconcile', items: [{ text: 'Match incoming payment records.' }, { text: 'Flag mismatches for review.' }, { text: 'Close reconciled periods.' }] }] },
    'tuck-shop': { title: 'Tuck Shop Finance', subtitle: 'Monitor tuck shop sales and remittance.', panels: [{ title: 'Tuck Shop Finance', items: [{ text: 'Daily sales totals and settlement status.' }, { text: 'Wallet top-up logs.' }, { text: 'Variance report by day.' }] }] },
    auras: { title: 'Auras Transactions', subtitle: 'Review Auras purchase and transfer records.', panels: [{ title: 'Auras Ledger', items: [{ text: 'Track top-up and transfer activity.' }, { text: 'Check unusual transaction patterns.' }, { text: 'Export Auras audit logs.' }] }] },
    reports: { title: 'Finance Reports', subtitle: 'Generate finance reports for leadership.', panels: [{ title: 'Reports', items: [{ text: 'Income and expense summaries.' }, { text: 'Debtors and collection progress.' }, { text: 'Monthly finance statement exports.' }] }] },
    settings: { title: 'Profile & Security', subtitle: 'Manage account and finance access controls.', panels: [{ title: 'Security', items: [{ text: 'Update login credentials.' }, { text: 'Enable two-step sign-in.' }, { text: 'Review finance access logs.' }] }] },
  },
};

export default accountantConfig;
