import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSuccess = auth => {
    onLogin?.(auth);
    if (auth.user?.mustChangePassword === true) {
      navigate('/change-password', { replace: true, state: { auth } });
      return;
    }
    const targetPath = location.state?.from && location.state.from !== '/login'
      ? location.state.from
      : `/roles/${auth.user?.role || 'student'}`;
    navigate(targetPath, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_52%,#ecfdf5_100%)] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_28px_100px_rgba(15,23,42,0.12)] lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[0.96fr_1.04fr]">
        <section className="relative min-h-[280px] overflow-hidden lg:min-h-full">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={process.env.PUBLIC_URL + '/login-vid.mp4'}
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(15,23,42,0.78),rgba(15,23,42,0.42),rgba(5,150,105,0.46))]" />
          <div className="relative flex h-full flex-col justify-between p-6 sm:p-8 lg:p-10 text-white">
            <div className="inline-flex w-fit rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-100 backdrop-blur-sm">
              Secure School Operations
            </div>

            <div className="max-w-lg space-y-4 pb-2 lg:pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-100/90">Welcome To NDOVERA</p>
              <h1 className="text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-[3.35rem]">
                Powering School Management With Clarity And Control.
              </h1>
              <p className="max-w-md text-sm leading-7 text-slate-100/90 sm:text-base">
                Sign in to access your dashboard, review live school activity, and continue work from exactly where you stopped.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-6 sm:px-8 lg:px-10">
          <div className="w-full max-w-md space-y-5">
            <div className="flex items-center gap-4">
              <img
                src={process.env.PUBLIC_URL + '/android-chrome-192x192.png'}
                alt="Ndovera Logo"
                className="h-14 w-14 rounded-2xl border border-emerald-100 bg-white p-1 shadow-[0_16px_32px_rgba(5,150,105,0.12)] sm:h-16 sm:w-16"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-700">NDOVERA</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Portal Login</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Use your assigned email and password to continue securely.</p>
              </div>
            </div>

            <LoginForm onSuccess={handleSuccess} />
          </div>
        </section>
      </div>
    </div>
  );
}
