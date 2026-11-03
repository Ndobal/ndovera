/* Ndovera Lite: ES5 + XMLHttpRequest. No Promise/fetch, modules, modern CSS or service worker. */
(function (w, d) {
  'use strict';
  var app = d.getElementById('app');
  var auth = null;
  var role = '';
  var generation = 0;
  var busy = false;
  var key = 'ndovera:lite:session';
  var apiBase = String((w.NDOVERA_COMPAT_CONFIG || {}).apiBase || '').replace(/\/$/, '');
  function node(tag, text, parent) {
    var el = d.createElement(tag);
    if (text !== undefined && text !== null) el.textContent = String(text);
    if (parent) parent.appendChild(el);
    return el;
  }
  function message(text, error, parent) {
    var el = node('p', text, parent || app); el.className = 'message' + (error ? ' error' : ''); el.setAttribute('role', error ? 'alert' : 'status'); return el;
  }
  function clear() { generation += 1; while (app.firstChild) app.removeChild(app.firstChild); }
  function button(text, action, parent) { var el = node('button', text, parent || app); el.type = 'button'; el.onclick = action; return el; }
  function field(form, label, name, type) {
    var id = 'lite-' + name; var l = node('label', label, form); l.htmlFor = id;
    var input = node('input', null, form); input.id = id; input.name = name; input.type = type || 'text'; input.required = true;
    return input;
  }
  function save() { try { w.sessionStorage.setItem(key, JSON.stringify({auth:auth,role:role})); } catch (ignored) {} }
  function apiUrl(path) { return apiBase ? apiBase + (apiBase.slice(-4) === '/api' ? path.slice(4) : path) : path; }
  function request(method, path, data, done) {
    var current = generation, xhr = new w.XMLHttpRequest();
    xhr.open(method, apiUrl(path) + (path.indexOf('?') === -1 ? '?' : '&') + 'ndoveraClient=lite', true); xhr.timeout = 30000; xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    if (data !== null) xhr.setRequestHeader('Content-Type', 'application/json');
    if (auth && auth.token) xhr.setRequestHeader('Authorization', 'Bearer ' + auth.token);
    if (auth && role) xhr.setRequestHeader('X-Selected-Role', role);
    function fail(text) { if (current === generation) done(new Error(text)); }
    xhr.onerror = function () { fail('Could not connect. Check your connection. This device may also be unable to establish a secure connection to the server.'); };
    xhr.ontimeout = function () { fail('The request took too long. Please try again.'); };
    xhr.onload = function () {
      if (current !== generation) return;
      var body;
      try { body = JSON.parse(xhr.responseText); } catch (ignored) { fail('The server did not return readable data. Please try again.'); return; }
      if (xhr.status === 401 && auth) { logout(); message('Your session has expired. Please sign in again.'); return; }
      if (xhr.status < 200 || xhr.status >= 300 || (body && body.success === false)) { fail((body && (body.message || body.error)) || 'The request could not be completed.'); return; }
      var refreshed = xhr.getResponseHeader('X-Refresh-Token');
      if (refreshed && auth) { auth.token = refreshed; save(); }
      done(null, body);
    };
    try { xhr.send(data === null ? null : JSON.stringify(data)); } catch (ignored) { fail('Could not start the request. Please try again.'); }
  }
  function session(payload) {
    var user = payload && (payload.user || {id:payload.id, name:payload.name, role:payload.role});
    if (!payload || typeof payload.token !== 'string' || !payload.token || !user || !user.role) return false;
    auth = {token:payload.token,user:user}; role = user.role; save(); return true;
  }
  function logout() {
    auth = null; role = ''; busy = false;
    if (w.navigator.serviceWorker && w.navigator.serviceWorker.controller) w.navigator.serviceWorker.controller.postMessage({type:'CLEAR_USER_CACHE'});
    try { w.sessionStorage.removeItem(key); } catch (ignored) {}
    // Sign out of the shared browser session as the standard client does.
    try { var keys = ['token','authUser','selectedRole','userId','classroomId','teacherClassroomId']; for (var i=0;i<keys.length;i++) w.localStorage.removeItem(keys[i]); } catch (ignored2) {}
    d.cookie = 'ndovera_token=; path=/; max-age=0; secure; samesite=lax';
    if (/(^|\.)ndovera\.com$/i.test(w.location.hostname)) d.cookie = 'ndovera_token=; domain=.ndovera.com; path=/; max-age=0; secure; samesite=lax';
    login();
  }
  function login() {
    busy = false; clear(); node('h1','Sign in',app); var form = node('form',null,app); form.className='card';
    var id=field(form,'Email, phone number or account ID','id'); id.autocomplete='username';
    var password=field(form,'Password','password','password'); password.autocomplete='current-password';
    var submit=node('button','Sign in',form); submit.type='submit';
    form.onsubmit=function(e){e.preventDefault();if(busy)return;busy=true;submit.disabled=true;
      var credentials={id:id.value.replace(/^\s+|\s+$/g,''),password:password.value};
      request('POST','/api/auth/login',credentials,function(err,data){busy=false;submit.disabled=false;password.value='';
        if(err){message(err.message,true,form);return;} if(!session(data)){message('The sign-in response was incomplete.',true,form);return;}
        if(auth.user.mustChangePassword || data.mustChangePassword) changePassword(); else home();
      });
    };
    button('Forgot password?',forgot,app);
    message('Lite keeps this sign-in for this tab only. Materials are not saved for offline access.');
  }
  function forgot(){
    clear();node('h1','Reset your password',app);var f=node('form',null,app),email=field(f,'Email address','email','email');var b=node('button','Send reset link',f);b.type='submit';
    f.onsubmit=function(e){e.preventDefault();b.disabled=true;request('POST','/api/auth/forgot-password',{email:email.value},function(err){b.disabled=false;message(err?err.message:'If the account is eligible, a reset link will be sent.',!!err,f);});};button('Back to sign in',login);
  }
  function changePassword(){
    clear();node('h1','Change your password',app);var f=node('form',null,app),p=field(f,'New password (at least 8 characters)','new-password','password'),confirm=field(f,'Confirm new password','confirm-password','password');p.autocomplete=confirm.autocomplete='new-password';
    var b=node('button','Save password',f);b.type='submit';
    f.onsubmit=function(e){e.preventDefault();if(p.value.length<8 || p.value!==confirm.value){message('Enter matching passwords of at least 8 characters.',true,f);return;}b.disabled=true;
      request('POST','/api/auth/change-password',{newPassword:p.value},function(err,data){b.disabled=false;p.value=confirm.value='';if(err){message(err.message,true,f);return;}if(!session(data)){logout();return;}home();});
    };button('Sign out',logout);
  }
  function reset(){
    clear();node('h1','Choose a new password',app);var match=/(?:^|[?&])token=([^&]*)/.exec(w.location.search),token='';try{token=match?decodeURIComponent(match[1]):'';}catch(ignored){}
    if(!token){message('Open the complete reset link from your email.',true);button('Sign in',login);return;}
    var f=node('form',null,app),p=field(f,'New password (at least 8 characters)','reset-password','password'),c=field(f,'Confirm password','reset-confirm','password');var b=node('button','Reset password',f);b.type='submit';
    f.onsubmit=function(e){e.preventDefault();if(p.value.length<8||p.value!==c.value){message('Enter matching passwords of at least 8 characters.',true,f);return;}b.disabled=true;request('POST','/api/auth/reset-password',{token:token,newPassword:p.value},function(err){b.disabled=false;p.value=c.value='';if(err){message(err.message,true,f);return;}w.location.replace('/compat/index.html');});};
  }
  function header(title){clear();node('h1',title,app);node('p','Signed in as '+(auth.user.name||auth.user.id||'your account'),app);button('My classes',home);button('Sign out',logout);}
  function home(){
    if(!auth){login();return;} if(auth.user.mustChangePassword){changePassword();return;}
    header('My classes');var roles=auth.user.switchableRoles||auth.user.roles||[auth.user.role];if(typeof roles==='string')roles=roles.split(',');
    if(roles.length>1){var label=node('label','View as',app),select=node('select',null,app);select.id='lite-role';label.htmlFor=select.id;for(var i=0;i<roles.length;i++){var option=node('option',roles[i],select);option.value=roles[i];option.selected=roles[i]===role;}select.onchange=function(){role=select.value;save();home();};}
    var status=message('Loading your classes…');
    request('GET','/api/classrooms/assigned',null,function(err,data){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}var classes=data.classes||[];
      if(!classes.length){message('No classes were returned for this account and role. Ask your school to check your class assignment.');return;}
      var list=node('ul',null,app);list.className='list';for(var j=0;j<classes.length;j++)(function(item){var li=node('li',null,list);button((item.name||'Class')+(item.arm?' '+item.arm:''),function(){classPage(item,'materials');},li);}(classes[j]));
    });
  }
  function plain(value){return typeof value==='string'?value.replace(/<\s*br\s*\/?\s*>/gi,'\n').replace(/<\/(p|div|li|h[1-6])\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(nbsp|amp|lt|gt|quot|#39);/g,function(s,n){return {nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[n];}):'';}
  function link(parent,url,title){
    if(typeof url!=='string'||!url||/^\s*\/\//.test(url))return;
    var a=d.createElement('a');a.href=url;
    if(a.protocol!=='https:' && !(a.protocol===w.location.protocol && a.host===w.location.host && /^\//.test(url)))return;
    a.textContent=title||'Open attachment';a.rel='noreferrer noopener';parent.appendChild(a);
  }
  function classPage(item,section){
    header(item.name||'Class');var nav=node('nav',null,app);nav.setAttribute('aria-label','Class sections');var sections=['materials','topics','assignments','stream'];
    for(var i=0;i<sections.length;i++)(function(name){button(name==='stream'?'Class updates':name.charAt(0).toUpperCase()+name.slice(1),function(){classPage(item,name);},nav);}(sections[i]));
    var status=message('Loading…');request('GET','/api/classrooms/'+encodeURIComponent(item.id)+'/'+section,null,function(err,data){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}
      var items=data[section==='stream'?'posts':section]||[];
      if(data.academicContext){var context=data.academicContext;node('p',[context.sessionName,context.termName].filter(function(x){return !!x;}).join(' · '),app);}
      if(!items.length){message('No '+(section==='stream'?'updates':section)+' are available.');return;}
      for(var j=0;j<items.length;j++){var entry=items[j],card=node('article',null,app);card.className='card';node('h2',entry.title||entry.name||'Class update',card);
        var text=plain(entry.content||entry.body||entry.description||entry.instructions||'');if(text){var body=node('p',text,card);body.className='body';}
        if(entry.dueDate||entry.dueAt)node('p','Due: '+(entry.dueDate||entry.dueAt),card);
        if(entry.studentStatus)node('p','Status: '+entry.studentStatus,card);
        if(section==='assignments')message('Read the instructions here. Use the standard version to start or submit this assignment.',false,card);
        link(card,entry.fileUrl||entry.url,'Open file');var files=entry.attachments||[];if(Object.prototype.toString.call(files)==='[object Array]')for(var k=0;k<files.length;k++){var file=files[k];node('p',null,card);link(card,typeof file==='string'?file:file.url||file.fileUrl,typeof file==='object'?file.name:'Open attachment');}
      }
    });
  }
  try {var saved=JSON.parse(w.sessionStorage.getItem(key)||'null');if(saved&&saved.auth&&saved.auth.token){auth=saved.auth;role=saved.role||auth.user.role;}}catch(ignored){}
  if(w.location.hash==='#reset')reset();else if(auth)home();else login();
}(window,document));
