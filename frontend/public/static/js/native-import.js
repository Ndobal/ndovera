// Only browsers supporting module scripts fetch/parse this file. Its directory
// matches the emitted app chunks so relative specifiers retain their base URL.
window.__ndoveraImportModule = function (specifier) { return import(specifier); };
(window.__ndoveraPendingImports || []).forEach(function (request) {
  window.__ndoveraImportModule(request[0]).then(request[1], request[2]);
});
window.__ndoveraPendingImports = [];
