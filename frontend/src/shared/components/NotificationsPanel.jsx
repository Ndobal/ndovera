import React from 'react';

const notifications = [
  { message: 'New assignment posted in Math', time: '2m ago' },
  { message: 'Your attendance for today is 100%', time: '1h ago' },
  { message: 'Library book "Physics 101" due tomorrow', time: '3h ago' },
];

export default function NotificationsPanel() {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-2">Notifications</h2>
      <ul className="bg-primary-light rounded-lg p-4 divide-y divide-slate-200">
        {notifications.map((note, idx) => (
          <li key={idx} className="py-2 flex justify-between items-center">
            <span>{note.message}</span>
            <span className="text-xs text-slate-500">{note.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
