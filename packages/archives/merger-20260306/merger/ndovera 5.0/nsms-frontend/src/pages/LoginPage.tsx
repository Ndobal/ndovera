import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import { useI18n } from '../context/I18nContext';
import { login } from '../api/nsmsApi';

type JwtPayload = {
  id?: string;
  roles?: string | string[];
  school_id?: string;
};

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((payload.length + 3) % 4);
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getDashboardPathForRoles(roles: string | string[]): string {
  const list = Array.isArray(roles) ? roles : roles.split(/[\s,]+/);
  const normalized = list.map((r) => r.toLowerCase()).filter(Boolean);

  if (normalized.includes('owner')) return '/owner';
  if (normalized.includes('hos') || normalized.includes('head_of_school')) return '/hos';
  if (normalized.includes('teacher')) return '/teacher';
  if (normalized.includes('staff')) return '/staff';
  if (normalized.includes('student')) return '/student';
  if (normalized.includes('parent')) return '/parent';

  return '/login';
}

const LoginPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { token } = await login(email, password);
      localStorage.setItem('nsms_token', token);

      const payload = decodeJwt(token);
      if (payload?.roles) {
        const path = getDashboardPathForRoles(payload.roles);
        navigate(path, { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard title={t('login')}>
      <div className="form-stack">
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="form-primary-button"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Loading…' : t('login')}
        </button>
        {error && <p className="text-error">{error}</p>}
      </div>
    </GlassCard>
  );
};

export default LoginPage;
