const fs = require('fs');
const p = 'C:/Users/HP/Desktop/Projects/ndovera/packages/web/src/features/attendance/components/ParentAttendance.tsx';
let txt = fs.readFileSync(p, 'utf8');
if (!txt.includes('QRScanner')) {
  txt = "import QRScanner from '../../../components/QRScanner';\n" + txt;
  fs.writeFileSync(p, txt);
}
console.log('Done');