/* Ndovera Lite: ES5 + XMLHttpRequest. No Promise/fetch, modules, modern CSS or service worker.
   Old browsers have no service worker: lite.appcache keeps these files on the phone, and work
   waits in localStorage until the connection is back. */
(function (w, d) {
  'use strict';
  var app = d.getElementById('app');
  var auth = null;
  var role = '';
  var generation = 0;
  var busy = false;
  var clock = null;
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
  function clear() { generation += 1; if (clock) { w.clearInterval(clock); clock = null; } while (app.firstChild) app.removeChild(app.firstChild); }
  function button(text, action, parent) { var el = node('button', text, parent || app); el.type = 'button'; el.onclick = action; return el; }
  function field(form, label, name, type) {
    var id = 'lite-' + name; var l = node('label', label, form); l.htmlFor = id;
    var input = node('input', null, form); input.id = id; input.name = name; input.type = type || 'text'; input.required = true;
    return input;
  }
  function save() { try { w.localStorage.setItem(key, JSON.stringify({auth:auth,role:role})); w.localStorage.setItem('token', auth.token); w.localStorage.setItem('authUser', JSON.stringify(auth.user)); w.localStorage.setItem('selectedRole', role); } catch (ignored) {} }
  /* One sign-in with the main app: someone already signed in there is signed in here. */
  function mainSession() {
    var token = '', user = null;
    try { token = w.localStorage.getItem('token') || ''; user = JSON.parse(w.localStorage.getItem('authUser') || 'null'); } catch (ignored) {}
    if (!token) { var cookie = /(?:^|;\s*)ndovera_token=([^;]+)/.exec(d.cookie || ''); token = cookie ? cookie[1] : ''; }
    if (!token) return false;
    if (!user || !user.role) { try { user = JSON.parse(w.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (ignored2) { return false; } }
    if (!user || !user.role) return false;
    auth = {token: token, user: user}; try { role = w.localStorage.getItem('selectedRole') || user.role; } catch (ignored3) { role = user.role; }
    return true;
  }
  function userKey(suffix) { return 'ndovera:lite:' + ((auth && auth.user && (auth.user.id || auth.user.email)) || 'guest') + ':' + suffix; }
  function kept(suffix) { try { return JSON.parse(w.localStorage.getItem(userKey(suffix)) || 'null'); } catch (ignored) { return null; } }
  function keep(suffix, value) { try { w.localStorage.setItem(userKey(suffix), JSON.stringify(value)); return true; } catch (ignored) { return false; } }
  function drop(suffix) { try { w.localStorage.removeItem(userKey(suffix)); } catch (ignored) {} }
  var NETWORK_TEXT = 'Your network (mobile data or Wi-Fi) is not reaching Ndovera.';
  var BUSY_TEXT = 'Ndovera is very busy right now.';
  function apiUrl(path) { return apiBase ? apiBase + (apiBase.slice(-4) === '/api' ? path.slice(4) : path) : path; }
  function request(method, path, data, done, background) {
    var current = generation, xhr = new w.XMLHttpRequest();
    var isForm = !!(w.FormData && data instanceof w.FormData);
    xhr.open(method, apiUrl(path) + (path.indexOf('?') === -1 ? '?' : '&') + 'ndoveraClient=lite', true); xhr.timeout = isForm ? 300000 : 30000; xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    if (data !== null && !isForm) xhr.setRequestHeader('Content-Type', 'application/json');
    if (auth && auth.token) xhr.setRequestHeader('Authorization', 'Bearer ' + auth.token);
    if (auth && role) xhr.setRequestHeader('X-Selected-Role', role);
    function fail(text, offline, details, status) { if (background || current === generation) { var error = new Error(text); error.offline = !!offline; error.details = details || null; error.status = status || 0; done(error); } }
    xhr.onerror = function () { fail(NETWORK_TEXT + ' This device may also be unable to make a secure connection to the server.', true); };
    xhr.ontimeout = function () { fail(NETWORK_TEXT, true); };
    xhr.onload = function () {
      if (!background && current !== generation) return;
      if (xhr.status === 502 || xhr.status === 503 || xhr.status === 504) { fail(BUSY_TEXT, true); return; }
      var body;
      try { body = JSON.parse(xhr.responseText); } catch (ignored) { fail('The server did not return readable data. Please try again.'); return; }
      if (xhr.status === 401 && auth) { if (background) { fail('Please sign in again to send your saved work.', true, null, 401); return; } signedOutKeepingWork(); return; }
      if (xhr.status < 200 || xhr.status >= 300 || (body && body.success === false)) { fail((body && (body.message || body.error)) || 'The request could not be completed.', false, body, xhr.status); return; }
      var refreshed = xhr.getResponseHeader('X-Refresh-Token');
      if (refreshed && auth) { auth.token = refreshed; save(); }
      done(null, body);
    };
    try { xhr.send(data === null ? null : isForm ? data : JSON.stringify(data)); } catch (ignored) { fail(NETWORK_TEXT, true); }
  }
  function session(payload) {
    var user = payload && (payload.user || {id:payload.id, name:payload.name, role:payload.role});
    if (!payload || typeof payload.token !== 'string' || !payload.token || !user || !user.role) return false;
    auth = {token:payload.token,user:user}; role = user.role; save(); return true;
  }
  function signedOutKeepingWork() {
    auth = null; role = ''; busy = false; try { w.localStorage.removeItem(key); } catch (ignored) {}
    login(); message('Your session has expired. Please sign in again. Any saved work stays on this phone and is sent once you are back.');
  }
  function logout() {
    var waiting = auth ? outbox().length : 0;
    if (waiting && !w.confirm('You have ' + waiting + ' piece(s) of work not yet sent. Signing out removes them from this phone. Sign out anyway?')) return;
    if (auth) { try { var prefix = userKey(''), names = []; for (var n = 0; n < w.localStorage.length; n++) names.push(w.localStorage.key(n)); for (var m = 0; m < names.length; m++) if (names[m].indexOf(prefix) === 0) w.localStorage.removeItem(names[m]); } catch (ignored3) {} }
    auth = null; role = ''; busy = false;
    if (w.navigator.serviceWorker && w.navigator.serviceWorker.controller) w.navigator.serviceWorker.controller.postMessage({type:'CLEAR_USER_CACHE'});
    try { w.localStorage.removeItem(key); w.sessionStorage.removeItem(key); } catch (ignored) {}
    // Sign out of the shared browser session as the standard client does.
    try { var keys = ['token','authUser','selectedRole','userId','classroomId','teacherClassroomId']; for (var i=0;i<keys.length;i++) w.localStorage.removeItem(keys[i]); } catch (ignored2) {}
    d.cookie = 'ndovera_token=; path=/; max-age=0; secure; samesite=lax';
    if (/(^|\.)ndovera\.com$/i.test(w.location.hostname)) d.cookie = 'ndovera_token=; domain=.ndovera.com; path=/; max-age=0; secure; samesite=lax';
    login();
  }
  function login() {
    busy = false; clear(); clearNode(shell); closeMenu(); node('h1','Sign in',app); var form = node('form',null,app); form.className='card';
    var id=field(form,'Email, phone number or account ID','id'); id.autocomplete='username';
    var password=field(form,'Password','password','password'); password.autocomplete='current-password';
    var submit=node('button','Sign in',form); submit.type='submit';
    form.onsubmit=function(e){e.preventDefault();if(busy)return;busy=true;submit.disabled=true;
      var credentials={id:id.value.replace(/^\s+|\s+$/g,''),password:password.value};
      request('POST','/api/auth/login',credentials,function(err,data){busy=false;submit.disabled=false;password.value='';
        if(err){message(err.message,true,form);return;} if(!session(data)){message('The sign-in response was incomplete.',true,form);return;}
        if(auth.user.mustChangePassword || data.mustChangePassword) changePassword(); else { flush(); home(); }
      });
    };
    button('Forgot password?',forgot,app);
    message('You stay signed in on this phone, so your work is here without internet. Sign out on a shared phone.');
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
  function isRole(name){return String(role||'').toLowerCase()===name;}
  /* A saved copy when the network fails: what is on the phone is better than an error. */
  function load(path,suffix,done){request('GET',path,null,function(err,data){if(!err){keep(suffix,{at:new Date().getTime(),data:data});done(null,data,false);return;}var copy=err.offline?kept(suffix):null;if(copy){done(null,copy.data,new Date(copy.at));return;}done(err);});}
  function savedNote(at){if(at)message(NETWORK_TEXT+' Showing what was saved on this phone on '+at.toLocaleString()+'.');}
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
    button('Save this class for offline',function(){saveClass(item);},nav);
    if(isTeaching()){var tools=node('div',null,app);tools.className='tools';if(section==='materials')button('Upload material',function(){uploadPage(item);},tools);if(section==='stream')button('Post an update',function(){postPage(item);},tools);if(section==='assignments')button('New assignment',function(){newAssignmentPage(item);},tools);button('Take attendance',function(){markRegister(item);},tools);}
    if(isRole('student')&&section==='stream'){var mine=node('div',null,app);mine.className='tools';button('Post an update',function(){postPage(item);},mine);}
    var status=message('Loading…');load('/api/classrooms/'+encodeURIComponent(item.id)+'/'+section,'class:'+item.id+':'+section,function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);
      var items=data[section==='stream'?'posts':section]||[];
      if(data.academicContext){var context=data.academicContext;node('p',[context.sessionName,context.termName].filter(function(x){return !!x;}).join(' · '),app);}
      if(!items.length){message('No '+(section==='stream'?'updates':section)+' are available.');return;}
      for(var j=0;j<items.length;j++){var entry=items[j],card=node('article',null,app);entry.classId=item.id;card.className='card';node('h2',entry.title||entry.name||'Class update',card);
        var text=plain(entry.content||entry.body||entry.description||entry.instructions||'');if(text){var body=node('p',text,card);body.className='body';}
        if(entry.dueDate||entry.dueAt)node('p','Due: '+(entry.dueDate||entry.dueAt),card);
        if(entry.studentStatus)node('p','Status: '+entry.studentStatus,card);
        if(section==='assignments'&&isTeaching())(function(work){button('See answers and mark',function(){markingPage(item,work);},card);}(entry));
        if(section==='assignments'&&isRole('student'))(function(work){var mine=queuedFor(work.id);if(mine)node('p','Saved on this phone. It will be sent when the connection is back.',card);button(work.mySubmission||mine?'Open again':'Open and answer',function(){assignmentPage(item,work);},card);}(entry));
        link(card,entry.fileUrl||entry.url,'Open file');var files=entry.attachments||[];if(Object.prototype.toString.call(files)==='[object Array]')for(var k=0;k<files.length;k++){var file=files[k];node('p',null,card);link(card,typeof file==='string'?file:file.url||file.fileUrl,typeof file==='object'?file.name:'Open attachment');}
      }
    });
  }
  function saveClass(item){var names=['materials','topics','assignments','stream'],left=names.length,failed=0;var note=message('Saving this class…');for(var i=0;i<names.length;i++)(function(name){request('GET','/api/classrooms/'+encodeURIComponent(item.id)+'/'+name,null,function(err,data){if(err||!keep('class:'+item.id+':'+name,{at:new Date().getTime(),data:data}))failed+=1;left-=1;if(!left)note.textContent=failed?'Some of this class could not be saved. Try again with a better connection.':'This class is saved on this phone. Attached files need a connection.';});}(names[i]));}

  /* ─── Work that waits for a connection ─── */
  function outbox(){return kept('outbox')||[];}
  function setOutbox(list){return keep('outbox',list);}
  function queuedFor(id){var list=outbox();for(var i=0;i<list.length;i++)if(list[i].kind==='submit'&&list[i].assignmentId===id)return list[i];return null;}
  function enqueue(item){var list=outbox();item.id=newId('out');item.queuedAt=new Date().toISOString();item.reason='';list.push(item);return setOutbox(list);}
  function newId(prefix){return prefix+'_'+new Date().getTime().toString(36)+'_'+Math.random().toString(36).slice(2,10);}
  var flushing=false;
  /* One at a time, oldest first. No network: stop and try later. A refusal stays listed with its reason. */
  function flush(){
    if(!auth||flushing||w.navigator.onLine===false)return;var list=outbox(),next=null;
    for(var i=0;i<list.length;i++)if(!list[i].reason){next=list[i];break;}
    if(!next)return;flushing=true;
    request('POST',next.path,next.body,function(err){flushing=false;var now=outbox(),rest=[];
      for(var j=0;j<now.length;j++){if(now[j].id!==next.id){rest.push(now[j]);continue;}if(err&&!err.offline){now[j].reason=err.message;rest.push(now[j]);}else if(err)rest.push(now[j]);}
      setOutbox(rest);if(!err||!err.offline)flush();},true);
  }
  function outboxPage(){
    header('Waiting to send');var list=outbox();if(!list.length){message('Everything has been sent.');return;}
    for(var i=0;i<list.length;i++)(function(item){var card=node('article',null,app);card.className='card';node('h2',item.label,card);node('p','Saved '+new Date(item.queuedAt).toLocaleString(),card);
      if(item.reason){message('Ndovera could not accept this: '+item.reason,true,card);button('Remove',function(){var rest=[],all=outbox();for(var j=0;j<all.length;j++)if(all[j].id!==item.id)rest.push(all[j]);setOutbox(rest);outboxPage();},card);}else node('p','It will be sent by itself when the connection is back.',card);}(list[i]));
    button('Send now',function(){flush();w.setTimeout(outboxPage,1500);});
  }

  /* ─── Assignments ─── */
  function assignmentPage(item,work){
    header(work.title||'Assignment');button('Back to assignments',function(){classPage(item,'assignments');});
    var text=plain(work.description||work.instructions||work.content||'');if(text){var about=node('p',text,app);about.className='body';}
    if(work.dueAt||work.dueDate)node('p','Due: '+(work.dueAt||work.dueDate),app);
    var mine=work.mySubmission;if(mine&&mine.grade!==null&&mine.grade!==undefined)message('Score: '+mine.grade+(mine.feedback?'. '+plain(mine.feedback):''));
    if(queuedFor(work.id)){message('Your answers are saved on this phone and will be sent when the connection is back. They count from when you pressed submit.');return;}
    var questions=work.questions||[];if(!questions.length){message('This assignment has no questions to answer here. Follow your teacher\'s instructions.');return;}
    var minutes=Number(work.metadata&&work.metadata.durationMinutes)||0,timer=kept('timer:'+work.id);
    if(minutes&&mine&&!timer){message('You have handed this in.');return;}
    if(minutes&&!timer){message('This is timed: you have '+minutes+' minutes from when you press Start. Keep the phone charged.');var start=button('Start',function(){start.disabled=true;
      request('POST','/api/assignments/'+encodeURIComponent(work.id)+'/start',{},function(err,data){start.disabled=false;
        if(err&&!err.offline){message(err.message,true);return;}
        var nowMs=new Date().getTime();
        /* No connection: the clock runs from now, and Ndovera holds it to the same limit when the work arrives. */
        keep('timer:'+work.id,err||!data.deadline?{deadline:new Date(nowMs+minutes*60000).toISOString(),startedOfflineAt:new Date(nowMs).toISOString()}:{deadline:data.deadline});
        assignmentPage(item,work);});});return;}
    answerForm(item,work,questions,timer);
  }
  function answerForm(item,work,questions,timer){
    var answers=kept('draft:'+work.id)||(work.mySubmission&&work.mySubmission.content&&work.mySubmission.content.answers)||{};
    function changed(id,value){answers[id]=value;keep('draft:'+work.id,answers);}
    var form=node('form',null,app);
    for(var i=0;i<questions.length;i++)question(form,questions[i],i,answers,changed);
    var submit=node('button',work.mySubmission?'Submit again':'Submit',form);submit.type='submit';
    function handIn(){
      if(submit.disabled)return;submit.disabled=true;
      var body={answers:answers,clientSubmissionId:newId('sub'),capturedAt:new Date().toISOString()};if(timer&&timer.startedOfflineAt)body.startedOfflineAt=timer.startedOfflineAt;
      var path='/api/assignments/'+encodeURIComponent(work.id)+'/submit';
      request('POST',path,body,function(err,data){submit.disabled=false;
        if(err&&!err.offline){message(err.message,true,form);return;}
        drop('timer:'+work.id);
        if(err){if(!enqueue({kind:'submit',assignmentId:work.id,path:path,body:body,label:work.title||'Assignment'})){message('This phone is out of storage, so your work could not be saved. Free some space and try again.',true,form);return;}drop('draft:'+work.id);header(work.title||'Assignment');message(err.message+' Your work is saved on this phone and will be sent by itself when the connection is back. It counts from now.');button('Back to assignments',function(){classPage(item,'assignments');});return;}
        drop('draft:'+work.id);work.mySubmission=data.submission||{};header(work.title||'Assignment');message('Submitted.'+(data.score!==null&&data.score!==undefined?' Score: '+data.score+' of '+data.maxScore+'.':''));button('Back to assignments',function(){classPage(item,'assignments');});});
    }
    form.onsubmit=function(e){e.preventDefault();handIn();};
    if(timer){var clockNode=node('p','',null);clockNode.className='timer';clockNode.setAttribute('role','timer');app.insertBefore(clockNode,form);
      var tick=function(){var left=new Date(timer.deadline).getTime()-new Date().getTime();if(left<=0){w.clearInterval(clock);clock=null;clockNode.textContent='Time is up. Handing in your answers.';handIn();return;}var seconds=Math.floor(left/1000);clockNode.textContent='Time left: '+Math.floor(seconds/60)+':'+('0'+(seconds%60)).slice(-2);};
      clock=w.setInterval(tick,1000);tick();}
  }
  function question(form,q,index,answers,changed){
    var box=node('fieldset',null,form);box.className='card';var title=node('legend',(index+1)+'. '+plain(q.prompt||'Question'),box);title.className='body';
    if(q.imageUrl||q.image)link(box,q.imageUrl||q.image,'Open the picture');
    var name='lite-q-'+q.id,type=String(q.type||'');
    if(type==='mcq'){var options=q.options||[];for(var i=0;i<options.length;i++)(function(option){var row=node('label',null,box);row.className='option';var input=node('input',null,row);input.type='radio';input.name=name;input.value=option;input.checked=answers[q.id]===option;input.onchange=function(){changed(q.id,option);};row.appendChild(d.createTextNode(plain(String(option))));}(options[i]));return;}
    if(type==='crossmatching'){var pairs=q.pairs||[],value=answers[q.id]&&typeof answers[q.id]==='object'?answers[q.id]:{},choices=pairs.slice().sort(function(a,b){return String(a.right)<String(b.right)?-1:1;});
      for(var p=0;p<pairs.length;p++)(function(pair,position){var left=String(pair.id||'pair-'+position),l=node('label',plain(String(pair.left||'')),box),select=node('select',null,box);select.id=name+'-'+position;l.htmlFor=select.id;node('option','Choose…',select).value='';
        for(var c=0;c<choices.length;c++){var choice=choices[c],id=String(choice.id||'pair-'+pairs.indexOf(choice)),o=node('option',plain(String(choice.right||'')),select);o.value=id;o.selected=value[left]===id;}
        select.onchange=function(){if(select.value)value[left]=select.value;else delete value[left];changed(q.id,value);};}(pairs[p],p));return;}
    var area=node('textarea',null,box);area.rows=type==='shortanswer'||type==='fillgaps'?2:6;area.setAttribute('aria-label','Your answer to question '+(index+1));area.value=typeof answers[q.id]==='string'?answers[q.id]:'';area.oninput=area.onkeyup=function(){changed(q.id,area.value);};
  }

  /* ─── Payments: online only, and checked by Ndovera with Flutterwave ─── */
  function money(naira,rule){var base=Number(naira)||0;if(!rule||!rule.foreign)return '\u20A6'+base.toLocaleString();var scale=Math.pow(10,Number(rule.decimals)||0),units=base*(1+(Number(rule.surcharge)||0))/(Number(rule.nairaPerUnit)||1),amount=Math.ceil(Number((units*scale).toFixed(6)))/scale;return (rule.currency==='NGN'?'\u20A6':rule.currency+' ')+amount.toLocaleString();}
  function goPay(link,paid){
    if(auth)header('Payment');else{clear();node('h1','Payment',app);}if(!link){message('The payment page could not be opened. Please try again.',true);return;}
    message('You will pay on Flutterwave\'s secure page. '+paid);var a=node('a','Continue to payment',app);a.className='button';a.href=link;a.rel='noreferrer';
    node('p','If that page does not open on this phone, open this link on another phone or computer:',app);var copy=node('input',null,app);copy.readOnly=true;copy.value=link;copy.setAttribute('aria-label','Payment link');
  }
  function passesPage(){
    header('Practice passes');var status=message('Loading…'),parent=isRole('parent');
    load(parent?'/api/practice-arena/family':'/api/practice-arena/home','passes',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);
      if(parent){var children=data.children||[];if(!children.length)message('No children are linked to your account yet. Ask the school to link them.');for(var i=0;i<children.length;i++)passCard(children[i].name+(children[i].className?' \u00B7 '+children[i].className:''),children[i].bundles,children[i].subjects,children[i].passes,children[i].studentId,data.pricing);return;}
      passCard('',data.bundles,data.subjects,(data.passes||{}).list,'',data.pricing);});
  }
  function passCard(title,bundles,subjects,held,studentId,rule){
    var card=node('article',null,app);card.className='card';if(title)node('h2',title,card);bundles=bundles||[];subjects=subjects||[];held=held||[];
    for(var h=0;h<held.length;h++)node('p','You have: '+held[h].label+(held[h].expiresAt?' until '+new Date(held[h].expiresAt).toLocaleDateString():' this term'),card);
    var label=node('label','Pass',card),select=node('select',null,card);select.id='lite-pass-'+(studentId||'me');label.htmlFor=select.id;node('option','Choose a pass…',select).value='';
    for(var i=0;i<bundles.length;i++){var o=node('option',bundles[i].label+' \u2014 '+money(bundles[i].priceNaira,rule)+(bundles[i].ready?'':' (being prepared)'),select);o.value=bundles[i].key;o.disabled=!bundles[i].ready;}
    var picks=node('div',null,card),choice=choices(picks,subjects);
    select.onchange=function(){choice.show(select.value==='subject'?'subject':select.value==='jamb'||select.value==='super'?'jamb':'');};
    var pay=button('Continue to payment',function(){if(!select.value){message('Choose a pass first.',true,card);return;}pay.disabled=true;var body=choice.fill({bundle:select.value});if(studentId)body.studentId=studentId;
      request('POST','/api/practice-arena/passes/checkout',body,function(err,data){pay.disabled=false;if(err){message(err.message,true,card);return;}goPay(data.checkoutUrl,'Your pass opens as soon as the payment is confirmed.');});},card);
    var code=node('form',null,card),cl=node('label','Have a code for a free pass?',code),input=node('input',null,code);input.id='lite-code-'+(studentId||'me');cl.htmlFor=input.id;input.autocomplete='off';
    var codePicks=node('div',null,code),codeChoice=choices(codePicks,subjects),use=node('button','Use code',code);use.type='submit';
    code.onsubmit=function(e){e.preventDefault();use.disabled=true;var body=codeChoice.fill({code:input.value});if(studentId)body.studentId=studentId;
      request('POST','/api/practice-arena/passes/redeem',body,function(err,data){use.disabled=false;if(err){if(err.details&&err.details.needs)codeChoice.show(err.details.needs);message(err.message,true,code);return;}message(data.message,false,code);input.value='';codeChoice.show('');});};
  }
  /* For phones that cannot open the card page: transfer, press "I have paid", send the receipt on WhatsApp. */
  function pageTitle(text){if(auth)header(text);else{clear();node('h1',text,app);}}
  function bankPage(id){
    pageTitle('Pay by bank transfer');var status=message('Loading…'),path='/api/public/bank-pay/'+encodeURIComponent(id);
    function done(claim){pageTitle('Send your receipt');message('Now send your payment receipt to Ndovera on WhatsApp, so it can be checked. Claim number: '+claim.id+'. Your purchase opens as soon as Ndovera confirms the payment.');var a=node('a','Send receipt on WhatsApp',app);a.className='button';a.href=claim.whatsappUrl;a.rel='noreferrer';}
    request('GET',path,null,function(err,claim){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}
      if(claim.status==='approved'){message('Your payment is confirmed. Thank you.');return;}if(claim.status==='waiting'){done(claim);return;}
      var card=node('article',null,app);card.className='card';node('p',claim.label,card);node('h2','Transfer exactly \u20A6'+Number(claim.payNaira).toLocaleString()+' to:',card);node('p',claim.bankName,card);node('p',claim.accountName,card);var number=node('p',claim.accountNumber,card);number.className='timer';
      var form=node('form',null,card),reference=field(form,'Your transfer reference (optional)','bank-ref');reference.required=false;var paid=node('button','I have paid',form);paid.type='submit';
      form.onsubmit=function(e){e.preventDefault();paid.disabled=true;request('POST',path+'/paid',{reference:reference.value},function(paidErr,saved){paid.disabled=false;if(paidErr){message(paidErr.message,true,form);return;}done(saved);});};});
  }
  /* A parent's invitation: their children, and the form that sets up their account. */
  function invitePage(token){
    clear();node('h1','Your invitation',app);var status=message('Loading…'),path='/api/public/parent-invites/'+encodeURIComponent(token);
    request('GET',path,null,function(err,invite){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}
      node('h2',invite.schoolName,app);var children=invite.children||[];for(var i=0;i<children.length;i++)node('p',children[i].name+(children[i].code?' \u00B7 Student code: '+children[i].code:''),app);
      var form=node('form',null,app);form.className='card';var inputs={name:field(form,'Full name','inv-name'),email:field(form,'Email address','inv-email','email'),phone:field(form,'Phone number','inv-phone','tel'),dateOfBirth:field(form,'Date of birth (year-month-day)','inv-dob'),occupation:field(form,'Occupation','inv-job'),password:field(form,'Choose a password (at least 8 characters)','inv-pass','password')};
      var send=node('button','Submit',form);send.type='submit';
      form.onsubmit=function(e){e.preventDefault();send.disabled=true;var body={};for(var k in inputs)if(Object.prototype.hasOwnProperty.call(inputs,k))body[k]=inputs[k].value;
        request('POST',path,body,function(sendErr,saved){send.disabled=false;if(sendErr){message(sendErr.message,true,form);return;}clear();node('h1','You are all set',app);message('Sign in with '+saved.email+' or '+saved.phone+', and your password.');button('Sign in',login);});};});
  }
  /* The page someone else pays on. */
  function payLinkPage(token){
    clear();node('h1','Help with practice',app);var status=message('Loading…'),path='/api/public/pass-pay/'+encodeURIComponent(token);
    request('GET',path,null,function(err,link){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}
      if(link.paid){message(link.childName+"'s pass is paid for. Thank you!");return;}if(link.expired){message('This payment link has expired.',true);return;}
      node('p',link.childName+' at '+link.schoolName+' is asking you to pay for a '+link.label+'.',app);node('h2',money(link.amountNaira,link.pricing),app);
      var form=node('form',null,app);form.className='card';var email=field(form,'Your email, for the receipt','pay-email','email');var go=node('button','Pay now',form);go.type='submit';
      form.onsubmit=function(e){e.preventDefault();go.disabled=true;request('POST',path+'/checkout',{email:email.value},function(payErr,data){go.disabled=false;if(payErr){message(payErr.message,true,form);return;}goPay(data.checkoutUrl,'The pass goes straight to the student.');});};});
  }
  /* A parent's home location for the bus driver, and the bus details. */
  function busPage(){
    header('School bus');var status=message('Loading…');
    load('/api/transport/mine','bus',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);var children=data.children||[];if(!children.length)message('No school bus is set up for you yet.');
      for(var i=0;i<children.length;i++)(function(child){var card=node('article',null,app);card.className='card';node('h2',child.name,card);var routes=child.routes||[];for(var r=0;r<routes.length;r++)node('p',routes[r].routeName+(routes[r].driverName?' \u00B7 Driver: '+routes[r].driverName:'')+(routes[r].driverPhone?' \u00B7 '+routes[r].driverPhone:''),card);
        if(!data.canSetHome)return;var home=child.home||{},pin=home.lat!==null&&home.lat!==undefined?{lat:home.lat,lng:home.lng}:null,form=node('form',null,card),address=field(form,'Home address','bus-addr-'+child.studentId),landmark=field(form,'Landmark or gate','bus-land-'+child.studentId);address.required=false;landmark.required=false;address.value=home.address||'';landmark.value=home.landmark||'';
        if(w.navigator.geolocation)button('I am at home: use my location',function(){w.navigator.geolocation.getCurrentPosition(function(p){pin={lat:p.coords.latitude,lng:p.coords.longitude};message('Location found. Press Save.',false,form);},function(){message('Could not get your location. Type the address instead.',true,form);},{enableHighAccuracy:true,timeout:20000});},form);
        var save=node('button','Save',form);save.type='submit';form.onsubmit=function(e){e.preventDefault();request('PUT','/api/transport/mine/'+encodeURIComponent(child.studentId)+'/home',{address:address.value,landmark:landmark.value,lat:pin?pin.lat:null,lng:pin?pin.lng:null},function(saveErr){message(saveErr?saveErr.message:'Saved. The driver sees this on the trips your child rides.',!!saveErr,form);});};}(children[i]));});
  }
  /* Feedback about Ndovera. */
  function reviewPage(){
    header('Give feedback');var form=node('form',null,app);form.className='card';var label=node('label','Rating',form),rating=node('select',null,form);rating.id='lite-rating';label.htmlFor=rating.id;for(var n=5;n>=1;n--){var o=node('option',n+' out of 5',rating);o.value=n;}
    var bl=node('label','Your review',form),body=node('textarea',null,form);body.id='lite-review';bl.htmlFor=body.id;body.rows=4;body.maxLength=400;var row=node('label',null,form);row.className='option';var ok=node('input',null,row);ok.type='checkbox';row.appendChild(d.createTextNode('Ndovera may show this review on its home page'));var send=node('button','Send my review',form);send.type='submit';
    form.onsubmit=function(e){e.preventDefault();send.disabled=true;request('POST','/api/reviews/mine',{rating:Number(rating.value),body:body.value,consent:ok.checked},function(err,data){send.disabled=false;message(err?err.message:data.message,!!err,form);});};
  }
  /* The choice a pass may need: one subject, or JAMB's three. */
  function choices(parent,subjects){
    var mode='',picked=[];
    function draw(){while(parent.firstChild)parent.removeChild(parent.firstChild);if(!mode)return;
      if(mode==='subject'){var select=node('select',null,parent);select.setAttribute('aria-label','Subject');node('option','Choose the subject…',select).value='';for(var i=0;i<subjects.length;i++){var o=node('option',subjects[i].name,select);o.value=subjects[i].key;o.selected=picked[0]===subjects[i].key;}select.onchange=function(){picked=select.value?[select.value]:[];};return;}
      node('p','Choose 3 JAMB subjects (Use of English is included):',parent);for(var j=0;j<subjects.length;j++)if(subjects[j].key!=='english')(function(subject){var row=node('label',null,parent);row.className='option';var box=node('input',null,row);box.type='checkbox';box.checked=picked.indexOf(subject.key)!==-1;box.onchange=function(){if(box.checked){if(picked.length>=3){box.checked=false;return;}picked.push(subject.key);}else picked.splice(picked.indexOf(subject.key),1);};row.appendChild(d.createTextNode(subject.name));}(subjects[j]));}
    return {show:function(next){mode=next;picked=[];draw();},fill:function(body){if(mode==='subject')body.subjectKey=picked[0]||'';if(mode==='jamb')body.jambSubjects=picked;return body;}};
  }
  function feesPage(){
    header('School fees');var status=message('Loading…');
    load('/api/school/finance/my-accounts','fees',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);
      var accounts=data.accounts||[];if(!accounts.length)message('No fee accounts were found. Ask the school to link your children.');
      load('/api/school/fees/payment-details','bank',function(bankErr,bank){var details=(bank&&bank.paymentDetails)||{};
        if(details.accountNumber){var how=node('article',null,app);how.className='card';node('h2','How to pay',how);node('p','Bank: '+(details.bankName||''),how);node('p','Account name: '+(details.accountName||''),how);node('p','Account number: '+details.accountNumber,how);}
        for(var i=0;i<accounts.length;i++)feeCard(accounts[i]);});});
  }
  function feeCard(account){
    var card=node('article',null,app);card.className='card';node('h2',account.studentName||'Student',card);var totals=account.totals||{};
    node('p','Total owed: \u20A6'+(Number(totals.totalOutstanding)||0).toLocaleString(),card);
    var owing=(account.previousOutstanding||[]).concat(account.current||[]),ids=[];for(var i=0;i<owing.length;i++)if(Number(owing[i].balance)>0){ids.push(owing[i].id);node('p',owing[i].feeItem+': \u20A6'+Number(owing[i].balance).toLocaleString(),card);}
    if(!ids.length)return;
    node('h3','I have paid',card);var form=node('form',null,card),amount=field(form,'Amount paid','amt-'+account.studentId,'number'),reference=field(form,'Bank reference or teller number','ref-'+account.studentId),paidAt=field(form,'Date paid (year-month-day)','paid-'+account.studentId);reference.required=false;paidAt.value=new Date().toISOString().slice(0,10);
    var send=node('button','Tell the school',form);send.type='submit';
    form.onsubmit=function(e){e.preventDefault();send.disabled=true;var path='/api/school/finance/my-claims',body={studentId:account.studentId,amount:Number(amount.value),method:'transfer',reference:reference.value,paidAt:paidAt.value,note:'',obligationIds:ids};
      request('POST',path,body,function(err){send.disabled=false;if(err&&!err.offline){message(err.message,true,form);return;}
        if(err){if(!enqueue({kind:'claim',path:path,body:body,label:'Fee payment for '+(account.studentName||'student')})){message('This phone is out of storage, so this could not be saved.',true,form);return;}message(err.message+' This is saved on this phone and will be sent when the connection is back.',false,form);}
        else message('Sent. The school will check it and issue your receipt.',false,form);amount.value=reference.value='';});};
  }
  function invoicePage(token,paymentRef){
    clear();node('h1','Ndovera invoice',app);var status=message('Loading…'),path='/api/public/invoices/'+encodeURIComponent(token);
    function show(invoice){status.parentNode.removeChild(status);var card=node('article',null,app);card.className='card';node('h2',invoice.schoolName||'School',card);node('p','Invoice '+(invoice.invoiceNo||''),card);node('p',(invoice.term||'')+' '+(invoice.session||''),card);node('p','Amount: '+money(invoice.amountCents/100,invoice.pricing),card);
      if(invoice.status==='paid'){message('This invoice is paid. Thank you.',false,card);return;}
      var pay=button('Continue to payment',function(){pay.disabled=true;request('POST',path+'/checkout',{},function(err,data){pay.disabled=false;if(err){message(err.message,true,card);return;}goPay(data.link,'Ndovera marks the invoice paid as soon as the payment is confirmed.');});},card);}
    function read(){request('GET',path,null,function(err,data){if(err){status.parentNode.removeChild(status);message(err.message,true);return;}show(data.invoice);});}
    if(paymentRef)request('POST',path+'/confirm',{txRef:paymentRef},function(err,data){if(!err&&data.invoice&&data.paid){show(data.invoice);return;}read();});else read();
  }
  function verifyPass(txRef){
    request('POST','/api/practice-arena/passes/verify',{txRef:txRef},function(err,data){message(err?err.message+' If you paid, your pass will still open once Flutterwave confirms it.':data.message,!!err);},true);
  }
  /* ─── The frame: the same top bar, menu and bottom buttons as the main app ─── */
  var ADMIN_ROLES=['owner','hos','admin','ict','ict_manager','principal','head_teacher','bursar','accountant','secretary','vp'];
  function isAdmin(){return ADMIN_ROLES.indexOf(String(role||'').toLowerCase())!==-1;}
  function isLearner(){return isRole('student')||isRole('parent');}
  function isTeaching(){return !isLearner();}
  /* Each menu item opens its Lite page. Items with no page explain that they need a newer phone. */
  function menuFor(){
    var later=function(name){return [name,function(){needsNewerPhone(name);}];};
    if(isRole('student'))return [['Overview',home],['My classes',classesPage],['Assignments',allAssignments],['Practice',practicePage],['Practice passes',passesPage],['Results',resultsPage],['Timetable',timetablePage],['Attendance',attendancePage],['School bus',busPage],['Notifications',inboxPage],later('Exams'),later('Championships'),later('Clubs'),later('Ndovera AI'),later('Messaging'),['Give feedback',reviewPage],['Settings',settingsPage]];
    if(isRole('parent'))return [['Overview',home],['Children',childrenPage],['My classes',classesPage],['Results',resultsPage],['Assignments',allAssignments],['Attendance',attendancePage],['Timetable',timetablePage],['School fees',feesPage],['Practice passes',passesPage],['School bus',busPage],['Notifications',inboxPage],later('Live'),later('Exams'),later('PTA Attendance'),later('Tuck Shop'),later('Ndovera AI'),later('Messaging'),['Give feedback',reviewPage],['Settings',settingsPage]];
    if(isAdmin())return [['Overview',home],['People',peoplePage],['My classes',classesPage],['Timetable',timetablePage],['Notifications',inboxPage],['My payslip',payslipPage],later('Fees and billing'),later('Results'),later('Attendance reports'),later('Payroll'),later('Website'),later('Admissions'),later('Ndovera AI'),['Give feedback',reviewPage],['Settings',settingsPage]];
    return [['Overview',home],['My classes',classesPage],['Assignments',allAssignments],['Attendance',teacherAttendance],['Timetable',timetablePage],['My payslip',payslipPage],['Notifications',inboxPage],later('Subject Scores'),later('Class Report'),later('Staff attendance'),later('Live'),later('Exams'),later('Ndovera AI'),later('Messaging'),['Give feedback',reviewPage],['Settings',settingsPage]];
  }
  function bottomFor(){
    if(isRole('student'))return [['Overview',home],['Classes',classesPage],['Practice',practicePage],['Results',resultsPage]];
    if(isRole('parent'))return [['Overview',home],['Children',childrenPage],['Fees',feesPage],['Results',resultsPage]];
    return [['Overview',home],['Classes',classesPage],['Timetable',timetablePage],['Alerts',inboxPage]];
  }
  function clearNode(el){while(el.firstChild)el.removeChild(el.firstChild);}
  var shell=d.getElementById('shell')||node('div',null,d.body);
  function closeMenu(){var drawer=d.getElementById('lite-drawer');if(drawer)drawer.className='drawer';}
  function drawShell(){
    clearNode(shell);if(!auth)return;
    var drawer=node('nav',null,shell);drawer.id='lite-drawer';drawer.className='drawer';drawer.setAttribute('aria-label','Menu');
    var who=node('p',auth.user.name||auth.user.id||'Your account',drawer);who.className='who';
    var items=menuFor();for(var i=0;i<items.length;i++)(function(item){var el=node('button',item[0],drawer);el.type='button';el.onclick=function(){closeMenu();item[1]();};}(items[i]));
    var waiting=outbox().length;if(waiting){var w8=node('button','Waiting to send ('+waiting+')',drawer);w8.type='button';w8.onclick=function(){closeMenu();outboxPage();};}
    var out=node('button','Sign out',drawer);out.type='button';out.onclick=logout;
    var bar=node('nav',null,shell);bar.className='bottom';bar.setAttribute('aria-label','Main');var tabs=bottomFor();
    for(var j=0;j<tabs.length;j++)(function(tab){var el=node('button',tab[0],bar);el.type='button';el.onclick=tab[1];}(tabs[j]));
    var more=node('button','More',bar);more.type='button';more.onclick=toggleMenu;
  }
  function toggleMenu(){var drawer=d.getElementById('lite-drawer');if(drawer)drawer.className=drawer.className==='drawer'?'drawer open':'drawer';}
  var menuButton=d.getElementById('lite-menu');if(menuButton)menuButton.onclick=toggleMenu;
  function header(title){clear();closeMenu();drawShell();if(w.scrollTo)try{w.scrollTo(0,0);}catch(ignored){}node('h1',title,app);}
  function card(title,parent){var el=node('article',null,parent||app);el.className='card';if(title)node('h2',title,el);return el;}
  function backTo(label,action){var el=button(label,action);el.className='plain';return el;}
  function asList(value){return Object.prototype.toString.call(value)==='[object Array]'?value:[];}
  function needsNewerPhone(name){header(name);var c=card('');c.className='card sky';node('p',name+' needs a newer phone or a computer. Sign in there with the same account, and everything you do here will be there too.',c);}

  /* ─── Overview ─── */
  function home(){
    if(!auth){login();return;} if(auth.user.mustChangePassword){changePassword();return;}
    header('Overview');
    var hello=card('');hello.className='card navy';node('h2','Welcome, '+(auth.user.name||'there'),hello);
    var roles=auth.user.switchableRoles||auth.user.roles||[auth.user.role];if(typeof roles==='string')roles=roles.split(',');
    if(roles.length>1){var label=node('label','View as',hello),select=node('select',null,hello);select.id='lite-role';label.htmlFor=select.id;for(var i=0;i<roles.length;i++){var option=node('option',roles[i],select);option.value=roles[i];option.selected=roles[i]===role;}select.onchange=function(){role=select.value;save();home();};}
    var tiles=node('div',null,app);tiles.className='tiles';var quick=menuFor();
    for(var t=1;t<quick.length&&t<7;t++)(function(item){var el=node('button',item[0],tiles);el.type='button';el.className='tile';el.onclick=item[1];}(quick[t]));
    node('h2','My classes',app);
    var status=message('Loading your classes…');
    load('/api/classrooms/assigned','classes',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);classList(data.classes||[]);recentNotices();});
  }
  function classList(classes){
    if(!classes.length){message('No classes were returned for this account and role. Ask your school to check your class assignment.');return;}
    var list=node('ul',null,app);list.className='list';for(var j=0;j<classes.length;j++)(function(item){var li=node('li',null,list);var el=button((item.name||'Class')+(item.arm?' '+item.arm:''),function(){classPage(item,'materials');},li);el.className='row';}(classes[j]));
  }
  function classesPage(){header('My classes');var status=message('Loading your classes…');load('/api/classrooms/assigned','classes',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);classList(data.classes||[]);});}
  function recentNotices(){
    request('GET','/api/communications/inbox',null,function(err,data){if(err)return;var items=asList(data.items);if(!items.length)return;var box=card('Latest notices');for(var i=0;i<items.length&&i<3;i++){var p=node('p',items[i].title||'Notice',box);if(!items[i].readAt)p.className='unread';}button('See all notifications',inboxPage,box);});
  }
  function inboxPage(){
    header('Notifications');var status=message('Loading…');
    load('/api/communications/inbox','inbox',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);var items=asList(data.items),unread=[];
      if(!items.length){message('You have no notifications.');return;}
      for(var i=0;i<items.length;i++){var it=items[i],c=card(it.title||'Notice');if(!it.readAt){c.className='card sky';unread.push(it.id);}if(it.body){var b=node('p',plain(it.body),c);b.className='body';}if(it.createdAt)node('small',new Date(it.createdAt).toLocaleString(),c);}
      if(unread.length&&!at)request('POST','/api/communications/inbox/read',{ids:unread},function(){},true);});
  }
  function settingsPage(){
    header('Settings');var c=card('My account');node('p',auth.user.name||'',c);if(auth.user.email)node('p',auth.user.email,c);node('p','Role: '+role,c);
    button('Change my password',changePassword,c);button('Sign out',logout,c);
    var std=node('a','Try the main app on this phone',card('Other'));std.href='/?ndovera-view=standard';std.rel='noreferrer';
  }

  /* ─── Timetable, attendance, payslip ─── */
  var DAYS=['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  function childPicker(done){
    load('/api/learning/students','learners',function(err,data,at){if(err){message(err.message,true);return;}savedNote(at);var children=asList(data.students);
      if(!children.length){message('No children are linked to your account yet. Ask the school to link them.');return;}
      if(children.length===1){done(children[0]);return;}
      var label=node('label','Choose a child',app),select=node('select',null,app);select.id='lite-child';label.htmlFor=select.id;var area=node('div',null,app);
      for(var i=0;i<children.length;i++){var o=node('option',children[i].name,select);o.value=i;}
      select.onchange=function(){clearNode(area);done(children[Number(select.value)],area);};done(children[0],area);});
  }
  function timetablePage(){
    header('Timetable');
    function show(query,parent){var where=parent||app,status=message('Loading…',false,where);load('/api/school/timetable'+query,'timetable'+query,function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true,where);return;}savedNote(at);var rows=asList(data.entries);
      if(!rows.length){message('No timetable has been published yet.',false,where);return;}
      for(var day=1;day<=7;day++){var today=[];for(var i=0;i<rows.length;i++)if(Number(rows[i].dayOfWeek)===day)today.push(rows[i]);if(!today.length)continue;var c=card(DAYS[day],where);for(var j=0;j<today.length;j++){var r=today[j];node('p',(r.startTime?r.startTime+(r.endTime?'–'+r.endTime:'')+' · ':'')+(r.subjectName||'Period')+(r.className?' · '+r.className:''),c);}}});}
    if(isRole('parent'))childPicker(function(child,area){show('?classId='+encodeURIComponent(child.classId||''),area);});else show(isTeaching()?'?mine=true':'');
  }
  function attendancePage(){
    header('Attendance');
    function show(studentId,parent){var where=parent||app,status=message('Loading…',false,where),query='?limit=30'+(studentId?'&studentId='+encodeURIComponent(studentId):'');load('/api/school/student-attendance'+query,'attendance'+query,function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true,where);return;}savedNote(at);var rows=asList(data.records);
      if(!rows.length){message('No attendance has been recorded yet.',false,where);return;}var c=card('Recent days',where);for(var i=0;i<rows.length;i++)node('p',(rows[i].date||'')+': '+(rows[i].status||''),c);});}
    if(isRole('parent'))childPicker(function(child,area){show(child.id,area);});else show(auth.user.id||'');
  }
  function teacherAttendance(){
    header('Attendance');var status=message('Loading your classes…');load('/api/classrooms/assigned','classes',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);var classes=data.classes||[];if(!classes.length){message('You have no classes.');return;}
      node('p','Choose the class to mark.',app);for(var i=0;i<classes.length;i++)(function(item){var el=button((item.name||'Class')+(item.arm?' '+item.arm:''),function(){markRegister(item);});el.className='row';}(classes[i]));});
  }
  function markRegister(item){
    header('Attendance: '+(item.name||'Class'));var day=new Date().toISOString().slice(0,10),status=message('Loading the class…');
    load('/api/classrooms/'+encodeURIComponent(item.id)+'/students','roster:'+item.id,function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);var students=asList(data.students);if(!students.length){message('There are no students in this class yet.');return;}
      var form=node('form',null,app);node('p','Date: '+day,form);var groups=[];
      for(var i=0;i<students.length;i++)(function(student,index){var box=node('fieldset',null,form);box.className='card';var title=node('legend',student.name||student.id,box);title.className='body';var name='lite-att-'+index;var pick={student:student,value:'present'};groups.push(pick);
        var marks=['present','absent','late'];for(var m=0;m<marks.length;m++)(function(mark){var row=node('label',null,box);row.className='option inline';var input=node('input',null,row);input.type='radio';input.name=name;input.value=mark;input.checked=mark==='present';input.onchange=function(){pick.value=mark;};row.appendChild(d.createTextNode(mark.charAt(0).toUpperCase()+mark.slice(1)));}(marks[m]));}(students[i],i));
      var save=node('button','Save the register',form);save.type='submit';
      form.onsubmit=function(e){e.preventDefault();save.disabled=true;var path='/api/school/student-attendance';
        for(var g=0;g<groups.length;g++)enqueue({kind:'attendance',path:path,body:{studentId:groups[g].student.id,date:day,status:groups[g].value,classId:item.id},label:'Attendance: '+(groups[g].student.name||'student')+', '+day});
        flush();header('Attendance: '+(item.name||'Class'));message('Saved. It is being sent now. If the connection is off, it goes by itself when the connection is back.');backTo('Back to classes',teacherAttendance);};});
  }
  function payslipPage(period){
    header('My payslip');var query=typeof period==='string'&&period?'?period='+encodeURIComponent(period):'',status=message('Loading…');
    load('/api/school/payroll/my-payslip'+query,'payslip'+query,function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);var months=asList(data.available),slip=data.payslip;
      if(months.length>1){var label=node('label','Month',app),select=node('select',null,app);select.id='lite-month';label.htmlFor=select.id;for(var i=0;i<months.length;i++){var o=node('option',months[i].period,select);o.value=months[i].period;o.selected=months[i].period===(data.period||'');}select.onchange=function(){payslipPage(select.value);};}
      if(!slip){message(data.message||'Your school has not released a payslip yet.');return;}
      var c=card('Payslip '+(slip.period||data.period||''));node('p','Gross: ₦'+(Number(slip.gross)||0).toLocaleString(),c);node('p','Deductions: ₦'+(Number(slip.deductions)||0).toLocaleString(),c);var net=node('p','Net pay: ₦'+(Number(slip.net)||0).toLocaleString(),c);net.className='strong';
      node('small','To print or download it, use a newer phone or a computer.',c);});
  }

  /* ─── Results and children ─── */
  function resultsPage(){
    header('Results');
    function show(id,parent){var where=parent||app,status=message('Loading…',false,where),query=id?'?studentId='+encodeURIComponent(id):'';load('/api/results/records'+query,'results'+query,function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true,where);return;}savedNote(at);
      if(data.lockedByFees){message('This result is held until the fees are settled. Please speak to the school.',false,where);return;}
      var published=asList(data.publications);if(!published.length){message('No results have been published yet.',false,where);return;}
      for(var i=0;i<published.length;i++){var payload=published[i].payload||{},c=card((payload.termName||published[i].termName||'Term')+' '+(payload.sessionName||published[i].sessionName||''),where),rows=asList(payload.subjects),summary=payload.summary||{};
        for(var j=0;j<rows.length;j++){var r=rows[j];node('p',(r.subjectName||r.subject||r.name||'Subject')+': '+(r.total!==undefined&&r.total!==null?r.total:'-')+(r.grade?' ('+r.grade+')':''),c);}
        if(summary.average!==undefined&&summary.average!==null)node('p','Average: '+summary.average,c).className='strong';if(summary.position)node('p','Position: '+summary.position,c);}
      });}
    if(isRole('parent'))childPicker(function(child,area){show(child.id,area);});else show('');
  }
  function childrenPage(){
    header('Children');var status=message('Loading…');load('/api/learning/students','learners',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);var children=asList(data.students);
      if(!children.length){message('No children are linked to your account yet. Ask the school to link them.');return;}
      for(var i=0;i<children.length;i++)(function(child){var c=card(child.name||'Child');node('p',(child.className||'Class pending')+(child.displayId?' · '+child.displayId:''),c);var fix=button('Correct this name',function(){fix.disabled=true;
        request('GET','/api/people/'+encodeURIComponent(child.id)+'/name-change',null,function(err2,state){fix.disabled=false;if(err2){message(err2.message,true,c);return;}if(state.change){message('This name has already been changed from a parent account, and that can be done only once. Please ask the school if it needs to change again.',false,c);return;}
          fix.parentNode.removeChild(fix);var f=node('form',null,c),name=field(f,'Correct name','name-'+child.id);name.value=child.name||'';node('small','You can do this only once for each child, so check the spelling. The sign-in email stays the same unless the school changes it.',f);var save=node('button','Save the name',f);save.type='submit';
          f.onsubmit=function(e){e.preventDefault();save.disabled=true;request('PUT','/api/people/'+encodeURIComponent(child.id),{name:name.value},function(err3){save.disabled=false;if(err3){message(err3.message,true,f);return;}message('Saved. The sign-in email stays the same.',false,f);save.parentNode.removeChild(save);});};});},c);}(children[i]));});
  }

  /* ─── People, for the school office ─── */
  function peoplePage(){
    header('People');var form=node('form',null,app),box=field(form,'Search by name, email or phone','people-search');box.required=false;var go=node('button','Search',form);go.type='submit';var area=node('div',null,app);
    function show(){clearNode(area);var status=message('Loading…',false,area);load('/api/people?limit=30&search='+encodeURIComponent(box.value),'people',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true,area);return;}savedNote(at);var rows=asList(data.people);if(!rows.length){message('Nobody was found.',false,area);return;}
      for(var i=0;i<rows.length;i++){var c=card(rows[i].name||rows[i].email||'Person',area);node('p',String(rows[i].role||'')+(rows[i].className?' · '+rows[i].className:''),c);if(rows[i].email)node('small',rows[i].email,c);if(rows[i].phone)node('small',rows[i].phone,c);}
      node('small','Adding and editing people needs a newer phone or a computer.',area);});}
    form.onsubmit=function(e){e.preventDefault();show();};show();
  }

  /* ─── Teaching: upload, class updates, assignments, marking ─── */
  function subjectSelect(item,form,done){
    var label=node('label','Subject',form),select=node('select',null,form);select.id='lite-subject';label.htmlFor=select.id;select.required=true;node('option','Loading…',select).value='';
    load('/api/classrooms/'+encodeURIComponent(item.id)+'/subjects','subjects:'+item.id,function(err,data){clearNode(select);node('option','Choose the subject…',select).value='';var subjects=asList(data&&data.subjects);for(var i=0;i<subjects.length;i++){var o=node('option',subjects[i].name,select);o.value=subjects[i].id;}if(err)message(err.message,true,form);if(done)done(subjects);});
    return select;
  }
  function uploadPage(item){
    header('Upload material');backTo('Back to '+(item.name||'class'),function(){classPage(item,'materials');});
    var form=node('form',null,app);form.className='card',form.setAttribute('aria-label','Upload material');var title=field(form,'Title','mat-title'),subject=subjectSelect(item,form),topic=field(form,'Topic (optional)','mat-topic');topic.required=false;
    var nl=node('label','Note to students (optional)',form),note=node('textarea',null,form);note.id='lite-mat-note';nl.htmlFor=note.id;note.rows=3;
    var fl=node('label','File (PDF, Word, picture or similar)',form),file=node('input',null,form);file.id='lite-mat-file';fl.htmlFor=file.id;file.type='file';file.required=true;
    var send=node('button','Upload',form);send.type='submit';
    if(!w.FormData){send.disabled=true;message('This browser cannot send files. Please use Chrome or another browser on this phone.',true,form);}
    form.onsubmit=function(e){e.preventDefault();var chosen=file.files&&file.files[0];if(!chosen){message('Choose a file first. If no file can be chosen here, open this page in Chrome on this phone.',true,form);return;}
      if(chosen.size>20*1024*1024){message('That file is over 20 MB. Send a smaller copy.',true,form);return;}if(!subject.value){message('Choose the subject.',true,form);return;}
      var body=new w.FormData();body.append('file',chosen);body.append('title',title.value);body.append('subjectId',subject.value);if(topic.value)body.append('topic',topic.value);if(note.value)body.append('description',note.value);body.append('status','published');
      send.disabled=true;send.textContent='Uploading…';
      request('POST','/api/classrooms/'+encodeURIComponent(item.id)+'/materials/upload-multipart',body,function(err){send.disabled=false;send.textContent='Upload';if(err){message(err.offline?err.message+' A file cannot wait on this phone: try again when the connection is back.':err.message,true,form);return;}classPage(item,'materials');});};
  }
  function postPage(item){
    header('Post an update');backTo('Back to '+(item.name||'class'),function(){classPage(item,'stream');});
    var form=node('form',null,app);form.className='card';var l=node('label','Your message to the class',form),text=node('textarea',null,form);text.id='lite-post';l.htmlFor=text.id;text.rows=5;text.required=true;var send=node('button','Post',form);send.type='submit';
    form.onsubmit=function(e){e.preventDefault();send.disabled=true;var path='/api/classrooms/'+encodeURIComponent(item.id)+'/posts',body={content:text.value};
      request('POST',path,body,function(err){send.disabled=false;if(err&&!err.offline){message(err.message,true,form);return;}if(err){enqueue({kind:'post',path:path,body:body,label:'Class update for '+(item.name||'class')});}classPage(item,'stream');});};
  }
  function newAssignmentPage(item){
    header('New assignment');backTo('Back to '+(item.name||'class'),function(){classPage(item,'assignments');});
    var form=node('form',null,app);form.className='card';var title=field(form,'Title','asg-title'),subject=subjectSelect(item,form);
    var il=node('label','Instructions',form),about=node('textarea',null,form);about.id='lite-asg-about';il.htmlFor=about.id;about.rows=3;
    var ql=node('label','Questions, one on each line. Students write their answers and you mark them.',form),lines=node('textarea',null,form);lines.id='lite-asg-q';ql.htmlFor=lines.id;lines.rows=6;lines.required=true;
    var due=field(form,'Due date (year-month-day, optional)','asg-due');due.required=false;
    node('small','Multiple choice and timed work need a newer phone or a computer.',form);var send=node('button','Give the assignment',form);send.type='submit';
    form.onsubmit=function(e){e.preventDefault();if(!subject.value){message('Choose the subject.',true,form);return;}var prompts=lines.value.split('\n'),questions=[];for(var i=0;i<prompts.length;i++){var text=prompts[i].replace(/^\s+|\s+$/g,'');if(text)questions.push({id:'q'+(questions.length+1),type:'essay',prompt:text,points:10});}
      if(!questions.length){message('Type at least one question.',true,form);return;}send.disabled=true;
      request('POST','/api/classrooms/'+encodeURIComponent(item.id)+'/assignments',{title:title.value,description:about.value,dueAt:due.value||null,subjectId:subject.value,format:questions.length>1?'mixed':'essay',questions:questions},function(err){send.disabled=false;if(err){message(err.message,true,form);return;}classPage(item,'assignments');});};
  }
  function markingPage(item,work){
    header('Answers: '+(work.title||'Assignment'));backTo('Back to assignments',function(){classPage(item,'assignments');});var status=message('Loading…'),questions=asList(work.questions);
    request('GET','/api/assignments/'+encodeURIComponent(work.id)+'/submissions',null,function(err,data){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}var rows=asList(data.submissions);if(!rows.length){message('Nobody has handed this in yet.');return;}
      for(var i=0;i<rows.length;i++)(function(sub){var c=card(sub.studentName||sub.studentId||'Student'),content=sub.content;if(typeof content==='string'){try{content=JSON.parse(content);}catch(ignored){}}var answers=(content&&content.answers)||{};
        for(var q=0;q<questions.length;q++){var value=answers[questions[q].id];node('p',(q+1)+'. '+plain(questions[q].prompt||''),c).className='strong';var said=node('p',typeof value==='string'?value:value===undefined||value===null?'No answer':JSON.stringify(value),c);said.className='body';}
        if(!questions.length&&typeof content==='string')node('p',content,c).className='body';
        var f=node('form',null,c),grade=field(f,'Score','grade-'+sub.id,'number'),fbl=node('label','Remark (optional)',f),remark=node('textarea',null,f);remark.id='lite-fb-'+sub.id;fbl.htmlFor=remark.id;remark.rows=2;if(sub.grade!==null&&sub.grade!==undefined)grade.value=sub.grade;if(sub.feedback)remark.value=sub.feedback;var save=node('button','Save the mark',f);save.type='submit';
        f.onsubmit=function(e){e.preventDefault();save.disabled=true;request('POST','/api/submissions/'+encodeURIComponent(sub.id)+'/grade',{grade:Number(grade.value),feedback:remark.value},function(saveErr){save.disabled=false;message(saveErr?saveErr.message:'Saved.',!!saveErr,f);});};}(rows[i]));});
  }
  /* Every assignment in one list, class by class. */
  function allAssignments(){
    header('Assignments');var status=message('Loading your classes…');load('/api/classrooms/assigned','classes',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);var classes=data.classes||[];if(!classes.length){message('You have no classes yet.');return;}node('p','Choose a class.',app);
      for(var i=0;i<classes.length;i++)(function(item){var el=button((item.name||'Class')+(item.arm?' '+item.arm:''),function(){classPage(item,'assignments');});el.className='row';}(classes[i]));});
  }

  /* ─── Practice: the same questions and passes as the main app ─── */
  function practicePage(){
    header('Practice');var status=message('Loading…');load('/api/practice-arena/home','practice',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);var all=asList(data.subjects),levels=asList(data.levels),subjects=[],choosable=[],free=data.passes&&data.passes.freeSubject;for(var a=0;a<all.length;a++){if(all[a].questions===0)continue;if(all[a].access==='locked')choosable.push(all[a]);else subjects.push(all[a]);}
      if(choosable.length&&!free){var pick=card('Choose your free subject');pick.className='card sky';node('p','You get one subject free this term, in full. You cannot change it until next term. Every other subject needs a pass.',pick);var fl=node('label','Subject',pick),fs=node('select',null,pick);fs.id='lite-free-subject';fl.htmlFor=fs.id;for(var c=0;c<choosable.length;c++){var co=node('option',choosable[c].name,fs);co.value=choosable[c].key;}var fb=button('Make this my free subject',function(){fb.disabled=true;request('POST','/api/practice-arena/free-subject',{subject:fs.value},function(fe){fb.disabled=false;if(fe){message(fe.message,true,pick);return;}practicePage();});},pick);}
      if(!subjects.length){if(!choosable.length)message('Your class has no subjects with questions yet.');button('Practice passes',passesPage);return;}var form=node('form',null,app);form.className='card';
      var sl=node('label','Subject',form),subject=node('select',null,form);subject.id='lite-pr-subject';sl.htmlFor=subject.id;for(var i=0;i<subjects.length;i++){var o=node('option',subjects[i].name,subject);o.value=i;}
      var ll=node('label','Level',form),level=node('select',null,form);level.id='lite-pr-level';ll.htmlFor=level.id;for(var j=0;j<levels.length;j++){var p=node('option',levels[j].label,level);p.value=j;}
      var go=node('button','Start practising',form);go.type='submit';button('Practice passes',passesPage);
      form.onsubmit=function(e){e.preventDefault();go.disabled=true;var chosen=subjects[Number(subject.value)],lv=levels[Number(level.value)]||{};
        request('GET','/api/practice-arena/pack?subject='+encodeURIComponent(chosen.key)+'&size=10'+(lv.difficulty?'&difficulty='+encodeURIComponent(lv.difficulty):'')+(lv.exam?'&exam='+encodeURIComponent(lv.exam):''),null,function(packErr,got){go.disabled=false;if(packErr){message(packErr.message,true,form);return;}
          var pack=got.pack||{},ready=[],all=asList(pack.questions);for(var k=0;k<all.length;k++){var type=all[k].type;if(type==='mcq'||type==='truefalse'||type==='shortanswer'||type==='fillgaps')ready.push(all[k]);}
          if(!ready.length){message('There are no questions here yet. More are written every week.',true,form);return;}playQuiz(chosen,ready,0,[],new Date());});};});
  }
  function playQuiz(subject,questions,index,answers,startedAt){
    header('Practice: '+subject.name);var q=questions[index];node('p','Question '+(index+1)+' of '+questions.length,app);if(q.passage){var pass=node('p',plain(q.passage),app);pass.className='body';}var box=card('');var prompt=node('p',plain(q.prompt),box);prompt.className='strong body';if(q.imageUrl)link(box,q.imageUrl,'Open the picture');
    function next(response){answers.push({questionId:q.id,response:response});
      var nextBtn=button(index+1<questions.length?'Next question':'See my score',function(){if(index+1<questions.length)playQuiz(subject,questions,index+1,answers,startedAt);else finishQuiz(subject,answers,startedAt);},box);nextBtn.className='go';}
    if(q.options){var opts=q.options;for(var i=0;i<opts.length;i++)(function(option,position){var el=button(plain(String(option)),function(){var picks=box.querySelectorAll('button');for(var b=0;b<picks.length;b++)picks[b].disabled=true;
        if(q.correctIndex!==undefined){var right=position===q.correctIndex;var said=message(right?'Correct.':'Not quite. The answer is: '+plain(String(opts[q.correctIndex])),!right,box);said.className=said.className;}if(q.explanation){var ex=node('p',plain(q.explanation),box);ex.className='body';}next(option);},box);el.className='choice';}(opts[i],i));return;}
    var f=node('form',null,box),input=field(f,'Your answer','pr-answer'),send=node('button','Answer',f);send.type='submit';f.onsubmit=function(e){e.preventDefault();send.disabled=true;input.disabled=true;if(q.explanation){var ex=node('p',plain(q.explanation),box);ex.className='body';}next(input.value);};
  }
  function finishQuiz(subject,answers,startedAt){
    header('Your score');var ended=new Date(),path='/api/practice-arena/attempts',body={id:newId('lite'),subjectKey:subject.key,subjectName:subject.name,mode:'quick',startedAt:startedAt.toISOString(),finishedAt:ended.toISOString(),durationSec:Math.round((ended.getTime()-startedAt.getTime())/1000),answers:answers},status=message('Saving…');
    request('POST',path,body,function(err,data){status.parentNode.removeChild(status);if(err&&!err.offline){message(err.message,true);}else if(err){enqueue({kind:'practice',path:path,body:body,label:'Practice: '+subject.name});message(err.message+' Your score is saved on this phone and will be sent when the connection is back.');}
      else{var attempt=(data&&data.attempt)||{},c=card('');c.className='card navy';var total=attempt.total||attempt.totalQuestions||answers.length;node('h2',(attempt.correct!==undefined?attempt.correct+' of '+total+' correct':'Saved'),c);if(attempt.xp!==undefined)node('p',attempt.xp+' XP',c);}
      button('Practise again',practicePage);});
  }
  function param(name){var match=new RegExp('(?:^|[?&])'+name+'=([^&#]*)').exec(w.location.search);try{return match?decodeURIComponent(match[1]):'';}catch(ignored){return '';}}

  try {var saved=JSON.parse(w.localStorage.getItem(key)||'null');if(saved&&saved.auth&&saved.auth.token){auth=saved.auth;role=saved.role||auth.user.role;}}catch(ignored){}
  if(!auth)mainSession();
  if(w.addEventListener)w.addEventListener('online',flush);
  /* Only sends when something is waiting, so an idle phone makes no requests. */
  w.setInterval(flush,60000);
  var invoice=/^#invoice=(.+)$/.exec(w.location.hash),shared=/^#(invite|pay|bank-pay)=(.+)$/.exec(w.location.hash);
  if(invoice)invoicePage(invoice[1],param('payment_ref'));
  else if(shared&&shared[1]==='invite')invitePage(shared[2]);
  else if(shared&&shared[1]==='pay')payLinkPage(shared[2]);
  else if(shared)bankPage(shared[2]);
  else if(w.location.hash==='#reset')reset();
  else if(auth){home();flush();if(param('practice_tx'))verifyPass(param('practice_tx'));}
  else login();
}(window,document));
