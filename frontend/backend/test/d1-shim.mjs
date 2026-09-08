// A D1Database stand-in backed by node:sqlite, so the academic session module
// can be exercised against real SQL — partial unique indexes, ON CONFLICT
// clauses and batch atomicity included — without a network or a new dependency.
//
// D1 is SQLite, so the same statements the Worker sends run here unchanged.

import { DatabaseSync } from 'node:sqlite'

class ShimStatement {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.params = []
  }

  bind(...params) {
    const next = new ShimStatement(this.db, this.sql)
    // node:sqlite rejects undefined and booleans; D1 accepts both.
    next.params = params.map(value => {
      if (value === undefined) return null
      if (typeof value === 'boolean') return value ? 1 : 0
      return value
    })
    return next
  }

  #prepared() {
    return this.db.prepare(this.sql)
  }

  async run() {
    const result = this.#prepared().run(...this.params)
    return {
      success: true,
      meta: {
        changes: Number(result.changes || 0),
        last_row_id: Number(result.lastInsertRowid || 0),
      },
    }
  }

  async first(column) {
    const row = this.#prepared().get(...this.params)
    if (!row) return null
    return column ? row[column] : row
  }

  async all() {
    const results = this.#prepared().all(...this.params)
    return { results, success: true, meta: { changes: 0 } }
  }

  async raw() {
    const results = this.#prepared().all(...this.params)
    return results.map(row => Object.values(row))
  }
}

export class D1Shim {
  constructor() {
    this.db = new DatabaseSync(':memory:')
    this.db.exec('PRAGMA foreign_keys = OFF')
  }

  prepare(sql) {
    return new ShimStatement(this.db, sql)
  }

  async exec(sql) {
    this.db.exec(sql)
    return { count: 1, duration: 0 }
  }

  /** All-or-nothing, the way D1 batches behave. */
  async batch(statements) {
    this.db.exec('BEGIN')
    try {
      const results = []
      for (const statement of statements) {
        results.push(await statement.run())
      }
      this.db.exec('COMMIT')
      return results
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  close() {
    this.db.close()
  }
}

/**
 * The pre-existing tables the academic module reads or mirrors into. Mirrors the
 * shapes the Worker creates at runtime.
 */
export function createLegacySchema(db) {
  db.db.exec(`
    CREATE TABLE settings (studentId TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, role TEXT,
      tenantId TEXT, className TEXT, status TEXT, createdAt TEXT
    );
    CREATE TABLE classes (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, arm TEXT, classTeacherId TEXT, createdAt TEXT);
    CREATE TABLE class_memberships (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, class_id TEXT NOT NULL, user_id TEXT NOT NULL,
      membership_role TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(tenant_id, class_id, user_id, membership_role)
    );
    CREATE TABLE fees_config (
      id TEXT PRIMARY KEY, tenant_id TEXT, fee_type TEXT, class_id TEXT, student_id TEXT,
      amount REAL, session TEXT, term TEXT, sort_order INTEGER, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE fees_ledger (
      id TEXT PRIMARY KEY, tenant_id TEXT, student_id TEXT, student_name TEXT, class_id TEXT,
      class_name TEXT, fee_amount REAL, amount_paid REAL, status TEXT, updated_at TEXT
    );
    CREATE TABLE school_sessions (
      id TEXT PRIMARY KEY, tenantId TEXT, session TEXT, term TEXT,
      startDate TEXT, endDate TEXT, createdAt TEXT
    );
  `)
}
