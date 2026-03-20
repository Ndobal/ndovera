const fs = require('fs');

const path = 'packages/web/src/pages/Management.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
    "activeTab === 'parents' ? () => {} : refetchTeachers",
    "activeTab === 'parents' ? refetchParents : refetchTeachers" 
);

fs.writeFileSync(path, c);
console.log('patched refetchParents!');
