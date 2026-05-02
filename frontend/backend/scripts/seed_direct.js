const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig.development);

async function run() {
  try {
    const convId = 'conv_direct_' + Date.now().toString().slice(-6);
    const msgId = 'msg_direct_' + Date.now().toString().slice(-6);

    await knex('conversations').insert({
      id: convId,
      subject: 'Direct DB Seed',
      participants: JSON.stringify(['student-demo','teacher-1']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log('Inserted conversation', convId);

    await knex('messages').insert({
      id: msgId,
      conversation_id: convId,
      sender_id: 'teacher-1',
      body: 'This message was inserted directly into the DB.',
      metadata: JSON.stringify({}),
      sent_at: new Date().toISOString(),
    });
    console.log('Inserted message', msgId);

    process.exit(0);
  } catch (err) {
    console.error('Direct seed failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

run();
