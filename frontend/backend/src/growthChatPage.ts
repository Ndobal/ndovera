// The chat page visitors use (Ndovera's or a school's). Plain HTML and a little JavaScript,
// served by the Worker so it works on school websites too. Readable in light and dark mode.
// It never asks for card or bank details: registration and admission open the real forms.

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string))

export type ChatPageHost = { ref: string, name: string, kind: 'ndovera' | 'school', logoUrl?: string, privacyUrl: string, actionUrl: string, actionLabel: string, controller: string }

export function privacyNotice(host: ChatPageHost) {
  return `${host.controller} uses your name, email, phone and messages only to answer this enquiry and follow it up. ${host.kind === 'school' ? 'Ndovera runs this chat for the school and processes the details on its behalf. ' : ''}They are kept for up to two years, never sold, and you can delete this chat at any time with the "Delete my chat" button. The consultant is an automated assistant; staff may read the chat and reply.`
}

export function renderGrowthChatPage(host: ChatPageHost) {
  const api = `/api/growth/${encodeURIComponent(host.ref)}`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Chat with ${esc(host.name)}</title>
<style>
:root{--bg:#f1f5f9;--card:#ffffff;--text:#0f172a;--muted:#334155;--line:#cbd5e1;--brand:#191970;--brandText:#ffffff;--me:#e0e7ff;--meText:#0f172a;--bot:#f8fafc;--err:#9f1239;--errBg:#fff1f2}
@media(prefers-color-scheme:dark){:root{--bg:#020617;--card:#0f172a;--text:#f1f5f9;--muted:#cbd5e1;--line:#334155;--brand:#312e81;--brandText:#ffffff;--me:#1e1b4b;--meText:#f1f5f9;--bot:#111827;--err:#fecdd3;--errBg:#4c0519}}
*{box-sizing:border-box}body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:var(--bg);color:var(--text)}
main{max-width:680px;margin:0 auto;padding:16px}
header{display:flex;gap:12px;align-items:center;background:var(--brand);color:var(--brandText);padding:16px;border-radius:16px}
header img{width:44px;height:44px;border-radius:10px;background:#fff;object-fit:contain}
header h1{margin:0;font-size:18px}header p{margin:2px 0 0;font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin-top:12px}
#log{display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow:auto}
.msg{padding:10px 12px;border-radius:12px;max-width:88%;white-space:pre-wrap;line-height:1.45}
.msg small{display:block;font-size:11px;font-weight:700;color:var(--muted);margin-bottom:3px}
.bot{background:var(--bot);border:1px solid var(--line);align-self:flex-start}.me{background:var(--me);color:var(--meText);align-self:flex-end}
label{display:block;font-size:13px;font-weight:700;margin-top:8px;color:var(--text)}
input[type=text],input[type=email],input[type=tel],textarea{width:100%;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text);font-size:15px;margin-top:4px}
.check{display:flex;gap:8px;align-items:flex-start;font-weight:400;font-size:13px}.check input{margin-top:3px}
button,.action{background:var(--brand);color:var(--brandText);border:0;border-radius:10px;padding:10px 16px;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none;display:inline-block}
button.ghost{background:transparent;color:var(--text);border:1px solid var(--line)}
.row{display:flex;gap:8px;margin-top:8px}.row textarea{flex:1}
.err{color:var(--err);background:var(--errBg);padding:8px 10px;border-radius:10px;font-size:14px;margin-top:8px}
.notice{font-size:12px;color:var(--muted);line-height:1.5}a{color:inherit}
</style></head><body><main>
<header>${host.logoUrl ? `<img src="${esc(host.logoUrl)}" alt="">` : ''}<div><h1>${esc(host.name)}</h1><p>Chat with a virtual consultant (an automated assistant). Staff can join at any time.</p></div></header>
<div class="card"><div id="log" aria-live="polite"></div></div>
<form id="contact" class="card" hidden>
  <p style="margin:0;font-weight:700">So we can reply properly:</p>
  <label>Your name<input type="text" name="name" required maxlength="120" autocomplete="name"></label>
  <label>Email<input type="email" name="email" required maxlength="160" autocomplete="email"></label>
  <label>Phone<input type="tel" name="phone" required maxlength="30" autocomplete="tel"></label>
  <label class="check"><input type="checkbox" name="privacy" required> <span>I agree to the privacy notice below (needed to answer you).</span></label>
  <label class="check"><input type="checkbox" name="marketing"> <span>Optional: I would like occasional news from ${esc(host.name)}. I can stop it at any time.</span></label>
  <p class="notice">${esc(privacyNotice(host))} <a href="${esc(host.privacyUrl)}" target="_blank" rel="noopener">Full privacy policy</a>.</p>
  <button type="submit">Continue</button>
</form>
<form id="send" class="card"><label for="text">Your message</label><div class="row"><textarea id="text" rows="2" maxlength="2000" required></textarea><button type="submit">Send</button></div></form>
<div id="error" class="err" hidden role="alert"></div>
<div class="card" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between">
  <a class="action" href="${esc(host.actionUrl)}">${esc(host.actionLabel)}</a>
  <span class="notice">We never ask for card or bank details in this chat.</span>
  <button type="button" class="ghost" id="delete">Delete my chat</button>
</div>
</main>
<script>
(function(){
  var api = ${JSON.stringify(api)}, key = 'ndv-chat:' + ${JSON.stringify(host.ref)};
  var token = null; try { token = localStorage.getItem(key); } catch (e) {}
  var log = document.getElementById('log'), contact = document.getElementById('contact'), err = document.getElementById('error');
  function show(message) { err.textContent = message || ''; err.hidden = !message; }
  function call(path, method, body) {
    return fetch(api + path, { method: method || 'GET', headers: { 'Content-Type': 'application/json', 'X-Chat-Token': token || '' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.'); return d; }); });
  }
  function render(view) {
    log.innerHTML = '';
    (view.messages || []).forEach(function (m) {
      var div = document.createElement('div'); div.className = 'msg ' + (m.from === 'visitor' ? 'me' : 'bot');
      var who = document.createElement('small'); who.textContent = m.name; div.appendChild(who);
      div.appendChild(document.createTextNode(m.text)); log.appendChild(div);
    });
    log.scrollTop = log.scrollHeight;
    var asked = (view.messages || []).some(function (m) { return m.from === 'visitor'; });
    contact.hidden = view.hasContact || !asked;
  }
  function start() { return call('/start', 'POST', {}).then(function (d) { token = d.token; try { localStorage.setItem(key, token); } catch (e) {} return refresh(); }); }
  function refresh() { return call('/conversation').then(render).catch(function (e) { if (/ended/.test(e.message)) { token = null; return start(); } show(e.message); }); }
  document.getElementById('send').addEventListener('submit', function (ev) {
    ev.preventDefault(); var box = document.getElementById('text'); var text = box.value.trim(); if (!text) return;
    show(''); call('/message', 'POST', { text: text }).then(function (v) { box.value = ''; render(v); }).catch(function (e) { show(e.message); });
  });
  contact.addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = contact.elements; show('');
    call('/contact', 'POST', { name: f.name.value, email: f.email.value, phone: f.phone.value, privacyConsent: f.privacy.checked, marketingConsent: f.marketing.checked }).then(render).catch(function (e) { show(e.message); });
  });
  document.getElementById('delete').addEventListener('click', function () {
    if (!token || !confirm('Delete this chat and your details? This cannot be undone.')) return;
    call('/conversation', 'DELETE').then(function () { try { localStorage.removeItem(key); } catch (e) {} token = null; log.innerHTML = ''; show(''); start(); }).catch(function (e) { show(e.message); });
  });
  (token ? refresh() : start());
  setInterval(function () { if (token && document.visibilityState === 'visible') refresh(); }, 6000);
})();
</script></body></html>`
}

/** The floating button added to school website pages. */
export const CHAT_BUTTON_HTML = `<a href="/chat" style="position:fixed;right:16px;bottom:16px;z-index:50;background:#191970;color:#ffffff;padding:12px 18px;border-radius:999px;font:700 15px Segoe UI,Arial,sans-serif;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.25)">💬 Chat with us</a>`
