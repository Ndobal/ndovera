exports.up = function(knex) {
  return knex.schema
    .createTable('tuck_orders', t => {
      t.text('id').primary();
      t.text('placed_by').references('id').inTable('users');
      t.text('items'); // JSON
      t.integer('total_cents').defaultTo(0);
      t.text('notes');
      t.string('status').defaultTo('pending'); // pending, processing, completed, cancelled
      t.timestamp('placed_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .then(() => knex.schema.table('tuck_orders', (t) => {
      t.index(['placed_by'], 'tuck_orders_placed_by_idx');
      t.index(['status'], 'tuck_orders_status_idx');
    }));
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('tuck_orders');
};
