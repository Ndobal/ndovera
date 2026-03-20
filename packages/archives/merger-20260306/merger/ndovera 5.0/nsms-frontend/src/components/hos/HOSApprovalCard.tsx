import React from 'react';

interface ApprovalItem {
  id: string;
  title: string;
  status: string;
}

interface HOSApprovalCardProps {
  approvals?: ApprovalItem[];
}

const defaultApprovals: ApprovalItem[] = [
  { id: 'hos-1', title: 'Student admission — Grade 6', status: 'Pending' },
  { id: 'hos-2', title: 'Staff onboarding — Security', status: 'Review' },
  { id: 'hos-3', title: 'Fee waiver — Term 2', status: 'Pending' },
];

const HOSApprovalCard: React.FC<HOSApprovalCardProps> = ({ approvals = defaultApprovals }) => {
  return (
    <div className="card">
      <h3 className="card-title">HOS Approval Center</h3>
      {approvals.length === 0 ? (
        <p className="text-muted">No approvals pending.</p>
      ) : (
        <ul className="approval-list">
          {approvals.map((item) => (
            <li key={item.id} className="approval-item">
              <div>
                <strong>{item.title}</strong>
                <div className="text-muted">Status: {item.status}</div>
              </div>
              <button type="button" className="chip-button">
                Review
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default HOSApprovalCard;
