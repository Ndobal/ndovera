import React from 'react';
import GlassCard from '../components/GlassCard';
import { useI18n } from '../context/I18nContext';

const SignupPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <GlassCard title={t('signup')}>
      <div className="form-stack">
        <div className="form-field">
          <label htmlFor="school">School / Organization</label>
          <input id="school" type="text" placeholder="Ndovera Academy" />
        </div>
        <div className="form-field">
          <label htmlFor="ownerEmail">Owner email</label>
          <input id="ownerEmail" type="email" placeholder="owner@example.com" />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" placeholder="••••••••" />
        </div>
        <button type="button" className="form-primary-button">
          {t('signup')}
        </button>
        <p className="text-muted">Signup and Ndovera approval will be wired to the backend.</p>
      </div>
    </GlassCard>
  );
};

export default SignupPage;
