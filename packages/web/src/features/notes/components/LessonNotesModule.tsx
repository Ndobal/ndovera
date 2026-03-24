import React from 'react';
import { Plus, Upload, Search, Eye, Download, MoreVertical } from 'lucide-react';
import { buildAppUrl, WEB_API_BASE_URL } from '../../../services/runtimeConfig';
import { fetchWithAuth } from '../../../services/apiClient';

const mockLessonNotes = [
  { id: 'note_01', title: 'Introduction to Algebra', subject: 'Mathematics', week: 1, visibility: 'Student + Parent', views: 120, downloads: 85 },
  { id: 'note_02', title: 'Cellular Respiration', subject: 'Biology', week: 1, visibility: 'Student-only', views: 98, downloads: 60 },
  { id: 'note_03', title: 'The Trans-Atlantic Slave Trade', subject: 'History', week: 2, visibility: 'Student + Parent', views: 150, downloads: 110 },
  { id: 'note_04', title: 'Chemical Bonding', subject: 'Chemistry', week: 2, visibility: 'Teacher-only', views: 15, downloads: 5 },
];

const VisibilityPill = ({ visibility }: { visibility: string }) => {
    const styles: Record<string,string> = {
        'Student + Parent': 'bg-emerald-500/10 text-emerald-400',
        'Student-only': 'bg-blue-500/10 text-blue-400',
        'Teacher-only': 'bg-slate-500/10 text-slate-400',
    };
    return (
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[visibility]}`}>
            {visibility.replace('-', ' ')}
        </span>
    );
};

export default function LessonNotesModule() {
  const [resp, setResp] = React.useState<any>(null);
  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Lesson Notes</h1>
          <p className="text-sm text-slate-400">Create, upload, and share lesson notes with students and parents.</p>
        </div>
        <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg text-sm text-slate-300 hover:bg-slate-700">
                <Upload className="w-4 h-4" />
                Upload Files
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">
                <Plus className="w-4 h-4" />
                Create New Note
            </button>
        </div>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <label htmlFor="notes-search" className="sr-only">Search notes</label>
                    <input
                      id="notes-search"
                      type="text"
                      aria-label="Search notes"
                      className="pl-10 pr-4 py-2 bg-slate-800 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-emerald-500 transition-all text-slate-200"
                    />
                </div>
            </div>
        </div>
        <table className="w-full">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Note Title</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Subject</th>
              <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Week</th>
              <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Visibility</th>
              <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Engagement</th>
              <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {mockLessonNotes.map(note => (
              <tr key={note.id}>
                <td className="p-4 text-sm font-medium text-slate-200">{note.title}</td>
                <td className="p-4 text-sm text-slate-400">{note.subject}</td>
                <td className="p-4 text-sm text-center font-mono text-slate-400">{note.week}</td>
                <td className="p-4 text-center"><VisibilityPill visibility={note.visibility} /></td>
                <td className="p-4 text-sm text-slate-400">
                    <div className="flex items-center justify-center gap-4">
                        <span className="flex items-center gap-1.5"><Eye className="w-3 h-3" /> {note.views}</span>
                        <span className="flex items-center gap-1.5"><Download className="w-3 h-3" /> {note.downloads}</span>
                    </div>
                </td>
                <td className="p-4 text-right">
                  <button className="p-2 rounded-md hover:bg-slate-800 text-slate-500">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4">
          <button onClick={async ()=>{
            try {
              const payload = await fetchWithAuth(buildAppUrl('/api/notes', WEB_API_BASE_URL), {
                method:'POST',
                headers:{'content-type':'application/json'},
                body: JSON.stringify({ title: 'UI Test Note', subject:'UI', content:'Created from UI test'})
              });
              setResp(payload);
            } catch (e) {
              setResp(String(e));
            }
          }} className="mt-3 px-3 py-2 bg-emerald-600 rounded">Create Note via API</button>
          <pre className="mt-2 text-xs">{resp ? JSON.stringify(resp,null,2) : 'No response yet'}</pre>
        </div>
      </div>
    </div>
  );
}
