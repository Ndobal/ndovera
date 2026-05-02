export function getRoleAccent(role) {
  if (role.toLowerCase().includes('teacher')) return 'accent-indigo';
  if (role.toLowerCase().includes('lead')) return 'accent-emerald';
  return 'accent-amber';
}

export function createTextDownload(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function renderProgressBars(points) {
  return (
    <div className="flex items-end gap-1 h-12">
      {points.map((point, index) => (
        <div key={`${point}-${index}`} className="flex-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div className="bg-indigo-400 h-full" style={{ height: `${point}%` }} />
        </div>
      ))}
    </div>
  );
}
