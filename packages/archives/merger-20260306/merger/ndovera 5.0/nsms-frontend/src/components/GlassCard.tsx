import React from 'react';

interface GlassCardProps {
  title?: string;
  children: React.ReactNode;
}

const GlassCard: React.FC<GlassCardProps> = ({ title, children }) => {
  return (
    <section className="glass-card">
      <div className="glass-card-inner">
        {title && <h2 className="glass-card-title">{title}</h2>}
        {children}
      </div>
    </section>
  );
};

export default GlassCard;
