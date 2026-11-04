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
  function save() { try { w.localStorage.setItem(key, JSON.stringify({auth:auth,role:role})); } catch (ignored) {} }
  function userKey(suffix) { return 'ndovera:lite:' + ((auth && auth.user && (auth.user.id || auth.user.email)) || 'guest') + ':' + suffix; }
  function kept(suffix) { try { return JSON.parse(w.localStorage.getItem(userKey(suffix)) || 'null'); } catch (ignored) { return null; } }
  function keep(suffix, value) { try { w.localStorage.setItem(userKey(suffix), JSON.stringify(value)); return true; } catch (ignored) { return false; } }
  function drop(suffix) { try { w.localStorage.removeItem(userKey(suffix)); } catch (ignored) {} }
  var NETWORK_TEXT = 'Your network (mobile data or Wi-Fi) is not reaching Ndovera.';
  var BUSY_TEXT = 'Ndovera is very busy right now.';
  function apiUrl(path) { return apiBase ? apiBase + (apiBase.slice(-4) === '/api' ? path.slice(4) : path) : path; }
  function request(method, path, data, done, background) {
    var current = generation, xhr = new w.XMLHttpRequest();
    xhr.open(method, apiUrl(path) + (path.indexOf('?') === -1 ? '?' : '&') + 'ndoveraClient=lite', true); xhr.timeout = 30000; xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    if (data !== null) xhr.setRequestHeader('Content-Type', 'application/json');
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
    try { xhr.send(data === null ? null : JSON.stringify(data)); } catch (ignored) { fail(NETWORK_TEXT, true); }
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
    busy = false; clear(); node('h1','Sign in',app); var form = node('form',null,app); form.className='card';
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
    message('Lite stays signed in on this phone so your work is here without internet. Sign out on a shared phone. Bookmark this page to open it offline.');
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
  function header(title){clear();node('h1',title,app);node('p','Signed in as '+(auth.user.name||auth.user.id||'your account'),app);button('My classes',home);if(isRole('student')||isRole('parent'))button('Practice passes',passesPage);if(isRole('parent'))button('School fees',feesPage);var waiting=outbox().length;if(waiting)button('Waiting to send ('+waiting+')',outboxPage);button('Sign out',logout);}
  function isRole(name){return String(role||'').toLowerCase()===name;}
  /* A saved copy when the network fails: what is on the phone is better than an error. */
  function load(path,suffix,done){request('GET',path,null,function(err,data){if(!err){keep(suffix,{at:new Date().getTime(),data:data});done(null,data,false);return;}var copy=err.offline?kept(suffix):null;if(copy){done(null,copy.data,new Date(copy.at));return;}done(err);});}
  function savedNote(at){if(at)message(NETWORK_TEXT+' Showing what was saved on this phone on '+at.toLocaleString()+'.');}
  function home(){
    if(!auth){login();return;} if(auth.user.mustChangePassword){changePassword();return;}
    header('My classes');var roles=auth.user.switchableRoles||auth.user.roles||[auth.user.role];if(typeof roles==='string')roles=roles.split(',');
    if(roles.length>1){var label=node('label','View as',app),select=node('select',null,app);select.id='lite-role';label.htmlFor=select.id;for(var i=0;i<roles.length;i++){var option=node('option',roles[i],select);option.value=roles[i];option.selected=roles[i]===role;}select.onchange=function(){role=select.value;save();home();};}
    var status=message('Loading your classes…');
    load('/api/classrooms/assigned','classes',function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);var classes=data.classes||[];
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
    button('Save this class for offline',function(){saveClass(item);},nav);
    var status=message('Loading…');load('/api/classrooms/'+encodeURIComponent(item.id)+'/'+section,'class:'+item.id+':'+section,function(err,data,at){status.parentNode.removeChild(status);if(err){message(err.message,true);return;}savedNote(at);
      var items=data[section==='stream'?'posts':section]||[];
      if(data.academicContext){var context=data.academicContext;node('p',[context.sessionName,context.termName].filter(function(x){return !!x;}).join(' · '),app);}
      if(!items.length){message('No '+(section==='stream'?'updates':section)+' are available.');return;}
      for(var j=0;j<items.length;j++){var entry=items[j],card=node('article',null,app);entry.classId=item.id;card.className='card';node('h2',entry.title||entry.name||'Class update',card);
        var text=plain(entry.content||entry.body||entry.description||entry.instructions||'');if(text){var body=node('p',text,card);body.className='body';}
        if(entry.dueDate||entry.dueAt)node('p','Due: '+(entry.dueDate||entry.dueAt),card);
        if(entry.studentStatus)node('p','Status: '+entry.studentStatus,card);
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
  function param(name){var match=new RegExp('(?:^|[?&])'+name+'=([^&#]*)').exec(w.location.search);try{return match?decodeURIComponent(match[1]):'';}catch(ignored){return '';}}

  try {var saved=JSON.parse(w.localStorage.getItem(key)||'null');if(saved&&saved.auth&&saved.auth.token){auth=saved.auth;role=saved.role||auth.user.role;}}catch(ignored){}
  if(w.addEventListener)w.addEventListener('online',flush);
  /* Only sends when something is waiting, so an idle phone makes no requests. */
  w.setInterval(flush,60000);
  var invoice=/^#invoice=(.+)$/.exec(w.location.hash);
  if(invoice)invoicePage(invoice[1],param('payment_ref'));
  else if(w.location.hash==='#reset')reset();
  else if(auth){home();flush();if(param('practice_tx'))verifyPass(param('practice_tx'));}
  else login();
}(window,document));
