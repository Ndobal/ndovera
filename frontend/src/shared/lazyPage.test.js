import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import lazyPage from './lazyPage';

const realLocation = window.location;
let reload;

class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p>Could not open</p> : this.props.children; }
}
const show = Page => render(<Boundary><Suspense fallback={<p>Loading</p>}><Page /></Suspense></Boundary>);

beforeEach(() => {
  window.sessionStorage.clear();
  reload = jest.fn();
  delete window.location;
  window.location = { reload };
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { window.location = realLocation; jest.restoreAllMocks(); });

test('a page loads when it is opened', async () => {
  const load = jest.fn(async () => ({ default: () => <p>The page</p> }));
  const Page = lazyPage(load);
  expect(load).not.toHaveBeenCalled();
  show(Page);
  expect(screen.getByText('Loading')).toBeInTheDocument();
  expect(await screen.findByText('The page')).toBeInTheDocument();
});

test('a file from an old version reloads once to pick up the current one', async () => {
  show(lazyPage(async () => { throw new Error('chunk gone'); }));
  await new Promise(done => setTimeout(done, 0));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('failing again shows the error screen instead of reloading for ever', async () => {
  window.sessionStorage.setItem('ndv-stale-reload', String(Date.now()));
  show(lazyPage(async () => { throw new Error('chunk gone'); }));
  expect(await screen.findByText('Could not open')).toBeInTheDocument();
  expect(reload).not.toHaveBeenCalled();
});
