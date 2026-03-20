const fs = require('fs');
let code = fs.readFileSync('packages/web/src/pages/Finance.tsx', 'utf8');

// The logic is:
// "IF FEE MANAGEMENT IS MANAGED BY HOS, FINANCE OFFICER'S FEMMENMANAGEMNET BECOMES READ ONLY AND VICE VERSA."
// "IF SALARY IS HANDLED BY BY FINANNCE OFFICER, HOS ROLE BECOMES READ ONLY AND VISE VERSA BUT HOS CAN COMMENT."

code = code.replace(
  "const isFinanceOfficer = role === 'Finance Officer' || role === 'School Admin' || role === 'Super Admin' || role === 'HOS';",
  `const [feeManagedBy, setFeeManagedBy] = useState('HOS');
  const [salaryManagedBy, setSalaryManagedBy] = useState('Finance Officer');
  const isFinanceOfficer = role === 'Finance Officer' || role === 'School Admin' || role === 'Super Admin' || role === 'HOS' || role === 'Tenant School Owner';
  const isReadOnlyFee = (role === 'Finance Officer' && feeManagedBy === 'HOS') || (role === 'HOS' && feeManagedBy === 'Finance Officer');
  const isReadOnlySalary = (role === 'Finance Officer' && salaryManagedBy === 'HOS') || (role === 'HOS' && salaryManagedBy === 'Finance Officer');`
);

code = code.replace(
  "Record Payment",
  "{isReadOnlyFee ? '(Read Only) View Payment' : 'Record Payment'}"
);

fs.writeFileSync('packages/web/src/pages/Finance.tsx', code);
