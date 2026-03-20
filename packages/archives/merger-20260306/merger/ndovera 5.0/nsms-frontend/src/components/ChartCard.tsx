import React, { useEffect, useState } from 'react';
import api from '../api/backend';

interface ChartCardProps {
  title: string;
  type: 'line' | 'bar' | 'pie';
  endpoint?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, type, endpoint }) => {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!endpoint) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const data = await api.get<Record<string, unknown>>(endpoint);
        if (mounted) setPayload(data);
      } catch {
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [endpoint]);

  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      <p className="text-muted">Chart type: {type}</p>
      {loading && <p className="text-muted">Loading chart…</p>}
      {error && <p className="text-muted">Awaiting analytics feed.</p>}
      {!loading && !error && payload && (
        <pre className="chart-preview">{JSON.stringify(payload, null, 2)}</pre>
      )}
      {!loading && !error && !payload && <p className="text-muted">Connect analytics endpoint to render chart.</p>}
    </div>
  );
};

export default ChartCard;
