const fs = require('fs');

const path = 'packages/web/src/pages/Management.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
    "{activeTab === 'students' ? item.admission_number : item.staff_id}",
    "{activeTab === 'students' ? item.admission_number : activeTab === 'parents' ? (item.children_count ? `${item.children_count} Children Linked` : 'Parent') : item.staff_id}"
);

c = c.replace(
    "{activeTab === 'students' ? <GraduationCap size={12} /> : <Briefcase size={12} />}",
    "{activeTab === 'students' ? <GraduationCap size={12} /> : activeTab === 'parents' ? <Users size={12} /> : <Briefcase size={12} />}"
);

c = c.replace(
    "{activeTab === 'students' ? (item.class_name || 'No Class') : (item.specialization || 'General')}",
    "{activeTab === 'students' ? (item.class_name || 'No Class') : activeTab === 'parents' ? (item.children_names || 'No children links') : (item.specialization || 'General')}"
);

c = c.replace(
    "activeTab === 'students' ? refetchStudents : refetchTeachers",
    "activeTab === 'students' ? refetchStudents : activeTab === 'parents' ? () => {} : refetchTeachers" 
);

fs.writeFileSync(path, c);
console.log('patched fields!');
