import React, { useEffect, useState } from 'react';
import libraryService from './libraryService';

export default function AdminLibrary() {
  const [books, setBooks] = useState([]);
  const [borrowings, setBorrowings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selected, setSelected] = useState(null);
  const [audits, setAudits] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const b = await libraryService.listBooks();
      if (b && b.books) setBooks(b.books);
      const br = await libraryService.allBorrowings();
      if (br && br.borrowings) setBorrowings(br.borrowings);
      // try to fetch audits (may require admin token)
      try {
        const a = await libraryService.getAllAudits();
        if (Array.isArray(a)) setAudits(a);
        else if (a && a.length) setAudits(a);
      } catch (e) { /* ignore if not available */ }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function addBook() {
    if (!newTitle) return;
    const payload = { title: newTitle, author: 'Unknown', description: '' };
    await libraryService.createOrUpdateBook(payload);
    setNewTitle('');
    load();
  }

  async function removeBook(id) {
    if (!window.confirm('Delete book?')) return;
    await libraryService.deleteBook(id);
    load();
  }

  async function editBook(book) {
    setSelected(book);
  }

  async function saveSelected() {
    if (!selected) return;
    await libraryService.createOrUpdateBook(selected);
    setSelected(null);
    load();
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">Library Admin</h2>
      {loading && <div>Loading...</div>}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-medium">Catalog</h3>
          <ul className="mt-2 space-y-2">
            {books.map(b => (
              <li key={b.id} className="p-2 border rounded flex justify-between">
                <div onClick={() => editBook(b)} style={{ cursor: 'pointer' }}>
                  <div className="font-medium">{b.title}</div>
                  <div className="text-sm text-gray-600">{b.author}</div>
                </div>
                <div className="space-x-2">
                  <button onClick={() => removeBook(b.id)} className="px-2 py-1 bg-red-600 text-white rounded">Delete</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex">
            <input className="flex-1 p-2 border" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="New book title" />
            <button className="ml-2 px-3 py-1 bg-green-600 text-white rounded" onClick={addBook}>Add</button>
          </div>
        </div>

        <div>
          <h3 className="font-medium">Borrowings</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {borrowings.map(b => (
              <li key={b.id} className="p-2 border rounded">
                <div className="flex justify-between">
                  <div>{b.bookId} — {b.studentId}</div>
                  <div>{b.status} {b.dueAt ? `· due ${b.dueAt}` : ''}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {selected && (
        <div className="mt-4 p-4 border rounded bg-white">
          <h4 className="font-semibold">Edit Book</h4>
          <div className="mt-2">
            <input className="w-full p-2 border" value={selected.title || ''} onChange={e => setSelected({ ...selected, title: e.target.value })} />
            <input className="w-full p-2 border mt-2" value={selected.author || ''} onChange={e => setSelected({ ...selected, author: e.target.value })} />
            <textarea className="w-full p-2 border mt-2" value={selected.description || ''} onChange={e => setSelected({ ...selected, description: e.target.value })} />
            <div className="mt-2 flex space-x-2">
              <button onClick={saveSelected} className="px-3 py-1 bg-indigo-600 text-white rounded">Save</button>
              <button onClick={() => setSelected(null)} className="px-3 py-1 bg-gray-300 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <h3 className="font-medium">Audit</h3>
        <div className="text-sm mt-2">
          <div className="flex items-center space-x-2 mb-2">
            <input placeholder="Filter text" className="p-2 border flex-1" value={filterText} onChange={e => { setFilterText(e.target.value); setPage(0); }} />
            <input placeholder="Action" className="p-2 border" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }} />
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} className="p-2 border">
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
          </div>

          {audits.length === 0 && <div className="text-gray-500">No audit entries or not authorized to view audits.</div>}

          {audits.length > 0 && (() => {
            const filtered = audits.filter(a => {
              const txt = JSON.stringify(a).toLowerCase();
              if (actionFilter && (!a.action || !a.action.toLowerCase().includes(actionFilter.toLowerCase()))) return false;
              if (filterText && !txt.includes(filterText.toLowerCase())) return false;
              return true;
            });
            const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
            const pageIndex = Math.max(0, Math.min(page, pageCount - 1));
            const pageItems = filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);

            return (
              <div>
                <ul className="space-y-2">
                  {pageItems.map(a => (
                    <li key={a.id} className="p-2 border rounded text-xs">
                      <div className="font-medium">{a.action} — {a.studentId || (a.data && a.data.by) || 'unknown'}</div>
                      <div className="text-gray-600">{a.ts}</div>
                      <pre className="mt-1 text-xs whitespace-pre-wrap">{JSON.stringify(a.data)}</pre>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <div>{filtered.length} entries</div>
                  <div className="space-x-2">
                    <button disabled={pageIndex <= 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="px-2 py-1 border rounded">Prev</button>
                    <span>Page {pageIndex + 1} / {pageCount}</span>
                    <button disabled={pageIndex >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} className="px-2 py-1 border rounded">Next</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
