const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '..');
const boot = fs.readFileSync(path.join(base,'public/compat/boot.js'),'utf8');
function navigate(ua, search='', missing=false, pathname='/login') {
  let destination;
  const window = {navigator:{userAgent:ua}, location:{pathname,search,replace:value=>{destination=value;}},Promise:!missing,fetch:!missing,Map:true,Set:true,URLSearchParams:true};
  vm.runInNewContext(boot,{window,document:{}});return destination;
}
test('KitKat and iOS 9 enter Lite before the modern bundle',()=>{
 assert.equal(navigate('Mozilla/5.0 (Linux; Android 4.4.4) AppleWebKit/537.36 Chrome/30.0.0.0'),'/compat/index.html');
 assert.equal(navigate('Mozilla/5.0 (iPad; CPU OS 9_3_5 like Mac OS X)'),'/compat/index.html');
});
test('existing modern platform targets keep the standard interface',()=>{
 assert.equal(navigate('Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X)'),undefined);
 assert.equal(navigate('Mozilla/5.0 (Linux; Android 14)'),undefined);
});
test('missing core APIs and explicit Lite choice have a fallback',()=>{
 assert.equal(navigate('Other browser','',true),'/compat/index.html');
 assert.equal(navigate('Modern','?ndovera-view=lite'),'/compat/index.html');
});
test('standard override is exact and Lite never redirects itself',()=>{
 assert.equal(navigate('Android 4.4','?ndovera-view=standard'),undefined);
 assert.equal(navigate('Android 4.4','?x=ndovera-view=standard'),'/compat/index.html');
 assert.equal(navigate('Android 4.4','',true,'/compat/index.html'),undefined);
});
test('reset link retains only its token on the same origin',()=>{
 assert.equal(navigate('Android 4.4','?token=abc%2F123&next=https://bad.example',false,'/reset-password'),'/compat/index.html?token=abc%2F123#reset');
});
test('shell loads detection before app and separate assets exist',()=>{
 const html=fs.readFileSync(path.join(base,'public/index.html'),'utf8');assert.ok(html.indexOf('/compat/boot.js')<html.indexOf('<div id="root"'));
 for(const file of ['app.js','boot.js','config.js','style.css','index.html'])assert.ok(fs.existsSync(path.join(base,'public/compat',file)));
});
function worker() {
 let code=fs.readFileSync(path.join(base,'public/_worker.js'),'utf8').replace(/import \{ botGate \}[^;]+;/,'const botGate = () => null;').replace('export default {','globalThis.worker = {');
 const context={URL,Headers,Request,Response};vm.createContext(context);vm.runInContext(code,context);return context.worker;
}
test('Lite assets bypass the React shell and are private, uncached responses',async()=>{
 let fetched;const response=await worker().fetch(new Request('https://ndovera.com/compat/index.html'),{ASSETS:{fetch:async r=>{fetched=r.url;return new Response('lite',{headers:{'Content-Type':'text/html'}})}}});
 assert.equal(fetched,'https://ndovera.com/compat/index.html');assert.equal(await response.text(),'lite');assert.equal(response.headers.get('Cache-Control'),'no-store');assert.match(response.headers.get('X-Robots-Tag'),/noindex/);assert.match(response.headers.get('Content-Security-Policy'),/script-src 'self'/);
});
test('Lite directory canonicalises and missing scripts are not HTML',async()=>{
 const w=worker();assert.equal((await w.fetch(new Request('https://ndovera.com/compat'),{})).headers.get('Location'),'https://ndovera.com/compat/index.html');
 const res=await w.fetch(new Request('https://ndovera.com/compat/missing.js'),{ASSETS:{fetch:async()=>new Response('spa',{headers:{'Content-Type':'text/html'}})}});assert.equal(res.status,404);
});
test('service worker excludes Lite before caching navigation or API data',()=>{
 const sw=fs.readFileSync(path.join(base,'public/sw.js'),'utf8');assert.ok(sw.indexOf("requestUrl.pathname.indexOf('/compat/')")<sw.indexOf("if (isNavigationRequest) {"));
});

test('every Lite browser script parses as ES5',()=>{
 const acorn=require('acorn');
 for(const file of ['boot.js','app.js','config.js'])acorn.parse(fs.readFileSync(path.join(base,'public/compat',file),'utf8'),{ecmaVersion:5});
});
test('Lite API calls opt out of the standard offline cache',()=>{
 const client=fs.readFileSync(path.join(base,'public/compat/app.js'),'utf8');
 const sw=fs.readFileSync(path.join(base,'public/sw.js'),'utf8');
 assert.match(client,/ndoveraClient=lite/);assert.match(sw,/searchParams.get\('ndoveraClient'\) === 'lite'/);
});
