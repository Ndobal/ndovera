const { createClass, addClassMember } = require('../db');

async function seed() {
  console.log('Seeding classroom data...');

  // Create a classroom
  const classroom = await createClass({
    id: 'class-default',
    name: 'SS2 Gold',
    teacherId: 'user-teacher-1',
  });
  console.log('Created classroom:', classroom);

  // Add a teacher to the classroom
  await addClassMember(classroom.id, 'user-teacher-1', 'teacher');
  console.log('Added teacher to classroom');

  // Add a student to the classroom
  await addClassMember(classroom.id, 'user-student-1', 'student');
  console.log('Added student to classroom');

  console.log('Seeding complete.');
  process.exit(0);
}

seed();
