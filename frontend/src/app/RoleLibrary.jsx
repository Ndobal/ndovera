import React from 'react';
import { useParams } from 'react-router-dom';
import Library from './Library';
import { getStoredAuth } from '../features/auth/services/authApi';

// `Library` component expects a `user` prop provided by app context. The
// role segment is extracted from the URL and forwarded in the user object.

export default function RoleLibrary() {
  const { role } = useParams();
  const storedUser = getStoredAuth()?.user || {};

  const currentUser = {
    ...storedUser,
    id: storedUser.id || storedUser.email || 'current',
    role: role || storedUser.role || 'student',
    schoolId: storedUser.schoolId || storedUser.tenantId || 'school-001',
  };

  return <Library user={currentUser} />;
}
