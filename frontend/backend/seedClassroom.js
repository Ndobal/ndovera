const { createClass, addClassMember, createPost, createAssignment, addMaterial, recordAttendance } = require('./db');

async function main() {
  console.log('Seeding classroom...');
  const cls = { id: 'class-default', name: 'Default Class', teacherId: 'teacher-dev' };
  const c = await createClass(cls).catch(e=>{ console.error('createClass', e && e.message); });
  console.log('Created class', c && c.id);

  await addClassMember('class-default', 'student-1').catch(()=>{});
  await addClassMember('class-default', 'student-2').catch(()=>{});

  await createPost({ classId: 'class-default', authorId: 'teacher-dev', content: 'Welcome to the class!' }).catch(()=>{});
  await createAssignment({ classId: 'class-default', title: 'Intro Assignment', description: 'Submit a short bio', dueAt: null }).catch(()=>{});
  await addMaterial({ classId: 'class-default', title: 'Syllabus', url: 'https://example.org/syllabus.pdf', uploadedBy: 'teacher-dev' }).catch(()=>{});
  await recordAttendance('class-default', 'student-1', new Date().toISOString().slice(0,10), 'present', 'teacher-dev', 'On time').catch(()=>{});

  console.log('Seeding classroom complete');
  process.exit(0);
}

main();
