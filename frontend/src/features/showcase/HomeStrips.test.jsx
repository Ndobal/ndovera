import React from 'react';
import { render, screen } from '@testing-library/react';
import HomeStrips from './HomeStrips';
import { getHomeShowcase } from './showcaseApi';

jest.mock('./showcaseApi', () => ({ getHomeShowcase: jest.fn() }));

const SCHOOL = { name: 'Genesis College', logoUrl: '' };
const REVIEW = { rating: 5, body: 'Very useful for us.', name: 'Ada', detail: 'Teacher' };

// Either list can be empty while the other is not. This froze the whole home page on 5 Nov 2026.
test('schools with no reviews show, and the page does not freeze', async () => {
  getHomeShowcase.mockResolvedValue({ schools: [SCHOOL], reviews: [] });
  render(<HomeStrips />);
  expect((await screen.findAllByText('Genesis College')).length).toBeGreaterThan(0);
  expect(screen.queryByText('Very useful for us.')).toBeNull();
});

test('reviews with no schools show, and the page does not freeze', async () => {
  getHomeShowcase.mockResolvedValue({ schools: [], reviews: [REVIEW] });
  render(<HomeStrips />);
  expect((await screen.findAllByText(/Very useful for us/)).length).toBeGreaterThan(0);
  expect(screen.queryByText('Genesis College')).toBeNull();
});

test('with nothing to show, nothing shows', async () => {
  getHomeShowcase.mockResolvedValue({ schools: [], reviews: [] });
  const { container } = render(<HomeStrips />);
  await new Promise(done => setTimeout(done, 0));
  expect(container.textContent).toBe('');
});
