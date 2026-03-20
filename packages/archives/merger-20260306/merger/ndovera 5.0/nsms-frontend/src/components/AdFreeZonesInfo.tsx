import React, { useState } from 'react';
import { getAdFreeZonesList, formatZoneName } from '../utils/adUtils';

/**
 * AdFreeZonesInfo Component
 * Displays the global ad-free zones configuration
 * Shows which pages and features are protected from ads
 */
export const AdFreeZonesInfo: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const adFreeZones = getAdFreeZonesList();

  return (
    <div className="ad-free-zones-info">
      <div className="info-header">
        <h3>🚫 Ad-Free Zones (Global Rules)</h3>
        <p className="info-subtitle">These areas are protected from ads to ensure focus and compliance</p>
      </div>

      <div className="zones-summary">
        <p className="zone-count">
          <strong>{adFreeZones.length}</strong> ad-free zones protected
        </p>
        <button
          type="button"
          className="toggle-details"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {showDetails && (
        <div className="zones-list">
          {adFreeZones.map((zone) => (
            <div key={zone} className="zone-item">
              <span className="zone-icon">❌</span>
              <span className="zone-name">{formatZoneName(zone)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="info-notes">
        <p className="note">
          <strong>Note:</strong> Ad-free zones are configured globally and cannot be disabled.
          These protected areas include exams, assessments, financial transactions, and other
          sensitive features.
        </p>
      </div>
    </div>
  );
};

/**
 * AdZonesOverviewTable Component
 * Table view of ad-free zones for admin dashboard
 */
export const AdZonesOverviewTable: React.FC = () => {
  const adFreeZones = getAdFreeZonesList();

  const zoneCategories = {
    'Learning': ['cbt', 'exams', 'practice-corner', 'ai-study', 'assignments', 'library-reading'],
    'Assessment': ['exams', 'results'],
    'Communication': ['messaging', 'voting', 'civic-centre'],
    'Financial': ['payments', 'cashouts', 'financial-pages'],
    'Media': ['video-streams'],
    'Account': ['profile-editing'],
  };

  return (
    <div className="ad-zones-table">
      <h3>Ad-Free Zones Configuration</h3>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Zone</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(zoneCategories).map(([category, zones]) =>
            zones.map((zone, idx) => (
              <tr key={`${category}-${zone}`}>
                {idx === 0 && <td rowSpan={zones.length}><strong>{category}</strong></td>}
                <td>{formatZoneName(zone)}</td>
                <td>
                  <span className="status-badge protected">Protected</span>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdFreeZonesInfo;
