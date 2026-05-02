const API_BASE = process.env.REACT_APP_API_BASE || '/api';

function getAuthHeader() {
  const t = (window.localStorage && window.localStorage.getItem('token')) || null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function listBooks() {
  const res = await fetch(`${API_BASE}/library/books`, { headers: { ...getAuthHeader() } });
  return res.json();
}

export async function getBook(id) {
  const res = await fetch(`${API_BASE}/library/books/${id}`, { headers: { ...getAuthHeader() } });
  return res.json();
}

export async function createOrUpdateBook(payload) {
  const res = await fetch(`${API_BASE}/library/books`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeader() }, body: JSON.stringify(payload) });
  return res.json();
}

export async function deleteBook(id) {
  const res = await fetch(`${API_BASE}/library/books/${id}`, { method: 'DELETE', headers: { ...getAuthHeader() } });
  return res.json();
}

export async function borrowBook(bookId, opts = {}) {
  const res = await fetch(`${API_BASE}/library/books/${bookId}/borrow`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeader() }, body: JSON.stringify(opts) });
  return res.json();
}

export async function returnBorrowing(borrowingId) {
  const res = await fetch(`${API_BASE}/library/borrowings/${borrowingId}/return`, { method: 'POST', headers: { ...getAuthHeader() } });
  return res.json();
}

export async function myBorrowings() {
  const res = await fetch(`${API_BASE}/library/borrowings/mine`, { headers: { ...getAuthHeader() } });
  return res.json();
}

export async function allBorrowings() {
  const res = await fetch(`${API_BASE}/library/borrowings`, { headers: { ...getAuthHeader() } });
  return res.json();
}

export async function getAllAudits() {
  const res = await fetch(`${API_BASE}/audit`, { headers: { ...getAuthHeader() } });
  return res.json();
}

export default { listBooks, getBook, createOrUpdateBook, deleteBook, borrowBook, returnBorrowing, myBorrowings, allBorrowings };
