import React, { useEffect, useMemo, useState } from 'react';
import RoleSectionPage from '../../../shared/components/RoleSectionPage';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import { getTeacherDashboard } from '../../../services/roleDashboardService';

function pluralize(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export default function TeacherOverview() {
  const storedAuth = getStoredAuth();
  const storedUser = storedAuth?.user || {};
  const storedName = storedUser.name && storedUser.name !== storedUser.id
    ? storedUser.name
    : storedUser.email || 'Teacher';

  const [data, setData] = useState({
    role: 'Teacher Dashboard',
    roleWatermark: 'TEACHER',
    name: storedName,
    metrics: [],
    priorities: [],
    activity: [],
    classes: [],
    summary: {
      assignedClasses: 0,
      studentsReached: 0,
      activeSubjects: 0,
      reviewedSubmissions: 0,
      waitingReview: 0,
      assignmentsInClasses: 0,
      materialsInClasses: 0,
      activeLiveSessions: 0,
    },
  });

  useEffect(() => {
    let mounted = true;

    getTeacherDashboard().then(result => {
      if (!mounted || !result) return;

      setData(prev => ({
        ...prev,
        ...result,
        name: result.name && result.name !== 'User' ? result.name : storedName,
        metrics: Array.isArray(result.metrics) ? result.metrics : prev.metrics,
        priorities: Array.isArray(result.priorities) ? result.priorities : prev.priorities,
        activity: Array.isArray(result.activity) ? result.activity : prev.activity,
        classes: Array.isArray(result.classes) ? result.classes : prev.classes,
        summary: result.summary && typeof result.summary === 'object' ? { ...prev.summary, ...result.summary } : prev.summary,
      }));
    }).catch(() => {});

    return () => {
      mounted = false;
    };
  }, [storedName]);

  const classCount = Number(data.summary?.assignedClasses || data.classes.length || 0);
  const studentCount = Number(data.summary?.studentsReached || 0);

  const infoCards = useMemo(() => {
    const attentionItems = data.priorities.length > 0
      ? data.priorities
      : [{ text: 'Live teacher priorities will appear here once classroom data is available.', tag: 'Waiting' }];

    const activityItems = data.activity.length > 0
      ? data.activity
      : [{ text: 'Assignments, materials, live sessions, and review analytics will appear here once you start using them.', tag: 'Waiting' }];

    const classSnapshotItems = data.classes.length > 0
      ? data.classes.slice(0, 6).map(classroom => ({
          text: `${classroom.className}: ${pluralize(Number(classroom.studentCount || 0), 'student')}, ${pluralize(Number(classroom.assignmentCount || 0), 'assignment')}, ${pluralize(Number(classroom.materialCount || 0), 'material')}.`,
          tag: classroom.isClassTeacher
            ? `Class Teacher${Number(classroom.attendanceTodayCount || 0) > 0 ? ' • Attendance Marked' : ' • Attendance Pending'}`
            : `${pluralize(Number(classroom.subjectCount || 0), 'subject')}`,
        }))
      : [{ text: 'No classes are assigned to this teacher yet.', tag: 'Pending' }];

    return [
      { title: 'Attention Needed', items: attentionItems },
      { title: 'Activity Snapshot', items: activityItems },
      { title: 'Class Snapshot', items: classSnapshotItems },
    ];
  }, [data.activity, data.classes, data.priorities]);

  const sectionSubtitle = classCount > 0
    ? `${pluralize(classCount, 'assigned class')} and ${pluralize(studentCount, 'student')} in your current teaching load.`
    : 'Your teaching analytics will appear here once classes and classroom activity are available.';

  return (
    <RoleSectionPage
      roleTitle={data.role || 'Teacher Dashboard'}
      sectionTitle={`Welcome, ${data.name || storedName}`}
      sectionSubtitle={sectionSubtitle}
      watermark={data.roleWatermark || 'TEACHER'}
      metricCards={data.metrics || []}
      infoCards={infoCards}
      theme="wheat"
    />
  );
}