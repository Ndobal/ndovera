// Simple ad component for display
import React from 'react';

export function AdBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="w-full bg-yellow-100 border border-yellow-400 text-yellow-800 p-2 text-center rounded mb-2">
      <strong>Sponsored:</strong> Try Aura Booster for enhanced learning!
    </div>
  );
}
