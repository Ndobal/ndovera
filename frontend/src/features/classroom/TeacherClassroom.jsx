import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import * as svc from './classroomService';

export default function TeacherClassroom() {
  const { role } = useParams();
  // default class id for demo
  const [classId, setClassId] = useState('class-default');
  const [cls, setCls] = useState(null);
  const [activeTab, setActiveTab] = useState('stream');
  const [posts, setPosts] = useState([]);
  const [draftContent, setDraftContent] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  useEffect(() => {
    // try to load class info
    svc.getClass(classId).then(r => { if (r && r.success) setCls(r.class); }).catch(()=>{});
    loadAll();
  }, [classId]);

  function loadAll() {
    svc.getPosts(classId).then(r => { if (r && r.success) setPosts(r.posts || []); }).catch(()=>{});
    svc.getAssignments(classId).then(r => { if (r && r.success) setAssignments(r.assignments || []); }).catch(()=>{});
    svc.getMaterials(classId).then(r => { if (r && r.success) setMaterials(r.materials || []); }).catch(()=>{});
    svc.getAttendance(classId).then(r => { if (r && r.success) setAttendance(r.attendance || []); }).catch(()=>{});
  }

  async function handleCreatePost(e) {
    e.preventDefault();
    const content = draftContent || '';
    if (!content) return;
    await svc.createPost(classId, { content });
    // clear editor
    setDraftContent('');
    // clear editable div
    const editable = document.querySelector('[contenteditable]'); if (editable) editable.innerHTML = '';
    loadAll();
  }

  async function handleAttachFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    // multipart upload via FormData handled in classroomService.uploadMaterial
    await uploadFileWithProgress(f);
    loadAll();
  }

  // wire file input in toolbar
  useEffect(() => {
    const inp = document.getElementById('fileInput');
    if (!inp) return;
    inp.addEventListener('change', handleAttachFile);
    return () => inp.removeEventListener('change', handleAttachFile);
  }, [classId]);

  // autosave scheduling (use a ref to persist timer)
  const saveTimerRef = useRef(null);
  function scheduleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const content = document.getElementById('editorContent')?.innerHTML || '';
      svc.saveContent(classId, { content, role: 'teacher' }).catch(()=>{});
    }, 2000);
  }

  // Upload with progress using XMLHttpRequest (to support progress events)
  function uploadFileWithProgress(file) {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('token');
      const xhr = new XMLHttpRequest();
      const url = `/api/classrooms/${encodeURIComponent(classId)}/materials/upload-multipart`;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name);

      xhr.open('POST', url, true);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const pct = Math.round((evt.loaded / evt.total) * 100);
        setUploadProgress(prev => ({ ...prev, [file.name]: pct }));
      };

      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText || '{}');
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
          resolve(json);
        } catch (err) {
          reject(err || new Error('Invalid JSON'));
        }
      };

      xhr.onerror = () => {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        reject(new Error('Upload failed'));
      };

      xhr.send(fd);
    });
  }

  // Drag-and-drop handlers
  function handleDrop(e) {
    e.preventDefault();
    const items = e.dataTransfer && e.dataTransfer.files;
    if (!items || items.length === 0) return;
    Array.from(items).forEach(async (f) => { await uploadFileWithProgress(f); loadAll(); });
  }

  function handleDragOver(e) { e.preventDefault(); }

  async function handleCreateAssignment(e) {
    e.preventDefault();
    const form = e.target;
    const title = form.title.value;
    const description = form.description.value;
    const dueAt = form.dueAt.value || null;
    if (!title) return;
    await svc.createAssignment(classId, { title, description, dueAt });
    form.reset();
    loadAll();
  }

  async function handleRecordAttendance(e) {
    e.preventDefault();
    const form = e.target;
    const studentId = form.studentId.value;
    const date = form.date.value;
    const status = form.status.value;
    if (!studentId || !date || !status) return;
    await svc.recordAttendance(classId, { studentId, date, status });
    form.reset();
    loadAll();
  }

  return (
    <StudentSectionShell title={`Classroom (Teacher)`} watermarkText="Teacher Dashboard">
      <div id="devMarker" style={{display: 'none'}}>DEV_BUILD: teacher-classroom-20260304</div>
      <div className="p-4">
        <div className="mb-4">
          <label className="block text-sm font-medium">Class ID</label>
          <input value={classId} onChange={e => setClassId(e.target.value)} className="border rounded px-2 py-1 mt-1" />
        </div>

        <div className="mb-4">
          <nav className="flex gap-2">
            <button className={`px-3 py-1 rounded ${activeTab==='stream'?'bg-blue-500 text-white':''}`} onClick={()=>setActiveTab('stream')}>Stream</button>
            <button className={`px-3 py-1 rounded ${activeTab==='assignments'?'bg-blue-500 text-white':''}`} onClick={()=>setActiveTab('assignments')}>Assignments</button>
            <button className={`px-3 py-1 rounded ${activeTab==='attendance'?'bg-blue-500 text-white':''}`} onClick={()=>setActiveTab('attendance')}>Attendance</button>
            <button className={`px-3 py-1 rounded ${activeTab==='materials'?'bg-blue-500 text-white':''}`} onClick={()=>setActiveTab('materials')}>Materials</button>
          </nav>
        </div>

        <div onDrop={handleDrop} onDragOver={handleDragOver}>
          {activeTab === 'stream' && (
            <div>
              <form onSubmit={handleCreatePost} className="mb-3">
                <div className="toolbar mb-2 flex gap-2">
                  <button type="button" onClick={() => document.execCommand('bold')} className="px-2 py-1 border rounded">B</button>
                  <button type="button" onClick={() => document.execCommand('italic')} className="px-2 py-1 border rounded">I</button>
                  <button type="button" onClick={() => document.execCommand('underline')} className="px-2 py-1 border rounded">U</button>
                  <button type="button" onClick={() => document.execCommand('insertUnorderedList')} className="px-2 py-1 border rounded">• List</button>
                  <button type="button" onClick={() => document.execCommand('insertOrderedList')} className="px-2 py-1 border rounded">1. List</button>
                  <button type="button" onClick={() => { const url = prompt('Enter link URL'); if (url) document.execCommand('createLink', false, url); }} className="px-2 py-1 border rounded">Link</button>
                  <input type="color" onChange={e => document.execCommand('foreColor', false, e.target.value)} />
                  <button type="button" onClick={() => { document.getElementById('editorContent').classList.toggle('hidden'); document.getElementById('markdownView').classList.toggle('hidden'); }} className="px-2 py-1 border rounded">Markdown</button>
                  <input id="fileInput" type="file" className="ml-2" />
                </div>

                <div
                  id="editorContent"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={e => { setDraftContent(e.currentTarget.innerHTML); scheduleSave(); }}
                  className="w-full border rounded p-2 min-h-[80px]"
                />
                <div id="markdownView" className="hidden w-full border rounded p-2 min-h-[80px]" />

                <div className="mt-2 flex gap-2">
                  <button className="px-3 py-1 bg-green-600 text-white rounded">Post</button>
                </div>
              </form>
              <div>
                {posts.map(p => (
                  <div key={p.id} className="border rounded p-2 mb-2">
                    <div className="text-sm text-gray-600">{p.authorId} • {new Date(p.createdAt).toLocaleString()}</div>
                    <div className="mt-1" dangerouslySetInnerHTML={{ __html: p.content }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* upload progress indicators */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="mt-3">
              <div className="font-semibold mb-1">Upload Progress</div>
              {Object.entries(uploadProgress).map(([name, pct]) => (
                <div key={name} className="mb-2">
                  <div className="text-sm">{name} — {pct}%</div>
                  <div className="w-full bg-gray-200 h-2 rounded mt-1">
                    <div style={{ width: `${pct}%` }} className="h-2 bg-blue-500 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'assignments' && (
            <div>
              <form onSubmit={handleCreateAssignment} className="mb-3">
                <input name="title" placeholder="Title" className="w-full border rounded p-2 mb-2" />
                <textarea name="description" placeholder="Description" rows={3} className="w-full border rounded p-2 mb-2" />
                <input name="dueAt" type="datetime-local" className="w-full border rounded p-2 mb-2" />
                <div><button className="px-3 py-1 bg-green-600 text-white rounded">Create Assignment</button></div>
              </form>

              <div>
                {assignments.map(a => (
                  <div key={a.id} className="border rounded p-2 mb-2">
                    <div className="font-semibold">{a.title}</div>
                    <div className="text-sm text-gray-600">Due: {a.dueAt || '—'}</div>
                    <div className="mt-1">{a.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div>
              <form onSubmit={handleRecordAttendance} className="mb-3 grid grid-cols-4 gap-2">
                <input name="studentId" placeholder="student-123" className="border rounded p-2" />
                <input name="date" type="date" className="border rounded p-2" />
                <select name="status" className="border rounded p-2">
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                </select>
                <div><button className="px-3 py-1 bg-green-600 text-white rounded">Record</button></div>
              </form>

              <div>
                {attendance.map(a => (
                  <div key={a.id} className="border rounded p-2 mb-2">
                    <div className="text-sm text-gray-600">{a.studentId} • {a.date}</div>
                    <div>{a.status} {a.notes ? `- ${a.notes}` : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'materials' && (
            <div>
              <form onSubmit={async (e)=>{ e.preventDefault(); const t=e.target; await svc.addMaterial(classId,{ title: t.title.value, url: t.url.value }); t.reset(); loadAll(); }} className="mb-3">
                <input name="title" placeholder="Title" className="w-full border rounded p-2 mb-2" />
                <input name="url" placeholder="URL" className="w-full border rounded p-2 mb-2" />
                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-2">
                    <input id="materialFile" type="file" onChange={async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; await uploadFileWithProgress(f); loadAll(); e.target.value = ''; }} />
                    <span className="text-sm text-gray-600">Upload file</span>
                  </label>
                  <button className="px-3 py-1 bg-green-600 text-white rounded">Add Material</button>
                </div>
              </form>

              <div>
                {materials.map(m => (
                  <div key={m.id} className="border rounded p-2 mb-2">
                    <a href={m.url} className="font-semibold text-blue-600" target="_blank" rel="noreferrer">{m.title}</a>
                    <div className="text-sm text-gray-600">{m.uploadedAt} {m.uploadedBy ? `• ${m.uploadedBy}` : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </StudentSectionShell>
  );
}
