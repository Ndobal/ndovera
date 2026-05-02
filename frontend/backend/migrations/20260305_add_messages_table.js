exports.up = function(knex) {
  return knex.schema
    .createTable('conversations', t => {
      t.text('id').primary();
      t.text('subject');
      t.text('participants'); // JSON array of user ids
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('messages', t => {
      t.text('id').primary();
      t.text('conversation_id').references('id').inTable('conversations');
      t.text('sender_id');
      t.text('body');
      t.text('metadata'); // JSON
      t.timestamp('sent_at').defaultTo(knex.fn.now());
      t.timestamp('read_at');
    })
    .then(() => knex.schema.table('conversations', (t) => {
      t.index(['created_at'], 'conversations_created_idx');
    }));
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('messages')
    .dropTableIfExists('conversations');
};
