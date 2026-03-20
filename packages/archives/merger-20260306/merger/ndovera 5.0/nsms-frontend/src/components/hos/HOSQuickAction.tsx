import React from 'react';

interface HOSQuickActionProps {
  label: string;
  onClick?: () => void;
}

const HOSQuickAction: React.FC<HOSQuickActionProps> = ({ label, onClick }) => {
  return (
    <button type="button" className="quick-action" onClick={onClick}>
      {label}
    </button>
  );
};

export default HOSQuickAction;
