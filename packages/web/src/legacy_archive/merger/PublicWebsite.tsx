import React from 'react';
import BrandLogo from './BrandLogo';

export default function PublicWebsite({ site }: { site?: any }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="bg-emerald-600 text-white p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size={44} />
          <div>
            <h1 className="font-bold">{site?.title ?? 'NDOVERA International School'}</h1>
            <p className="text-sm opacity-80">{site?.subtitle ?? 'Shaping leaders of tomorrow'}</p>
          </div>
        </div>
        <nav className="hidden md:flex gap-6">
          <a href="#" className="hover:underline">Home</a>
          <a href="#" className="hover:underline">About</a>
          <a href="#" className="hover:underline">Admissions</a>
          <a href="#" className="hover:underline">Contact</a>
        </nav>
      </header>

      <main className="p-8">
        <section className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-2">Welcome</h2>
          <p className="text-slate-600">{site?.welcome ?? 'Welcome to NDOVERA — excellence in teaching and learning.'}</p>
        </section>
      </main>

      <footer className="bg-slate-50 p-6 mt-12 text-sm text-slate-600">
        <div className="max-w-4xl mx-auto">© NDOVERA International School — All rights reserved</div>
      </footer>
    </div>
  );
}
