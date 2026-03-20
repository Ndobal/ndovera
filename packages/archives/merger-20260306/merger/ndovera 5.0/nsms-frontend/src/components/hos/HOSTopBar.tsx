import React from 'react';
import DarkLightToggle from '../DarkLightToggle';
import MultiLanguageSelector from '../MultiLanguageSelector';

interface HOSTopBarProps {
  onToggleSidebar?: () => void;
}

const HOSTopBar: React.FC<HOSTopBarProps> = ({ onToggleSidebar }) => {
  return (
    <div className="hos-topbar">
      <div className="hos-topbar-left">
        {onToggleSidebar && (
          <button type="button" className="chip-button" onClick={onToggleSidebar}>
            ☰
          </button>
        )}
        <div className="hos-topbar-title">Head of School — Command Center</div>
      </div>
      <div className="hos-topbar-actions">
        <MultiLanguageSelector />
        <DarkLightToggle />
      </div>
    </div>
  );
};

export default HOSTopBar;
