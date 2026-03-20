const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src', 'components', 'Layout.tsx');

let content = fs.readFileSync(targetPath, 'utf8');

// Inject import
if (!content.includes('EvaluationModal')) {
    content = content.replace("import { useData } from '../hooks/useData';", "import { useData } from '../hooks/useData';\nimport { EvaluationModal } from '../features/evaluation/components/EvaluationModal';");
}

// Inject state
if (!content.includes('const { data: evalStatus } = useData')) {
    content = content.replace(
        "export const Layout: React.FC<LayoutProps> = ({",
        "export const Layout: React.FC<LayoutProps> = ({\n  currentRole,\n"
    );

    const checkPoint = "return (\n    <div className={`app-shell";
    content = content.replace(checkPoint, "  const { data: evalStatus } = useData<{ active: boolean; completed: boolean }>('/api/evaluation/status');\n  \n  " + checkPoint);
}

// Inject component
if (!content.includes('<EvaluationModal')) {
    const renderPoint = "    </div>\n  );\n};";
    const injection = "      {evalStatus?.active && !evalStatus?.completed && currentRole !== 'Super Admin' && (\n        <EvaluationModal />\n      )}\n    </div>\n  );\n};";
    content = content.replace(renderPoint, injection);
}


fs.writeFileSync(targetPath, content);
console.log('Layout injected successfully!');
