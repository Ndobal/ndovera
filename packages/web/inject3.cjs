const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// Add state
if (!content.includes('const [hideEval, setHideEval] = useState(false);')) {
  content = content.replace('const { data: evalStatus } = useData<{ active: boolean; completed: boolean }>(\'/api/evaluation/status\');', 'const { data: evalStatus } = useData<{ active: boolean; completed: boolean; evaluation_id: string }>(\'/api/evaluation/status\');\\n  const [hideEval, setHideEval] = useState(false);');
}

// Modify EvaluationModal
if (content.includes('<EvaluationModal />')) {
  content = content.replace('{evalStatus?.active && !evalStatus?.completed && currentRole !== \\'Super Admin\\' && (', '{evalStatus?.active && !evalStatus?.completed && !hideEval && currentRole !== \\'Super Admin\\' && (');
  content = content.replace('<EvaluationModal />', '<EvaluationModal \\n            evaluationId={evalStatus.evaluation_id} \\n            onClose={() => setHideEval(true)} \\n          />');
}

fs.writeFileSync('src/components/Layout.tsx', content);
console.log('Fixed Layout.tsx');
