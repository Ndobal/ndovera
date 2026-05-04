import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import { classroomTabs, liveSessionSeed } from './data';
import ClassroomTopBar from './ClassroomTopBar';
import StreamTab from './stream';
import SubjectsTab from './subjects';
import MaterialsTab from './materials';
import PracticeTab from './practice';
import AssignmentsTab from './assignments';
import LiveTab from './live';
import ClassmatesTab from './classmates';
import TeachersTab from './teachers';

export default function StudentClassroomExperience() {
  const [activeTab, setActiveTab] = useState('stream');
  const [auraBalance, setAuraBalance] = useState(0);
  const shortClassName = (liveSessionSeed.className || 'Live Classroom').split(' - ')[0];

  const renderActiveTab = () => {
    if (activeTab === 'stream') return <StreamTab />;
    if (activeTab === 'subjects') return <SubjectsTab />;
    if (activeTab === 'materials') return <MaterialsTab />;
    if (activeTab === 'practice') return <PracticeTab auraBalance={auraBalance} setAuraBalance={setAuraBalance} />;
    if (activeTab === 'assignments') return <AssignmentsTab />;
    if (activeTab === 'live') return <LiveTab />;
    if (activeTab === 'classmates') return <ClassmatesTab />;
    return <TeachersTab />;
  };

  return (
    <StudentSectionShell
      title="Classroom"
      subtitle=""
      compact
      viewportLocked
      hideHeader
      watermarkText="Student Dashboard"
      diagonalWatermark
    >
      <div className="h-full min-h-0 flex flex-col">
        <ClassroomTopBar
          className={shortClassName}
          tabs={classroomTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={activeTab === 'stream' ? 'h-full min-h-0 overflow-hidden' : 'h-full min-h-0 overflow-y-auto pr-1'}
            >
              {renderActiveTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </StudentSectionShell>
  );
}
