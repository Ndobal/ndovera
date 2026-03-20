import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSTuckShop: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Tuck Shop">
        <p className="text-muted">Daily sales, inventory, and pricing approvals.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-4">
          <h3 className="card-title">Daily Sales</h3>
          <ul className="card-list">
            <li>Today: ₦128,400</li>
            <li>Avg per student: ₦320</li>
            <li>Top seller: Lunch packs</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Inventory Watch</h3>
          <p className="text-muted">Low stock alerts and replenishment requests.</p>
        </div>
        <div className="card card-tone-3">
          <h3 className="card-title">Pricing Requests</h3>
          <ul className="card-list">
            <li>3 price updates pending</li>
            <li>1 discount approval needed</li>
            <li>Next review: Friday</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSTuckShop;
