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
  // Lite has no invitation form, so a parent's invitation always opens in the standard app.
  if (w.location.pathname.indexOf('/compat/') === 0 || w.location.pathname.indexOf('/invite/') === 0 || w.location.pathname.indexOf('/pay/') === 0 || standard) return;
  if (requested || needsLite) {
    // Keep password-reset tokens on this origin only; never forward them as return URLs.
    var token = /(?:^|[?&])token=([^&]*)/.exec(query);
    var reset = w.location.pathname === '/reset-password' && token;
    // A payment coming back, or an invoice link, carries on inside Lite.
    var paid = /(?:^|[?&])(practice_tx|payment_ref)=([^&]*)/.exec(query);
    var invoice = /^\/invoice\/([^\/?#]+)/.exec(w.location.pathname);
    var next = reset ? '?token=' + token[1] + '#reset' : (paid ? '?' + paid[1] + '=' + paid[2] : '') + (invoice ? '#invoice=' + invoice[1] : '');
    w.location.replace('/compat/index.html' + next);
  }
}(window, document));
