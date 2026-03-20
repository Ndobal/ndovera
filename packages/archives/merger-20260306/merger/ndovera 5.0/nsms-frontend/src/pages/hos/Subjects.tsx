import React from 'react';
import SubjectPool from '../../components/hos/SubjectPool';

const Subjects: React.FC = () => {
  return (
    <div style={{ padding: 32 }}>
      <h1>Manage Subjects for Class</h1>
      <SubjectPool />
    </div>
  );
};

export default Subjects;
