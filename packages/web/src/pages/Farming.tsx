import React from 'react';

import FarmingModeModule from '../features/farming/components/FarmingModeModule';

export const FarmingView = ({ role }: { role?: string }) => {
  return (
    <FarmingModeModule role={role} />
  );
};
