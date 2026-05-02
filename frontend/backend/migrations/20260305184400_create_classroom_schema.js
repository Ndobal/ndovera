exports.up = function(knex) {
  return knex.schema
    .createTable('classrooms', table => {
      table.text('id').primary();
      table.string('name').notNullable();
      table.text('school_id').references('id').inTable('schools');
      table.text('teacher_id').references('id').inTable('users');
      table.timestamps(true, true);
    })
    .createTable('classroom_users', table => {
      table.text('classroom_id').references('id').inTable('classrooms');
      table.text('user_id').references('id').inTable('users');
      table.primary(['classroom_id', 'user_id']);
    })
    .createTable('stream_posts', table => {
      table.increments('id').primary();
      table.text('classroom_id').references('id').inTable('classrooms');
      table.text('author_id').references('id').inTable('users');
      table.text('content').notNullable();
      table.timestamps(true, true);
    })
    .createTable('assignments', table => {
      table.increments('id').primary();
      table.text('classroom_id').references('id').inTable('classrooms');
      table.string('title').notNullable();
      table.text('description');
      table.datetime('due_at');
      table.timestamps(true, true);
    })
    .createTable('materials', table => {
      table.increments('id').primary();
      table.text('classroom_id').references('id').inTable('classrooms');
      table.string('title').notNullable();
      table.string('url');
      table.string('file_path');
      table.text('uploaded_by').references('id').inTable('users');
      table.timestamps(true, true);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('materials')
    .dropTableIfExists('assignments')
    .dropTableIfExists('stream_posts')
    .dropTableIfExists('classroom_users')
    .dropTableIfExists('classrooms');
};
