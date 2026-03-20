import React from 'react';
import { AuraBoosterMode } from '../features/economy/components/AuraBoosterMode';

export const AuraBoosterView = ({ role }: { role: string }) => {
  return (
    <div className="w-full h-full p-4 lg:p-6 pb-20">
      <AuraBoosterMode role={role} />
    </div>
  );
};