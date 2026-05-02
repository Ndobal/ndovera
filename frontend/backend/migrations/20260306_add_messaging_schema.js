exports.up = function(knex) {
  // Create only missing pieces so migrations are idempotent across environments
  return Promise.resolve()
    .then(() => knex.schema.hasTable('users').then(exists => {
      if (!exists) {
        return knex.schema.createTable('users', t => {
          t.text('id').primary();
          t.text('name').notNullable();
          t.text('role').notNullable();
          t.text('avatar_url');
        });
      }
      return Promise.resolve();
    }))
    .then(() => knex.schema.hasTable('conversation_participants').then(exists => {
      if (!exists) {
        return knex.schema.createTable('conversation_participants', t => {
          t.text('conversation_id').notNullable();
          t.text('user_id').notNullable();
          t.primary(['conversation_id', 'user_id']);
          t.foreign('conversation_id').references('conversations.id');
          t.foreign('user_id').references('users.id');
        });
      }
      return Promise.resolve();
    }))
    .then(() => knex.schema.hasTable('attachments').then(exists => {
      if (!exists) {
        return knex.schema.createTable('attachments', t => {
          t.text('id').primary();
          t.text('message_id').notNullable();
          t.text('file_name').notNullable();
          t.text('file_path').notNullable();
          t.text('file_type').notNullable();
          t.foreign('message_id').references('messages.id');
        });
      }
      return Promise.resolve();
    }))
    .then(() => knex.schema.hasColumn('messages', 'read_by').then(exists => {
      if (!exists) {
        return knex.schema.table('messages', t => {
          t.text('read_by').defaultTo('[]');
        });
      }
      return Promise.resolve();
    }));
};

exports.down = function(knex) {
  return Promise.resolve()
    .then(() => knex.schema.hasTable('attachments').then(exists => exists ? knex.schema.dropTable('attachments') : Promise.resolve()))
    .then(() => knex.schema.hasTable('conversation_participants').then(exists => exists ? knex.schema.dropTable('conversation_participants') : Promise.resolve()))
    .then(() => knex.schema.hasTable('users').then(exists => exists ? knex.schema.dropTable('users') : Promise.resolve()))
    .then(() => knex.schema.hasColumn('messages', 'read_by').then(exists => {
      if (exists) {
        return knex.schema.table('messages', t => t.dropColumn('read_by'));
      }
      return Promise.resolve();
    }));
};
