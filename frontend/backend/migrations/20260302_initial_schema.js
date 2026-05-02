exports.up = function(knex) {
  return knex.schema
    .createTable('schools', t => {
      t.text('id').primary();
      t.string('name').notNullable();
      t.string('timezone');
      t.text('tenant_config');
      t.timestamps(true, true);
    })
    .createTable('roles', t => {
      t.text('id').primary();
      t.string('name').notNullable();
      t.text('permissions');
    })
    .createTable('users', t => {
      t.text('id').primary();
      t.string('email').unique().notNullable();
      t.string('name');
      t.text('role_id').references('id').inTable('roles');
      t.text('school_id').references('id').inTable('schools');
      t.text('metadata');
      t.timestamps(true, true);
    })
    .createTable('exams', t => {
      t.text('id').primary();
      t.text('school_id').references('id').inTable('schools');
      t.string('title').notNullable();
      t.string('window');
      t.text('questions');
      t.text('created_by').references('id').inTable('users');
      t.string('status').defaultTo('draft');
      t.text('settings');
      t.timestamps(true, true);
    })
    .createTable('exam_submissions', t => {
      t.text('id').primary();
      t.text('exam_id').references('id').inTable('exams');
      t.text('user_id').references('id').inTable('users');
      t.timestamp('started_at');
      t.timestamp('submitted_at');
      t.string('ip_address');
      t.string('device_fingerprint');
      t.text('score_summary');
      t.boolean('graded').defaultTo(false);
    })
    .createTable('books', t => {
      t.text('id').primary();
      t.string('isbn');
      t.string('title');
      t.integer('price_cents').defaultTo(0);
      t.text('metadata');
      t.text('uploader_id').references('id').inTable('users');
      t.timestamps(true, true);
    })
    .createTable('purchases', t => {
      t.text('id').primary();
      t.text('book_id').references('id').inTable('books');
      t.text('user_id').references('id').inTable('users');
      t.integer('amount_cents').defaultTo(0);
      t.string('receipt_id');
      t.string('license_token');
      t.timestamps(true, true);
    })
    .createTable('licenses', t => {
      t.text('id').primary();
      t.text('purchase_id').references('id').inTable('purchases');
      t.text('user_id').references('id').inTable('users');
      t.string('device_fingerprint');
      t.string('token');
      t.timestamp('expires_at');
    })
    .createTable('packages', t => {
      t.text('id').primary();
      t.text('book_id').references('id').inTable('books');
      t.text('license_id').references('id').inTable('licenses');
      t.string('s3_path');
      t.timestamps(true, true);
    })
    .createTable('audit_logs', t => {
      t.increments('id').primary();
      t.text('actor_id');
      t.string('action');
      t.string('resource_type');
      t.string('resource_id');
      t.text('details');
      t.timestamp('timestamp').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('audit_logs')
    .dropTableIfExists('packages')
    .dropTableIfExists('licenses')
    .dropTableIfExists('purchases')
    .dropTableIfExists('books')
    .dropTableIfExists('exam_submissions')
    .dropTableIfExists('exams')
    .dropTableIfExists('users')
    .dropTableIfExists('roles')
    .dropTableIfExists('schools');
};
