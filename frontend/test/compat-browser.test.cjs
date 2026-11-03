const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
test('Lite works without fetch or persistent storage and safely reads authorised class content',async()=>{
 let authorization, selectedRole;
 const server=http.createServer((req,res)=>{
  const requestPath=req.url.split('?')[0];
  if(requestPath.startsWith('/api/')){
   res.setHeader('Content-Type','application/json');authorization=req.headers.authorization;selectedRole=req.headers['x-selected-role'];
   if(requestPath==='/api/auth/login')return res.end(JSON.stringify({token:'fixture-token',user:{id:'learner',name:'Amina',role:'student'}}));
   if(requestPath==='/api/classrooms/assigned')return res.end(JSON.stringify({classes:[{id:'c1',name:'Primary 6'}]}));
   if(requestPath==='/api/classrooms/c1/materials')return res.end(JSON.stringify({materials:[{title:'Fractions',content:'<p>A half is one of two equal parts.</p><img src=x onerror="window.pwned=true">',fileUrl:'javascript:alert(1)'}]}));
   if(requestPath==='/api/classrooms/c1/assignments')return res.end(JSON.stringify({assignments:[{title:'Homework',instructions:'Explain equivalent fractions',studentStatus:'Pending'}]}));
   res.statusCode=403;return res.end(JSON.stringify({message:'Not allowed'}));
  }
  const file=path.join(__dirname,'../public',req.url.split('?')[0]);
  if(!file.startsWith(path.join(__dirname,'../public/compat/'))){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let dom;
 function waitFor(check) {return new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{try{const value=check();if(value){clearInterval(timer);resolve(value);}else if(Date.now()-start>4000){clearInterval(timer);reject(new Error('UI did not reach expected state'));}}catch(err){clearInterval(timer);reject(err);}},20);});}
 try {
  dom=await JSDOM.fromURL('http://127.0.0.1:'+server.address().port+'/compat/index.html',{resources:'usable',runScripts:'dangerously',beforeParse(window){window.fetch=undefined;window.URLSearchParams=undefined;Object.defineProperty(window,'sessionStorage',{get(){throw new Error('blocked');}});}});
  const w=dom.window,d=w.document;
  const findButton=name=>Array.from(d.querySelectorAll('button')).find(b=>b.textContent===name);
  await waitFor(()=>d.getElementById('lite-id'));
  d.getElementById('lite-id').value='learner';d.getElementById('lite-password').value='test-only';
  d.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  (await waitFor(()=>findButton('Primary 6'))).click();
  await waitFor(()=>d.getElementById('app').textContent.includes('Fractions'));
  assert.equal(authorization,'Bearer fixture-token');assert.equal(selectedRole,'student');
  assert.equal(d.querySelectorAll('a[href^="javascript:"]').length,0);assert.equal(w.pwned,undefined);
  assert.match(d.getElementById('app').textContent,/A half is one of two equal parts/);
  findButton('Assignments').click();await waitFor(()=>d.getElementById('app').textContent.includes('Homework'));
  assert.match(d.getElementById('app').textContent,/standard version to start or submit/);
  findButton('Sign out').click();assert.ok(d.getElementById('lite-password'));assert.doesNotMatch(d.getElementById('app').textContent,/Homework/);
 } finally {if(dom)dom.window.close();await new Promise(resolve=>server.close(resolve));}
});
