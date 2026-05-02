import React, { useEffect, useState } from 'react';
import libraryService from './libraryService';

export default function StudentLibrary({ user, service = libraryService }) {
  const [books, setBooks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await service.listBooks();
      if (res && res.books) setBooks(res.books);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }

  async function doBorrow(bookId) {
    setMessage('Processing borrow...');
    try {
      const res = await service.borrowBook(bookId, { dueAt: null });
      if (res && res.success) {
        setMessage('Borrowed successfully');
        load();
      } else {
        setMessage((res && res.error) || 'Could not borrow');
      }
    } catch (err) {
      setMessage('Error borrowing book');
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2">
        <h3 className="text-lg font-semibold">Catalog</h3>
        {loading && <div className="text-sm text-gray-500">Loading...</div>}
        <ul className="mt-4 space-y-3">
          {books.map(b => (
            <li key={b.id} className="p-3 border rounded hover:bg-gray-50 cursor-pointer flex justify-between" onClick={() => setSelected(b)}>
              <div>
                <div className="font-medium">{b.title}</div>
                <div className="text-sm text-gray-600">{b.author}</div>
              </div>
              <div className="text-sm text-gray-500">{b.metadata && b.metadata.pages ? `${b.metadata.pages}p` : ''}</div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="p-4 border rounded">
        <h4 className="font-semibold">Details</h4>
        {!selected && <div className="text-sm text-gray-500 mt-4">Select a book to view details</div>}
        {selected && (
          <div className="mt-3">
            <div className="text-lg font-bold">{selected.title}</div>
            <div className="text-sm text-gray-600">{selected.author}</div>
            <p className="mt-2 text-sm text-gray-700">{selected.description}</p>
            <div className="mt-4">
              <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={() => doBorrow(selected.id)}>Borrow</button>
            </div>
          </div>
        )}
        {message && <div className="mt-3 text-sm text-green-600">{message}</div>}
      </aside>
    </div>
  );
}
