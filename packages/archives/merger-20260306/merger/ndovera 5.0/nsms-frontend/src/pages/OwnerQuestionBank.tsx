import React, { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import TableCard from '../components/TableCard';
import api from '../api/backend';

interface QuestionBankStats {
  total_questions: number;
  drafts: number;
  approved: number;
  blueprints: number;
  papers_ready: number;
  pending_review: number;
}

const fallbackStats: QuestionBankStats = {
  total_questions: 0,
  drafts: 0,
  approved: 0,
  blueprints: 0,
  papers_ready: 0,
  pending_review: 0,
};

const OwnerQuestionBank: React.FC = () => {
  const [stats, setStats] = useState<QuestionBankStats>(fallbackStats);

  useEffect(() => {
    let mounted = true;
    api
      .get<QuestionBankStats>('/question-bank/dashboard-stats')
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setStats(fallbackStats));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="dashboard-page">
      <GlassCard title="Question Bank Governance">
        <p className="text-muted">
          Blueprint-driven assessment engine with role-based security, anti-leak controls, and offline exam packs.
        </p>
      </GlassCard>
      <div className="owner-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Question Library</h3>
          <ul className="card-list">
            <li>Total questions: {stats.total_questions}</li>
            <li>Drafts: {stats.drafts}</li>
            <li>Pending review: {stats.pending_review}</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Blueprints & Papers</h3>
          <ul className="card-list">
            <li>Blueprints: {stats.blueprints}</li>
            <li>Papers ready: {stats.papers_ready}</li>
            <li>Approved questions: {stats.approved}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Security</h3>
          <ul className="card-list">
            <li>Randomization engine: Enabled</li>
            <li>Offline packs: Supported</li>
            <li>Audit log: Active</li>
          </ul>
        </div>
      </div>
      <div className="tables-row">
        <TableCard title="Questions" endpoint="/question-bank/questions" />
        <TableCard title="Blueprint Templates" endpoint="/question-bank/blueprints" />
        <TableCard title="Generated Papers" endpoint="/question-bank/papers" />
      </div>
    </div>
  );
};

export default OwnerQuestionBank;
