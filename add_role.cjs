const fs = require('fs');
const file = 'roles/ndovera-roles.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
data['Exam Officer'] = ['exams.create', 'results.publish', 'students.view', 'files.exam.view'];
fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Added Exam Officer role');
