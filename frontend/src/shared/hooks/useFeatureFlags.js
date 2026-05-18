import { useEffect, useState } from 'react';
import { getFeatureFlags } from '../../features/school/services/schoolApi';

export const DEFAULT_FEATURE_FLAGS = {
  aurasEnabled: false,
  farmingModeEnabled: false,
};

export default function useFeatureFlags() {
  const [featureFlags, setFeatureFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getFeatureFlags()
      .then(data => {
        if (!active) return;
        setFeatureFlags({
          ...DEFAULT_FEATURE_FLAGS,
          ...(data?.featureFlags || {}),
        });
      })
      .catch(() => {
        if (!active) return;
        setFeatureFlags(DEFAULT_FEATURE_FLAGS);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { featureFlags, loading };
}