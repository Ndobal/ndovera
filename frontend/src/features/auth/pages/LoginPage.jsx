import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSuccess = auth => {
    onLogin?.(auth);
    const targetPath = location.state?.from && location.state.from !== '/login'
      ? location.state.from
      : `/roles/${auth.user?.role || 'student'}`;
    navigate(targetPath, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#b5e3f4_0%,#fff4df_48%,#b5e3f4_100%)] px-4 py-4 text-[#191970] sm:px-6 sm:py-6 lg:px-8 dark:bg-[linear-gradient(180deg,#140014_0%,#1f0020_100%)] dark:text-[#39ff14]">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-[#c9a96e]/45 bg-[#fff4df] shadow-[0_28px_100px_rgba(128,0,0,0.18)] lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[0.96fr_1.04fr] dark:border-[#bf00ff]/35 dark:bg-[#800000]/40 dark:backdrop-blur-xl">
        <section className="relative min-h-[280px] overflow-hidden lg:min-h-full">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={process.env.PUBLIC_URL + '/login-vid.mp4'}
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(128,0,0,0.78),rgba(25,25,112,0.52),rgba(26,92,56,0.5))] dark:bg-[linear-gradient(160deg,rgba(0,0,0,0.4),rgba(128,0,0,0.65),rgba(0,0,255,0.4))]" />
          <div className="relative flex h-full flex-col justify-between p-6 sm:p-8 lg:p-10 text-white">
            <div className="inline-flex w-fit rounded-full border border-[#b5e3f4]/35 bg-[#800000]/45 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#b5e3f4] backdrop-blur-sm dark:border-[#00ffff]/30 dark:bg-[#000000]/40 dark:text-[#00ffff]">
              Secure School Operations
            </div>

            <div className="max-w-lg space-y-4 pb-2 lg:pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#b5e3f4]">Welcome To NDOVERA</p>
              <h1 className="text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-[3.35rem]">
                Powering School Management With Clarity And Control.
              </h1>
              <p className="max-w-md text-sm leading-7 text-[#b5e3f4] sm:text-base">
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
                className="h-14 w-14 rounded-2xl border border-[#c9a96e]/60 bg-[#fff4df] p-1 shadow-[0_16px_32px_rgba(128,0,0,0.14)] sm:h-16 sm:w-16"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#800020] dark:text-[#bf00ff]">NDOVERA</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-[#800000] dark:text-[#0000ff]">Portal Login</h2>
                <p className="mt-1 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">Use your assigned email and password to continue securely.</p>
              </div>
            </div>

            <LoginForm onSuccess={handleSuccess} />
          </div>
        </section>
      </div>
    </div>
  );
}
