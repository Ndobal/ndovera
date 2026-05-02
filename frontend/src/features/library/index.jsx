import React from 'react';
import StudentLibrary from './StudentLibrary';
import AdminLibrary from './AdminLibrary';

export default function LibraryTab(props) {
  const user = props.user || { id: 'guest', name: 'guest', role: 'student' };
  // if admin-ish role, show admin UI
  if (['hos','owner','admin','librarian','teacher'].includes(user.role)) {
    return <AdminLibrary />;
  }
  return <StudentLibrary user={user} />;
}
