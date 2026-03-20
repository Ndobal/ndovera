const fs = require('fs');

let c = fs.readFileSync('packages/web/src/pages/SchoolFileSharing.tsx', 'utf8');

c = c.replace(
  "import { Link2, FolderOpen, ShieldCheck, Sparkles, Plus, ExternalLink, School, Globe2 } from 'lucide-react';",
  "import { Link2, FolderOpen, ShieldCheck, Sparkles, Plus, ExternalLink, School, Globe2, UploadCloud } from 'lucide-react';"
);

// Add uploadFile state
c = c.replace(
  "const [draft, setDraft] = useState({",
  "const [uploadFile, setUploadFile] = useState<File | null>(null);\n  const [draft, setDraft] = useState({"
);

// update handleCreate
const handleCreateOld = `  const handleCreate = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await fetch('/api/shared-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      setDraft({ title: '', description: '', resourceUrl: '', scope: 'school', fileType: 'Link' });
      setFeedback('Shared file published successfully.');
      await refetch();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to publish shared file.');
    } finally {
      setSaving(false);
    }
  };`;

const handleCreateNew = `  const handleCreate = async () => {
    if (!draft.title.trim() && !uploadFile) return;
    setSaving(true);
    setFeedback(null);
    try {
      if (uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('title', draft.title || uploadFile.name);
        formData.append('description', draft.description);
        formData.append('scope', draft.scope);

        const res = await fetch('/api/shared-files/upload', {
          method: 'POST',
          body: formData
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to upload file');
        }
      } else {
        const res = await fetch('/api/shared-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error('Failed to publish link');
      }

      setDraft({ title: '', description: '', resourceUrl: '', scope: 'school', fileType: 'Link' });
      setUploadFile(null);
      setFeedback('Shared file published successfully.');
      await refetch();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to publish shared file.');
    } finally {
      setSaving(false);
    }
  };`;

c = c.replace(handleCreateOld, handleCreateNew);

// UI additions for file upload
const uiOld = `            <input value={draft.resourceUrl} onChange={(event) => setDraft((current) => ({ ...current, resourceUrl: event.target.value }))} placeholder="Resource link (optional)" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />`;

const uiNew = `            <div className="flex gap-2">
              <input value={draft.resourceUrl} onChange={(event) => { setDraft((current) => ({ ...current, resourceUrl: event.target.value })); setUploadFile(null); }} placeholder="Resource link (optional)" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" disabled={!!uploadFile} />
              <label className="flex-shrink-0 cursor-pointer rounded-xl bg-white/10 px-4 py-3 text-sm text-white hover:bg-white/20 transition-colors flex items-center justify-center">
                <UploadCloud size={16} />
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setUploadFile(e.target.files[0]);
                    setDraft(cur => ({ ...cur, resourceUrl: '' }));
                  }
                }} />
              </label>
            </div>
            {uploadFile && <div className="col-span-full text-xs text-emerald-400">Selected file: {uploadFile.name} (Ready for virus scan & processing)</div>}`;

c = c.replace(uiOld, uiNew);

fs.writeFileSync('packages/web/src/pages/SchoolFileSharing.tsx', c);
console.log('Updated File Sharing UI');
