(async function(){
  const base = process.env.BASE_URL || 'http://localhost:3004';
  const log = console.log;
  try{
    log('GET /api/health');
    let r = await (await fetch(base + '/api/health')).text(); log(r);

    log('\nPOST /api/notes');
    r = await (await fetch(base + '/api/notes', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ title:'Smoke Note', subject:'Math', content:'Smoke test note', week:1, visibility:'Student' }) })).text(); log(r);

    log('\nGET /api/notes');
    r = await (await fetch(base + '/api/notes')).text(); log(r);

    log('\nPOST /api/cbt/exams');
    r = await (await fetch(base + '/api/cbt/exams', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ title:'Smoke Exam', total_marks:50 }) })).text(); log(r);

    log('\nPOST /api/cbt/attempts');
    r = await (await fetch(base + '/api/cbt/attempts', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ exam_id:'exam_123', student_id:'student_s1', score:40, answers:{ q1:'a' } }) })).text(); log(r);

    log('\nPOST /api/messages');
    r = await (await fetch(base + '/api/messages', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ from_user:'user_admin', to_user:'t1', content:'Hello from smoke test' }) })).text(); log(r);

    log('\nGET /api/messages?userId=user_admin');
    r = await (await fetch(base + '/api/messages?userId=user_admin')).text(); log(r);

    log('\nPOST /api/farms');
    r = await (await fetch(base + '/api/farms', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ name:'Smoke Farm', plot_count:2, produce:'Maize', manager_id:'t3' }) })).text(); log(r);

    log('\nGET /api/farms');
    r = await (await fetch(base + '/api/farms')).text(); log(r);

  } catch (err) {
    console.error('Smoke tests failed', err);
    process.exit(2);
  }
})();
