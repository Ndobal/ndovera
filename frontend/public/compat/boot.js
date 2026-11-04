/* Runs before the application bundle. Deliberately ES5; no eval or polyfills needed. */
(function (w, d) {
  'use strict';
  var ua = w.navigator.userAgent || '';
  var android = /Android\s+(\d+)/i.exec(ua);
  var ios = /(?:iPhone|iPad|iPod).*OS\s+(\d+)[_\d]*/i.exec(ua);
  var query = w.location.search || '';
  var standard = /(?:^|[?&])ndovera-view=standard(?:&|$)/.test(query);
  var requested = /(?:^|[?&])ndovera-view=lite(?:&|$)/.test(query);
  // The main app stops at once on an engine that refuses this flag (Chromium before 50, Safari before 10).
  var unicodeFlag = true;
  try { new RegExp('a', 'u'); } catch (notSupported) { unicodeFlag = false; }
  var needsLite = (android && Number(android[1]) < 5) || (ios && Number(ios[1]) < 10) || !unicodeFlag ||
    !w.Promise || !w.fetch || !w.Map || !w.Set || !w.URLSearchParams;
  if (w.location.pathname.indexOf('/compat/') === 0 || standard) return;
  function goToLite() {
    // Keep password-reset tokens on this origin only; never forward them as return URLs.
    var token = /(?:^|[?&])token=([^&]*)/.exec(query);
    var reset = w.location.pathname === '/reset-password' && token;
    // A payment coming back, or an invoice link, carries on inside Lite.
    var paid = /(?:^|[?&])(practice_tx|payment_ref)=([^&]*)/.exec(query);
    var invoice = /^\/invoice\/([^\/?#]+)/.exec(w.location.pathname);
    // Links sent to parents and helpers open their own page in Lite.
    var shared = /^\/(invite|pay|bank-pay)\/([^\/?#]+)/.exec(w.location.pathname);
    var next = reset ? '?token=' + token[1] + '#reset' : (paid ? '?' + paid[1] + '=' + paid[2] : '') + (invoice ? '#invoice=' + invoice[1] : '') + (shared ? '#' + shared[1] + '=' + shared[2] : '');
    w.location.replace('/compat/index.html' + next);
  }
  if (requested || needsLite) { goToLite(); return; }
  // Phones between old and new try the main app. If it cannot start on one, it goes to Lite instead of a blank page.
  var inBetween = (android && Number(android[1]) < 8) || (ios && Number(ios[1]) < 13);
  if (!inBetween || !d.getElementById) return;
  function started() { var root = d.getElementById('root'); return Boolean(root && root.children.length); }
  var waiting = true;
  function check() { if (waiting && !started()) { waiting = false; goToLite(); } }
  w.addEventListener('error', function (event) { if (!event.target || event.target === w) w.setTimeout(check, 1500); });
  w.setTimeout(check, 45000);
}(window, document));
