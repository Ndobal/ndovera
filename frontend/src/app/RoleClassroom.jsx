import React from 'react';
import { useParams } from 'react-router-dom';
import StudentClassroomExperience from '../features/classroom/StudentClassroomExperience';
import TeacherClassroom from '../features/classroom/TeacherClassroom';

export default function RoleClassroom() {
  const { role } = useParams();
  if (role === 'teacher') return <TeacherClassroom />;
  return <StudentClassroomExperience />;
}
