exports.up = function(knex) {
  return knex.schema
    .createTable('attendance_records', t => {
      t.increments('id').primary();
      t.text('student_id').notNullable();
      t.date('date').notNullable();
      t.string('status').notNullable(); // present, late, absent
      t.text('reason');
      t.text('recorded_by');
      t.timestamp('recorded_at').defaultTo(knex.fn.now());
      t.timestamps(true, true);
      t.unique(['student_id', 'date']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('attendance_records');
};
