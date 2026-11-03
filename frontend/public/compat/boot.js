/* Runs before the application bundle. Deliberately ES5; no eval or polyfills needed. */
(function (w, d) {
  'use strict';
  var ua = w.navigator.userAgent || '';
  var android = /Android\s+(\d+)/i.exec(ua);
  var ios = /(?:iPhone|iPad|iPod).*OS\s+(\d+)[_\d]*/i.exec(ua);
  var query = w.location.search || '';
  var standard = /(?:^|[?&])ndovera-view=standard(?:&|$)/.test(query);
  var requested = /(?:^|[?&])ndovera-view=lite(?:&|$)/.test(query);
  var needsLite = (android && Number(android[1]) < 5) || (ios && Number(ios[1]) < 12) ||
    !w.Promise || !w.fetch || !w.Map || !w.Set || !w.URLSearchParams;
  if (w.location.pathname.indexOf('/compat/') === 0 || standard) return;
  if (requested || needsLite) {
    // Keep password-reset tokens on this origin only; never forward them as return URLs.
    var token = /(?:^|[?&])token=([^&]*)/.exec(query);
    var reset = w.location.pathname === '/reset-password' && token;
    w.location.replace('/compat/index.html' + (reset ? '?token=' + token[1] + '#reset' : ''));
  }
}(window, document));
