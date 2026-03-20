import React, { useEffect, useState } from 'react';
import api from '../api/backend';

interface TableCardProps {
  title: string;
  endpoint?: string;
}

const TableCard: React.FC<TableCardProps> = ({ title, endpoint }) => {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!endpoint) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<Record<string, unknown>[]>(endpoint);
        if (mounted) setRows(data);
      } catch (err) {
        if (mounted) setError((err as Error).message);
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
      {loading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-muted">Unable to load data yet.</p>}
      {!loading && !error && rows.length === 0 && <p className="text-muted">No records available.</p>}
      {!loading && !error && rows.length > 0 && (
        <div className="table-scroll">
          <table className="simple-table">
            <thead>
              <tr>
                {Object.keys(rows[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {Object.values(row).map((value, idx) => (
                    <td key={`${title}-${index}-${idx}`}>{String(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TableCard;
