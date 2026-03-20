import React from 'react';
import DarkLightToggle from './DarkLightToggle';
import MultiLanguageSelector from './MultiLanguageSelector';

interface TopBarProps {
  onToggleSidebar?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  return (
    <div className="topbar">
      <div className="topbar-left">
        {onToggleSidebar && (
          <button type="button" className="chip-button" onClick={onToggleSidebar}>
            ☰
          </button>
        )}
        <div className="logo">Ndovera NSMS</div>
      </div>
      <div className="topbar-actions">
        <MultiLanguageSelector />
        <DarkLightToggle />
      </div>
    </div>
  );
};

export default TopBar;
