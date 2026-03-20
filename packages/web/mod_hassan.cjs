const fs = require('fs');

let content = fs.readFileSync('src/features/classroom/data/classroomExperience.ts', 'utf8');

// The original file might use "status" or "promotion", let's fix it safely
// Actually wait, let's just make sure Hassan Mohammed's Term 3 summary reads 'Advised to Repeat'

content = content.replace(/"name": "Hassan Mohammed"[\s\S]*?"name": "Term 3"[\s\S]*?"promotion": "Promoted"/m, (match) => {
    return match.replace('"promotion": "Promoted"', '"promotion": "Advised to Repeat"');
});

fs.writeFileSync('src/features/classroom/data/classroomExperience.ts', content);
console.log('Done mapping advised to repeat!');
