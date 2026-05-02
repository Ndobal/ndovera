const { getAllBooks, upsertBook, borrowBook, getAllBorrowings } = require('./db');

async function main() {
  console.log('Seeding library...');
  const samples = [
    { id: 'book-ndovera-about', title: 'About Ndovera', author: 'ND Team', description: 'Intro to Ndovera platform', metadata: { pages: 12 } },
    { id: 'book-algebra-simplified', title: 'Algebra Simplified', author: 'J. Mathematician', description: 'Basic algebra for secondary students', metadata: { pages: 180 } },
    { id: 'book-waec-2010-23', title: 'WAEC Past Questions 2010-2023', author: 'Exam Prep', description: 'Compiled past questions and answers', metadata: { pages: 320 } },
  ];

  for (const b of samples) {
    const res = await upsertBook(b).catch(err => { console.error('upsertBook err', err && err.message); });
    console.log('Upserted', b.id, res && res.id);
  }

  // create a demo borrowing for student 'demo-student'
  const borrow = await borrowBook('book-algebra-simplified', 'demo-student', new Date(Date.now() + 7*24*3600*1000).toISOString(), { notes: 'Demo borrow' }).catch(e => { console.error('borrow err', e && e.message); });
  console.log('Created borrowing', borrow && borrow.id);

  const books = await getAllBooks().catch(()=>[]);
  const borrows = await getAllBorrowings().catch(()=>[]);
  console.log('Books count:', books && books.length);
  console.log('Borrowings count:', borrows && borrows.length);
  process.exit(0);
}

main();
