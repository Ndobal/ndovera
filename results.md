export default function Documentation() {
  return (
    <div className="p-10 space-y-6 text-gray-800">
      <h1 className="text-4xl font-bold">Cloudflare React Result System</h1>
      <p className="text-lg">Complete architecture and starter implementation for 3 professional school result templates.</p>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">1. Recommended Stack</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>React + TypeScript + Vite</li>
          <li>Tailwind CSS</li>
          <li>Framer Motion</li>
          <li>qrcode.react</li>
          <li>react-to-print</li>
          <li>jspdf + html2canvas</li>
          <li>Cloudflare Pages deployment</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">2. Install Packages</h2>
        <pre className="bg-black text-green-400 p-4 rounded-2xl overflow-auto text-sm">
{`npm install tailwindcss framer-motion qrcode.react react-to-print jspdf html2canvas lucide-react
npm install -D @types/jspdf`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">3. Folder Structure</h2>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-sm">
{`src/
 ├── components/
 │    ├── ResultHeader.tsx
 │    ├── SubjectTable.tsx
 │    ├── SignatureBlock.tsx
 │    ├── QRVerification.tsx
 │    ├── Remarks.tsx
 │    ├── ThemeSwitcher.tsx
 │    └── ApprovalWorkflow.tsx
 │
 ├── templates/
 │    ├── PremiumLedgerTemplate.tsx
 │    ├── GlassmorphismTemplate.tsx
 │    └── MontessoriTemplate.tsx
 │
 ├── data/
 │    └── mockStudent.ts
 │
 ├── styles/
 │    └── print.css
 │
 ├── utils/
 │    ├── exportPdf.ts
 │    └── grades.ts
 │
 ├── App.tsx
 └── main.tsx`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">4. Mock Student Data</h2>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs">
{`export const student = {
  id: 'NDA-2026-001',
  name: 'David Williams',
  class: 'JSS 2 Gold',
  term: 'Second Term',
  session: '2025/2026',
  gender: 'Male',
  age: 12,
  attendance: 92,
  nextTermBegins: '12th September 2026',
  position: '3rd',
  totalStudents: 38,
  passport: '/student.jpg',
  school: {
    name: 'Nony Academy',
    slogan: 'Raising Global Champions',
    address: 'Galadimawa, Abuja',
    phone: '+234800000000',
    email: 'info@nonyacademy.com',
    logo: '/logo.png',
  },
  subjects: [
    {
      subject: 'English Language',
      ca1: 10,
      ca2: 8,
      exam: 67,
      total: 85,
      grade: 'A',
      remark: 'Excellent',
    },
    {
      subject: 'Mathematics',
      ca1: 9,
      ca2: 10,
      exam: 71,
      total: 90,
      grade: 'A',
      remark: 'Outstanding',
    },
  ],
  psychomotor: [
    { title: 'Neatness', score: 5 },
    { title: 'Punctuality', score: 4 },
  ],
  affective: [
    { title: 'Honesty', score: 5 },
    { title: 'Leadership', score: 4 },
  ],
  comments: {
    teacher: 'Excellent performance. Keep it up.',
    sectionalHead: 'Very promising student.',
    hos: 'Approved for promotion.',
  },
  signatures: {
    teacher: '/teacher-signature.png',
    sectionalHead: '/sectional-head.png',
    hos: '/hos-signature.png',
  },
};`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">5. QR Verification Component</h2>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs">
{`import { QRCodeCanvas } from 'qrcode.react';

export default function QRVerification({ studentId }: any) {
  return (
    <div className="flex flex-col items-center gap-2">
      <QRCodeCanvas
        value={\`https://results.nonyacademy.com/verify/\${studentId}\`}
        size={120}
        level="H"
        includeMargin
      />
      <p className="text-xs font-semibold">Scan to Verify Result</p>
    </div>
  );
}`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">6. Signature Upload Support</h2>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs">
{`export function SignatureUpload({ label, onUpload }: any) {
  return (
    <div className="space-y-2">
      <label className="font-semibold">{label}</label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(URL.createObjectURL(file));
        }}
        className="border rounded-xl p-2"
      />
    </div>
  );
}`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">7. Print CSS</h2>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs">
{`@media print {
  body {
    background: white;
  }

  .no-print {
    display: none !important;
  }

  .print-page {
    width: 210mm;
    min-height: 297mm;
    padding: 10mm;
    page-break-after: always;
  }

  table {
    page-break-inside: avoid;
  }

  .shadow-xl,
  .shadow-2xl {
    box-shadow: none !important;
  }
}`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">8. PDF Export Utility</h2>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs">
{`import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportResultPDF(elementId: string) {
  const input = document.getElementById(elementId);
  if (!input) return;

  const canvas = await html2canvas(input, {
    scale: 2,
  });

  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF('p', 'mm', 'a4');

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save('student-result.pdf');
}`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">9. Multi School Theme System</h2>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs">
{`export const themes = {
  default: {
    primary: 'bg-blue-700',
    secondary: 'bg-blue-100',
    accent: 'text-blue-700',
  },
  green: {
    primary: 'bg-green-700',
    secondary: 'bg-green-100',
    accent: 'text-green-700',
  },
  purple: {
    primary: 'bg-purple-700',
    secondary: 'bg-purple-100',
    accent: 'text-purple-700',
  },
};`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">10. Approval Workflow UI</h2>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs">
{`import { CheckCircle } from 'lucide-react';

export default function ApprovalWorkflow() {
  return (
    <div className="grid grid-cols-3 gap-4 mt-6">
      {['Teacher Approved', 'Sectional Head Approved', 'HOS Published'].map((item) => (
        <div
          key={item}
          className="flex items-center gap-2 bg-green-100 border border-green-300 rounded-2xl p-4"
        >
          <CheckCircle className="text-green-700" />
          <span className="font-semibold">{item}</span>
        </div>
      ))}
    </div>
  );
}`}
        </pre>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-bold">11. TEMPLATE ONE — Premium Academic Ledger</h2>
        <pre className="bg-black text-green-400 p-4 rounded-2xl overflow-auto text-xs">
{`export default function PremiumLedgerTemplate({ student }: any) {
  return (
    <div className="print-page bg-white relative overflow-hidden border-8 border-blue-900 rounded-2xl">
      <div className="absolute inset-0 opacity-5 bg-[url('/watermark.png')] bg-center bg-no-repeat" />

      <div className="bg-blue-900 text-white p-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{student.school.name}</h1>
          <p>{student.school.slogan}</p>
        </div>

        <img src={student.school.logo} className="w-24 h-24 object-contain" />
      </div>

      <div className="p-6 space-y-6 relative z-10">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <p><strong>Name:</strong> {student.name}</p>
            <p><strong>Class:</strong> {student.class}</p>
            <p><strong>Position:</strong> {student.position}</p>
          </div>

          <div className="flex justify-center">
            <img
              src={student.passport}
              className="w-32 h-32 rounded-xl border-4 border-blue-900"
            />
          </div>

          <div className="flex justify-end">
            <QRVerification studentId={student.id} />
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-blue-900 text-white">
              <th className="border p-2">Subject</th>
              <th className="border p-2">CA1</th>
              <th className="border p-2">CA2</th>
              <th className="border p-2">Exam</th>
              <th className="border p-2">Total</th>
              <th className="border p-2">Grade</th>
              <th className="border p-2">Remark</th>
            </tr>
          </thead>

          <tbody>
            {student.subjects.map((s: any) => (
              <tr key={s.subject}>
                <td className="border p-2">{s.subject}</td>
                <td className="border p-2">{s.ca1}</td>
                <td className="border p-2">{s.ca2}</td>
                <td className="border p-2">{s.exam}</td>
                <td className="border p-2 font-bold">{s.total}</td>
                <td className="border p-2">{s.grade}</td>
                <td className="border p-2">{s.remark}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}`}
        </pre>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-bold">12. TEMPLATE TWO — Glassmorphism</h2>
        <pre className="bg-black text-green-400 p-4 rounded-2xl overflow-auto text-xs">
{`export default function GlassmorphismTemplate({ student }: any) {
  return (
    <div className="print-page bg-gradient-to-br from-indigo-200 via-white to-cyan-200 p-6 rounded-3xl">
      <div className="backdrop-blur-xl bg-white/40 border border-white/50 rounded-3xl p-6 shadow-2xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-indigo-900">{student.school.name}</h1>
            <p>{student.term} Result</p>
          </div>

          <QRVerification studentId={student.id} />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {student.subjects.map((s: any) => (
            <div className="bg-white/70 rounded-2xl p-4 shadow-xl">
              <div className="flex justify-between">
                <h3 className="font-bold">{s.subject}</h3>
                <span className="font-black text-2xl">{s.total}</span>
              </div>

              <div className="mt-3 h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-700 h-full"
                  style={{ width: `${s.total}%` }}
                />
              </div>

              <p className="mt-2 text-sm">Grade: {s.grade}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}`}
        </pre>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-bold">13. TEMPLATE THREE — Montessori Style</h2>
        <pre className="bg-black text-green-400 p-4 rounded-2xl overflow-auto text-xs">
{`export default function MontessoriTemplate({ student }: any) {
  return (
    <div className="print-page bg-orange-50 rounded-3xl p-6 border-4 border-orange-200">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-orange-700">{student.school.name}</h1>
          <p className="text-orange-500">Child Development Report</p>
        </div>

        <img src={student.passport} className="w-24 h-24 rounded-full" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        {student.subjects.map((subject: any) => (
          <div className="bg-white rounded-2xl p-4 shadow-lg border-l-8 border-orange-500">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">{subject.subject}</h3>
              <div className="text-3xl font-black text-orange-700">{subject.grade}</div>
            </div>

            <p className="mt-3 text-sm text-slate-600">{subject.remark}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-6">
        <div>
          <img src={student.signatures.teacher} className="h-16" />
          <p className="border-t mt-2 pt-2">Teacher Signature</p>
        </div>

        <div>
          <img src={student.signatures.sectionalHead} className="h-16" />
          <p className="border-t mt-2 pt-2">Sectional Head</p>
        </div>

        <div>
          <img src={student.signatures.hos} className="h-16" />
          <p className="border-t mt-2 pt-2">HOS / Proprietor</p>
        </div>
      </div>
    </div>
  );
}`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">14. Main App Example</h2>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs">
{`import PremiumLedgerTemplate from './templates/PremiumLedgerTemplate';
import GlassmorphismTemplate from './templates/GlassmorphismTemplate';
import MontessoriTemplate from './templates/MontessoriTemplate';
import { student } from './data/mockStudent';

export default function App() {
  return (
    <div className="space-y-20 bg-slate-100 p-10">
      <PremiumLedgerTemplate student={student} />
      <GlassmorphismTemplate student={student} />
      <MontessoriTemplate student={student} />
    </div>
  );
}`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">15. Cloudflare Deployment</h2>
        <pre className="bg-black text-green-400 p-4 rounded-2xl overflow-auto text-xs">
{`npm run build

# wrangler.toml
name = "school-result-system"
compatibility_date = "2026-05-14"

pages_build_output_dir = "dist"

# Deploy
npx wrangler pages deploy dist`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">16. Extra Features You Can Add</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>CBT integration</li>
          <li>AI comments generation</li>
          <li>Bulk PDF generation</li>
          <li>Online parent portal</li>
          <li>Result locking system</li>
          <li>Term comparison analytics</li>
          <li>Automatic grading engine</li>
          <li>Cloudflare KV result caching</li>
          <li>Offline-first printing</li>
          <li>Biometric approval workflow</li>
        </ul>
      </section>
    </div>
  )
}
