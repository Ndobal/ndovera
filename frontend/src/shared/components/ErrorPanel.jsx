import React from 'react';

export default function ErrorPanel({ title = 'Error', message, onClose }) {
  if (!message) return null;
  return (
    <div className="bg-rose-900/80 text-white p-4 rounded-lg mb-4">
      <div className="flex justify-between items-start">
        <div>
          <strong className="block">{title}</strong>
          <pre className="whitespace-pre-wrap text-sm mt-1">{message}</pre>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-4 text-white/80">Close</button>
        )}
      </div>
    </div>
  );
}
