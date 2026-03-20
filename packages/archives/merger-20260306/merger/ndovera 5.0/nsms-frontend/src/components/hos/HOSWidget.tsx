import React from 'react';

interface HOSWidgetProps {
  title: string;
  value: number | string | undefined;
  subtitle?: string;
}

const HOSWidget: React.FC<HOSWidgetProps> = ({ title, value, subtitle }) => {
  return (
    <div className="card hos-widget">
      <div className="small-label">{title}</div>
      <div className="hos-widget-value">{value ?? '—'}</div>
      {subtitle && <div className="text-muted">{subtitle}</div>}
    </div>
  );
};

export default HOSWidget;
