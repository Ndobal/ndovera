// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
try {
	// prefer import when available
	// eslint-disable-next-line global-require
	require('@testing-library/jest-dom');
} catch (e) {
	// best-effort: tests will still run without extended matchers
}
