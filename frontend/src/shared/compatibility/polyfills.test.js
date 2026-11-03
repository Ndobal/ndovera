// Simulate the missing web APIs that previously prevented the router and login
// from loading on Android 4.4 / iOS 9. This does not emulate their rendering engines.
test('installs missing networking, URL and encoding APIs', () => {
  const saved = {};
  const names = ['fetch', 'Headers', 'Request', 'Response', 'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams'];
  names.forEach(name => { saved[name] = window[name]; delete window[name]; });
  try {
    jest.isolateModules(() => {
      require('./polyfills');
      names.forEach(name => expect(typeof window[name]).toBe('function'));
      expect(new TextEncoder().encode('Ndovera ₦').length).toBe(11);
      const url = new URL('/login?school=genesis', 'https://ndovera.com');
      expect(url.searchParams.get('school')).toBe('genesis');
    });
  } finally {
    names.forEach(name => { window[name] = saved[name]; });
  }
});
