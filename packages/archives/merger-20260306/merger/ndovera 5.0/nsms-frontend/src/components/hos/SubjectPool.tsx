import React, { useState } from 'react';

// Nigerian curriculum subject pools
const SUBJECTS = {
  nursery: [
    'Literacy', 'Numeracy', 'Phonics', 'Basic Science', 'Social Habits', 'Health Habits', 'Rhymes', 'Story Time', 'Practical Life', 'Creative Arts', 'Music', 'Physical Development', 'Religious Studies', 'Computer Awareness',
  ],
  primary: [
    'Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Civic Education', 'Cultural & Creative Arts', 'Physical & Health Education', 'Agricultural Science', 'Home Economics', 'Computer Studies', 'Religious Studies', 'French', 'Verbal Reasoning', 'Quantitative Reasoning', 'Literature', 'Handwriting', 'Vocational Studies',
  ],
  jss: [
    'Mathematics', 'English Language', 'Basic Science', 'Basic Technology', 'Social Studies', 'Business Studies', 'Civic Education', 'Agricultural Science', 'Home Economics', 'Computer Studies', 'Physical & Health Education', 'Cultural & Creative Arts', 'Religious Studies', 'French', 'Literature', 'Pre-Vocational Studies',
  ],
  ss: [
    'Mathematics', 'English Language', 'Biology', 'Chemistry', 'Physics', 'Further Mathematics', 'Economics', 'Government', 'Geography', 'Literature in English', 'Agricultural Science', 'Commerce', 'Financial Accounting', 'Christian Religious Studies', 'Islamic Religious Studies', 'Civic Education', 'Technical Drawing', 'Food & Nutrition', 'Home Management', 'French', 'Yoruba', 'Igbo', 'Hausa', 'Data Processing', 'Computer Studies', 'Animal Husbandry', 'Marketing', 'Visual Arts', 'Music', 'Physical Education',
  ],
};

const SECTION_LABELS = {
  nursery: 'Nursery/Preschool',
  primary: 'Primary/Grade',
  jss: 'Junior Secondary (JSS 1-3)',
  ss: 'Senior Secondary (SS 1-3)',
};

const SubjectPool = () => {
  const [section, setSection] = useState('nursery');
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState('');

  const available = SUBJECTS[section].filter((s) => !selected.includes(s));

  const addSubject = (subject: string) => {
    setSelected([...selected, subject]);
  };
  const removeSubject = (subject: string) => {
    setSelected(selected.filter((s) => s !== subject));
  };
  const addCustom = () => {
    if (custom && !selected.includes(custom)) {
      setSelected([...selected, custom]);
      setCustom('');
    }
  };
  const editSubject = (oldName: string, newName: string) => {
    setSelected(selected.map((s) => (s === oldName ? newName : s)));
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h2>Subject Pool</h2>
      <label>
        Section:
        <select value={section} onChange={e => setSection(e.target.value)}>
          {Object.entries(SECTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </label>
      <div style={{ margin: '16px 0' }}>
        <strong>Available Subjects:</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {available.map(subject => (
            <button key={subject} onClick={() => addSubject(subject)} style={{ padding: '4px 10px', borderRadius: 8, background: '#e0e7ff', border: 'none', cursor: 'pointer' }}>{subject}</button>
          ))}
        </div>
      </div>
      <div style={{ margin: '16px 0' }}>
        <strong>Selected Subjects:</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {selected.map(subject => (
            <div key={subject} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                value={subject}
                onChange={e => editSubject(subject, e.target.value)}
                style={{ flex: 1, padding: 4, borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
              <button onClick={() => removeSubject(subject)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>Remove</button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ margin: '16px 0' }}>
        <input
          type="text"
          placeholder="Add special subject..."
          value={custom}
          onChange={e => setCustom(e.target.value)}
          style={{ padding: 4, borderRadius: 6, border: '1px solid #cbd5e1', marginRight: 8 }}
        />
        <button onClick={addCustom} style={{ background: '#bbf7d0', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>Add</button>
      </div>
    </div>
  );
};

export default SubjectPool;
