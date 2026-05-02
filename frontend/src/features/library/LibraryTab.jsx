import React, { useState } from 'react';
import EBooksGrid from './components/EBooksGrid';
import BookDetail from './components/BookDetail';
import OfflineLibrary from './components/OfflineLibrary';
import BookStudio from './components/BookStudio';
import AdminPanel from './admin/AdminPanel';
import LibrarianPanel from './admin/LibrarianPanel';

export default function LibraryTab({ user }) {
  const [activeTab, setActiveTab] = useState('ebooks');
  const [selectedBook, setSelectedBook] = useState(null);
  const [message, setMessage] = useState(null);

  const openBook = (book) => setSelectedBook(book);
  const closeBook = () => setSelectedBook(null);

  const [licenseMap, setLicenseMap] = useState({});

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const handleBuy = async (book) => {
    try {
      const device = 'device-' + navigator.userAgent;
      const result = await import('./service/libraryService').then(m =>
        m.purchaseBook({
          bookId: book.id,
          userId: user?.id || 'guest',
          amount: book.price || 0,
          deviceFingerprint: device,
        })
      );
      // store license keyed by book
      setLicenseMap(prev => ({ ...prev, [book.id]: result.license }));
      showMessage(`Purchase successful! Receipt: ${result.receiptId}`);
    } catch (err) {
      console.error(err);
      showMessage(`Purchase failed: ${err.message}`);
    }
  };

  const handleDownload = async (book) => {
    try {
      const device = 'device-' + navigator.userAgent;
      const svc = await import('./service/libraryService');
      const lic = licenseMap[book.id];
      if (!lic) {
        showMessage('You need to purchase this book before downloading.');
        return;
      }
      const pkg = await svc.packageForDownload({ book, userId: user?.id || 'guest', deviceFingerprint: device, license: lic });
      // in real app you would initiate file download; here we just show token
      showMessage(`Download ready: ${pkg.downloadToken}`);
    } catch (err) {
      console.error(err);
      showMessage(`Download failed: ${err.message}`);
    }
  };

  const handlePublish = async (book) => {
    try {
      // stubbed admin action; log decision
      const svc = await import('./service/libraryService');
      await svc.logAdminDecision({ bookId: book.id, adminId: user?.id || 'admin', action: 'publish', reason: 'User published from studio' });
      showMessage(`Published ${book.title} successfully.`);
    } catch (err) {
      console.error(err);
      showMessage(`Publish failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-md bg-emerald-600 text-white px-4 py-2 mb-4">
          {message}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button className={`px-4 py-2 rounded-lg ${activeTab==='ebooks'?'bg-indigo-500/30':'bg-slate-900/10'}`} onClick={()=>setActiveTab('ebooks')}>📘 E-Books</button>
          <button className={`px-4 py-2 rounded-lg ${activeTab==='offline'?'bg-indigo-500/30':'bg-slate-900/10'}`} onClick={()=>setActiveTab('offline')}>🏫 Offline Library</button>
          <button className={`px-4 py-2 rounded-lg ${activeTab==='studio'?'bg-indigo-500/30':'bg-slate-900/10'}`} onClick={()=>setActiveTab('studio')}>✍️ Book Studio</button>
        </div>
        <div className="text-sm text-slate-400">Library — Unified Digital & Physical</div>
      </div>

      {/* Main Content */}
      {activeTab === 'ebooks' && (
        <div>
          <EBooksGrid onOpenBook={openBook} />
          {selectedBook && <div className="mt-4"><BookDetail book={selectedBook} onBuy={handleBuy} onDownload={handleDownload} onClose={closeBook} /></div>}
        </div>
      )}

      {activeTab === 'offline' && (
        <div>
          <OfflineLibrary schoolId={user?.schoolId || 'school-001'} userId={user?.id || 'guest'} />
          <div className="mt-6"><LibrarianPanel schoolId={user?.schoolId || 'school-001'} /></div>
        </div>
      )}

      {activeTab === 'studio' && (
        <div>
          <BookStudio auraBalance={user?.aura || 0} onPublish={handlePublish} />
          <div className="mt-6"><AdminPanel /></div>
        </div>
      )}
    </div>
  );
}
