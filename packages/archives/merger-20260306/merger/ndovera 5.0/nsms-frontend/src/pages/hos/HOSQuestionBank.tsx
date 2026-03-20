import React, { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';
import api from '../../api/backend';

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

const HOSQuestionBank: React.FC = () => {
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
    <div className="hos-page">
      <GlassCard title="HOS Question Bank Control">
        <p className="text-muted">Final approval for high-stakes assessment content and exam templates.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Approval Queue</h3>
          <ul className="card-list">
            <li>Pending review: {stats.pending_review}</li>
            <li>Drafts awaiting endorsement: {stats.drafts}</li>
            <li>Approved questions: {stats.approved}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Paper Generation</h3>
          <ul className="card-list">
            <li>Blueprints: {stats.blueprints}</li>
            <li>Papers ready: {stats.papers_ready}</li>
            <li>Randomization: Active</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Security</h3>
          <ul className="card-list">
            <li>Anti-leak controls enabled</li>
            <li>Offline packs enabled</li>
            <li>Audit trail locked</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Question Library" endpoint="/question-bank/questions" />
        <HOSTable title="Blueprints" endpoint="/question-bank/blueprints" />
        <HOSTable title="Exam Papers" endpoint="/question-bank/papers" />
      </div>
    </div>
  );
};

export default HOSQuestionBank;
