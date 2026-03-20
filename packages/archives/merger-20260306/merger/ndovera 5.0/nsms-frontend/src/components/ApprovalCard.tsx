import React from 'react';

interface ApprovalCardProps {
  title: string;
  approvals: Array<{ id: string; title: string; status: string }>;
}

const ApprovalCard: React.FC<ApprovalCardProps> = ({ title, approvals }) => {
  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
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

export default ApprovalCard;
