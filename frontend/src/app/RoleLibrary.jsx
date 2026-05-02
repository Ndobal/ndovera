import React from 'react';
import { useParams } from 'react-router-dom';
import Library from './Library';

// `Library` component expects a `user` prop provided by app context. The
// role segment is extracted from the URL and forwarded in the user object.

export default function RoleLibrary() {
  const { role } = useParams();

  // placeholder user structure, can be replaced by actual auth provider
  const currentUser = { id: 'current', role: role, schoolId: 'school-001' };

  return <Library user={currentUser} />;
}
