// Imports are ordered: fetch needs Promise, and react-router evaluates TextEncoder
// while its modules are being loaded. Keep this before every application import.
import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';
import 'fast-text-encoding';
