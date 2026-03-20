import React from 'react';

export default function BrandLogo({ className = '', size = 40, text = false }) {
  return (
    <div style={{ width: size, height: size }} className={`flex items-center ${className}`}>
      <img
        src="/ndovera logo.png"
        alt="NDOVERA Logo"
        style={{ width: size, height: size, objectFit: 'contain' }}
        className="rounded-xl shadow"
      />
      {text && (
        <span className="ml-2 font-bold text-xl tracking-tight text-slate-800 dark:text-slate-100">NDOVERA</span>
      )}
    </div>
  );
}
