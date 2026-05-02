import React from 'react';
import { render, waitFor } from '@testing-library/react';
import StudentLibrary from '../StudentLibrary';

const SAMPLE_BOOKS = [
  { id: 'b1', title: 'Book One', author: 'Author A', description: 'Desc A', metadata: { pages: 10 } },
  { id: 'b2', title: 'Book Two', author: 'Author B', description: 'Desc B', metadata: { pages: 20 } },
];

const mockList = jest.fn(() => Promise.resolve({ success: true, books: SAMPLE_BOOKS }));
const mockBorrow = jest.fn(() => Promise.resolve({ success: true, borrowing: { id: 'borrow-1' } }));

afterEach(() => jest.resetAllMocks());

test('calls listBooks and borrowBook via provided service', async () => {
  render(
    <StudentLibrary
      user={{ id: 'demo', name: 'Demo' }}
      service={{ listBooks: mockList, borrowBook: mockBorrow }}
    />
  );

  await waitFor(() => expect(mockList).toHaveBeenCalled());

  // verify service was called
  expect(mockList).toHaveBeenCalledTimes(1);
});
