import React from 'react';

export default function BrandLogo({ size = 40 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-md bg-emerald-600 text-white font-bold">
      N
    </div>
  );
}
