import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '../services/apiClient';

export function useData<T>(url: string, options?: { enabled?: boolean }) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const enabled = options?.enabled ?? true;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      const result = await fetchWithAuth(url);
      setData(result);
      setError(null);
    } catch (err) {
      const status = typeof err === 'object' && err && 'status' in err ? Number((err as any).status) : undefined;
      if (status === 401) {
        setData(null);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
