import fs from 'fs';

const moduleRef = await import('./verify-payroll-e2e.ts');
const result = await moduleRef.runPayrollVerification();
fs.writeFileSync('./verify-payroll-inline-output.json', JSON.stringify(result, null, 2));
console.log('verify-payroll-inline-output.json written');
