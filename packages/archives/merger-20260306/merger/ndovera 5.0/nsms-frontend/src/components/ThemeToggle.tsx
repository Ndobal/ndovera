import React from 'react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button type="button" className="chip-button" onClick={toggleTheme}>
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: 999,
          background: theme === 'dark' ? '#22c55e' : '#0f172a',
        }}
      />
      <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
    </button>
  );
};

export default ThemeToggle;
