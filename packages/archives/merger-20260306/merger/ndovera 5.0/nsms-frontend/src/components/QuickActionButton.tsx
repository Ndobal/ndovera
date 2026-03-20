import React from 'react';

interface QuickActionButtonProps {
  label: string;
  onClick?: () => void;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({ label, onClick }) => {
  return (
    <button type="button" className="quick-action" onClick={onClick}>
      {label}
    </button>
  );
};

export default QuickActionButton;
