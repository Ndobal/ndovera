import React from 'react';

interface DashboardWidgetProps {
  title: string;
  value: number | string;
  subtitle?: string;
}

const DashboardWidget: React.FC<DashboardWidgetProps> = ({ title, value, subtitle }) => {
  return (
    <div className="card dashboard-widget">
      <div className="small-label">{title}</div>
      <div className="dashboard-widget-value">{value}</div>
      {subtitle && <div className="text-muted">{subtitle}</div>}
    </div>
  );
};

export default DashboardWidget;
