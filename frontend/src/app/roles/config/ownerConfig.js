const ownerConfig = {
  roleTitle: 'Owner Dashboard',
  watermark: 'OWNER',
  sections: {
    overview: {
      title: 'Overview',
      subtitle: 'See school growth, finances, and operations at a glance.',
      cards: [
        { label: 'Total Students', value: '2,418', accent: 'accent-indigo' },
        { label: 'Collection Rate', value: '89%', accent: 'accent-emerald' },
        { label: 'Staff Count', value: '168', accent: 'accent-amber' },
        { label: 'Open Risks', value: '4', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Executive Watch', items: [{ text: 'Monitor weak schools and classes.', tag: 'Priority', accent: 'accent-rose' }, { text: 'Track monthly finance health.', tag: 'Finance', accent: 'accent-emerald' }, { text: 'Review unresolved compliance issues.', tag: 'Risk', accent: 'accent-amber' }] },
        { title: 'Decision Support', items: [{ text: 'Use this dashboard for fast decision making.' }, { text: 'Check trends before policy changes.' }, { text: 'Share approved updates with HoS.' }] },
      ],
    },
    schools: { title: 'Schools & Campuses', subtitle: 'View campus-level performance and status.', panels: [{ title: 'Campus View', items: [{ text: 'Track each campus health score.' }, { text: 'Compare enrollment and outcomes.' }, { text: 'Highlight underperforming units.' }] }] },
    finance: { title: 'Finance Health', subtitle: 'Review global finance status and risk.', panels: [{ title: 'Finance Snapshot', items: [{ text: 'See income, costs, and margin trends.' }, { text: 'Track debt and collection rate.' }, { text: 'Review monthly variance.' }] }] },
    academics: { title: 'Academic Quality', subtitle: 'Track school-wide learning outcomes.', panels: [{ title: 'Academic Quality', items: [{ text: 'View pass rates by term.' }, { text: 'Track subject performance spread.' }, { text: 'Spot declining performance early.' }] }] },
    people: { title: 'People & Staffing', subtitle: 'Monitor staff strength and deployment.', panels: [{ title: 'Staff Metrics', items: [{ text: 'View staff count by role.' }, { text: 'Track retention and attendance.' }, { text: 'Identify staffing gaps.' }] }] },
    compliance: { title: 'Compliance & Risk', subtitle: 'Monitor policy compliance and open risks.', panels: [{ title: 'Risk Controls', items: [{ text: 'View unresolved compliance items.' }, { text: 'Track policy acceptance rates.' }, { text: 'Review security incident summary.' }] }] },
    approvals: { title: 'Executive Approvals', subtitle: 'Handle high-level approvals quickly.', panels: [{ title: 'Approval Desk', items: [{ text: 'Approve strategic requests.' }, { text: 'Review high-cost spending items.' }, { text: 'Escalate blocked requests.' }] }] },
    reports: { title: 'Reports', subtitle: 'Generate board-ready reports and summaries.', panels: [{ title: 'Executive Reports', items: [{ text: 'Monthly board pack export.' }, { text: 'Finance and operations roll-up.' }, { text: 'Academic summary by campus.' }] }] },
    settings: { title: 'Profile & Security', subtitle: 'Manage executive access and account safety.', panels: [{ title: 'Security', items: [{ text: 'Set strong account controls.' }, { text: 'Review active sessions and devices.' }, { text: 'Manage alert channels.' }] }] },
  },
};

export default ownerConfig;
