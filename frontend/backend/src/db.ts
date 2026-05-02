export interface Bindings {
  APP_DB: D1Database
  SESSIONS: KVNamespace
  UPLOADS: R2Bucket
  JWT_SECRET: string
  CORS_ORIGIN: string
}

// Settings functions
export async function getSettings(db: D1Database, studentId: string) {
  const result = await db.prepare('SELECT payload FROM settings WHERE studentId = ?').bind(studentId).first()
  if (!result) return null
  try {
    return JSON.parse(result.payload as string)
  } catch {
    return null
  }
}

export async function upsertSettings(db: D1Database, studentId: string, payload: any) {
  const str = JSON.stringify(payload)
  await db.prepare('INSERT INTO settings(studentId, payload) VALUES(?, ?) ON CONFLICT(studentId) DO UPDATE SET payload = excluded.payload').bind(studentId, str).run()
  return true
}

export async function addAudit(db: D1Database, studentId: string, entry: any) {
  const id = entry.id || `audit-${Date.now()}`
  const ts = entry.ts || new Date().toISOString()
  const action = entry.action || 'unknown'
  const data = JSON.stringify(entry.data || {})
  await db.prepare('INSERT INTO audit(id, studentId, ts, action, data) VALUES(?, ?, ?, ?, ?)').bind(id, studentId, ts, action, data).run()
  return { id, studentId, ts, action, data: JSON.parse(data) }
}

export async function getAuditForStudent(db: D1Database, studentId: string) {
  const result = await db.prepare('SELECT id, studentId, ts, action, data FROM audit WHERE studentId = ? ORDER BY ts DESC').bind(studentId).all()
  return result.results.map(r => ({ ...r, data: JSON.parse(r.data as string) }))
}

export async function getAllAudits(db: D1Database) {
  const result = await db.prepare('SELECT id, studentId, ts, action, data FROM audit ORDER BY ts DESC').all()
  return result.results.map(r => ({ ...r, data: JSON.parse(r.data as string) }))
}

// Library functions
export async function getAllBooks(db: D1Database) {
  const result = await db.prepare('SELECT id, title, author, description, cover, metadata FROM books ORDER BY title').all()
  return result.results.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata as string) : {} }))
}

export async function getBookById(db: D1Database, id: string) {
  const result = await db.prepare('SELECT id, title, author, description, cover, metadata FROM books WHERE id = ?').bind(id).first()
  if (!result) return null
  return { ...result, metadata: result.metadata ? JSON.parse(result.metadata as string) : {} }
}

export async function upsertBook(db: D1Database, book: any) {
  const id = book.id || `book-${Date.now()}`
  const meta = JSON.stringify(book.metadata || {})
  await db.prepare('INSERT INTO books(id, title, author, description, cover, metadata) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, author = excluded.author, description = excluded.description, cover = excluded.cover, metadata = excluded.metadata').bind(id, book.title || null, book.author || null, book.description || null, book.cover || null, meta).run()
  return { id }
}

export async function deleteBook(db: D1Database, id: string) {
  await db.prepare('DELETE FROM books WHERE id = ?').bind(id).run()
  return true
}

export async function borrowBook(db: D1Database, bookId: string, studentId: string, dueAt: string | null, meta: any) {
  const id = `borrow-${Date.now()}`
  const borrowedAt = new Date().toISOString()
  const status = 'borrowed'
  const metaStr = JSON.stringify(meta || {})
  await db.prepare('INSERT INTO borrowings(id, bookId, studentId, borrowedAt, dueAt, returnedAt, status, meta) VALUES(?, ?, ?, ?, ?, ?, ?, ?)').bind(id, bookId, studentId, borrowedAt, dueAt, null, status, metaStr).run()
  return { id, bookId, studentId, borrowedAt, dueAt, status, meta: meta || {} }
}

export async function returnBook(db: D1Database, borrowingId: string) {
  const returnedAt = new Date().toISOString()
  const status = 'returned'
  await db.prepare('UPDATE borrowings SET returnedAt = ?, status = ? WHERE id = ?').bind(returnedAt, status, borrowingId).run()
  return { id: borrowingId, returnedAt, status }
}

export async function getBorrowingsForStudent(db: D1Database, studentId: string) {
  const result = await db.prepare('SELECT id, bookId, studentId, borrowedAt, dueAt, returnedAt, status, meta FROM borrowings WHERE studentId = ? ORDER BY borrowedAt DESC').bind(studentId).all()
  return result.results.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta as string) : {} }))
}

export async function getAllBorrowings(db: D1Database) {
  const result = await db.prepare('SELECT id, bookId, studentId, borrowedAt, dueAt, returnedAt, status, meta FROM borrowings ORDER BY borrowedAt DESC').all()
  return result.results.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta as string) : {} }))
}

// Classroom functions
export async function getClassById(db: D1Database, id: string) {
  const result = await db.prepare('SELECT id, name, teacherId, meta FROM classes WHERE id = ?').bind(id).first()
  if (!result) return null
  return { ...result, meta: result.meta ? JSON.parse(result.meta as string) : {} }
}

export async function getPostsForClass(db: D1Database, classId: string, limit = 100) {
  const result = await db.prepare('SELECT id, classId, authorId, content, attachments, createdAt FROM posts WHERE classId = ? ORDER BY createdAt DESC LIMIT ?').bind(classId, limit).all()
  return result.results.map(r => ({ ...r, attachments: r.attachments ? JSON.parse(r.attachments as string) : [] }))
}

export async function createPost(db: D1Database, post: any) {
  const id = post.id || `post-${Date.now()}`
  const createdAt = new Date().toISOString()
  const attachments = JSON.stringify(post.attachments || [])
  await db.prepare('INSERT INTO posts(id, classId, authorId, content, attachments, createdAt) VALUES(?, ?, ?, ?, ?, ?)').bind(id, post.classId, post.authorId, post.content || null, attachments, createdAt).run()
  return { id, classId: post.classId, authorId: post.authorId, content: post.content, attachments: post.attachments || [], createdAt }
}

export async function getAssignmentsForClass(db: D1Database, classId: string) {
  const result = await db.prepare('SELECT id, classId, title, description, dueAt, createdAt FROM assignments WHERE classId = ? ORDER BY createdAt DESC').bind(classId).all()
  return result.results
}

export async function createAssignment(db: D1Database, a: any) {
  const id = a.id || `assign-${Date.now()}`
  const createdAt = new Date().toISOString()
  await db.prepare('INSERT INTO assignments(id, classId, title, description, dueAt, createdAt) VALUES(?, ?, ?, ?, ?, ?)').bind(id, a.classId, a.title || null, a.description || null, a.dueAt || null, createdAt).run()
  return { id, classId: a.classId, title: a.title, description: a.description, dueAt: a.dueAt, createdAt }
}

export async function getMaterialsForClass(db: D1Database, classId: string) {
  const result = await db.prepare('SELECT id, classId, title, url, metadata, uploadedAt, uploadedBy FROM materials WHERE classId = ? ORDER BY uploadedAt DESC').bind(classId).all()
  return result.results.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata as string) : {} }))
}

export async function addMaterial(db: D1Database, mat: any) {
  const id = mat.id || `mat-${Date.now()}`
  const uploadedAt = new Date().toISOString()
  const metadata = JSON.stringify(mat.metadata || {})
  await db.prepare('INSERT INTO materials(id, classId, title, url, metadata, uploadedAt, uploadedBy) VALUES(?, ?, ?, ?, ?, ?, ?)').bind(id, mat.classId, mat.title || null, mat.url || null, metadata, uploadedAt, mat.uploadedBy || null).run()
  return { id, classId: mat.classId, title: mat.title, url: mat.url, metadata: mat.metadata || {}, uploadedAt, uploadedBy: mat.uploadedBy }
}

export async function getAttendanceForClass(db: D1Database, classId: string, sinceDate?: string) {
  let query = 'SELECT id, classId, studentId, date, status, recordedBy, notes FROM attendance_records WHERE classId = ?'
  const params = [classId]
  if (sinceDate) {
    query += ' AND date >= ?'
    params.push(sinceDate)
  }
  query += ' ORDER BY date DESC'
  const result = await db.prepare(query).bind(...params).all()
  return result.results
}

export async function recordAttendance(db: D1Database, classId: string, studentId: string, date: string, status: string, recordedBy?: string, notes?: string) {
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
  await db.prepare('INSERT INTO attendance_records(id, classId, studentId, date, status, recordedBy, notes) VALUES(?, ?, ?, ?, ?, ?, ?)').bind(id, classId, studentId, date, status, recordedBy || null, notes || null).run()
  return { id, classId, studentId, date, status, recordedBy, notes }
}

export async function saveContent(db: D1Database, classId: string, role: string, content: string) {
  const id = `save-${Date.now()}`
  const ts = new Date().toISOString()
  await db.prepare('INSERT INTO content_saves(id, classId, role, content, ts) VALUES(?, ?, ?, ?, ?)').bind(id, classId || null, role || null, content || null, ts).run()
  return { id, classId, role, ts }
}

// Attendance functions (assuming attendance_records table exists)
export async function getAttendance(db: D1Database, studentId: string, limit = 365) {
  const result = await db.prepare('SELECT * FROM attendance_records WHERE student_id = ? ORDER BY date DESC LIMIT ?').bind(studentId, limit).all()
  return result.results
}

export async function upsertAttendance(db: D1Database, studentId: string, date: string, status: string, reason?: string, recordedBy?: string) {
  const existing = await db.prepare('SELECT id FROM attendance_records WHERE student_id = ? AND date = ?').bind(studentId, date).first()
  if (existing) {
    await db.prepare('UPDATE attendance_records SET status = ?, reason = ?, recorded_by = ?, updated_at = ? WHERE id = ?').bind(status, reason || null, recordedBy || null, new Date().toISOString(), existing.id).run()
    return { updated: true }
  } else {
    const id = `att-${Date.now()}`
    await db.prepare('INSERT INTO attendance_records(id, student_id, date, status, reason, recorded_by) VALUES(?, ?, ?, ?, ?, ?)').bind(id, studentId, date, status, reason || null, recordedBy || null).run()
    return { id }
  }
}

export async function updateAttendance(db: D1Database, id: string, status: string, reason?: string) {
  const existing = await db.prepare('SELECT * FROM attendance_records WHERE id = ?').bind(id).first()
  if (!existing) throw new Error('Record not found')
  await db.prepare('UPDATE attendance_records SET status = ?, reason = ?, updated_at = ? WHERE id = ?').bind(status, reason || (existing.reason as string), new Date().toISOString(), id).run()
  return true
}

// Conversations and messages (assuming tables exist from migrations)
export async function getConversations(db: D1Database, userId?: string) {
  let query = 'SELECT id, subject, participants, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 200'
  const params: string[] = []
  if (userId) {
    query = 'SELECT id, subject, participants, created_at, updated_at FROM conversations WHERE participants LIKE ? ORDER BY updated_at DESC LIMIT 200'
    params.push(`%"${userId}"%`)
  }
  const result = await db.prepare(query).bind(...params).all()
  return result.results.map(r => ({ ...r, participants: JSON.parse(r.participants as string) }))
}

export async function createConversation(db: D1Database, subject: string | null, participants: string[]) {
  if (!Array.isArray(participants) || participants.length === 0) throw new Error('Missing participants')
  const studentCount = participants.filter(p => String(p).startsWith('student-')).length
  if (studentCount > 1) throw new Error('Student-to-student messaging is disabled')
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
  const now = new Date().toISOString()
  await db.prepare('INSERT INTO conversations(id, subject, participants, created_at, updated_at) VALUES(?, ?, ?, ?, ?)').bind(id, subject, JSON.stringify(participants), now, now).run()
  return { id, subject, participants }
}

export async function getMessages(db: D1Database, conversationId: string) {
  const result = await db.prepare('SELECT id, conversation_id, sender_id, body, metadata, sent_at, read_at FROM messages WHERE conversation_id = ? ORDER BY sent_at ASC LIMIT 200').bind(conversationId).all()
  return result.results.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata as string) : {} }))
}

export async function sendMessage(db: D1Database, conversationId: string, senderId: string, body: string, metadata?: any) {
  const conv = await db.prepare('SELECT participants FROM conversations WHERE id = ?').bind(conversationId).first()
  if (!conv) throw new Error('Conversation not found')
  const participants = JSON.parse(conv.participants as string)
  const otherStudents = participants.filter((p: string) => String(p).startsWith('student-') && p !== senderId)
  if (String(senderId).startsWith('student-') && otherStudents.length > 0) {
    throw new Error('Student-to-student messaging is disabled')
  }
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
  const now = new Date().toISOString()
  await db.prepare('INSERT INTO messages(id, conversation_id, sender_id, body, metadata, sent_at) VALUES(?, ?, ?, ?, ?, ?)').bind(msgId, conversationId, senderId, body, JSON.stringify(metadata || {}), now).run()
  await db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').bind(now, conversationId).run()
  return { id: msgId, conversationId, senderId, body, metadata: metadata || {}, sentAt: now }
}

export async function markMessagesRead(db: D1Database, conversationId: string) {
  await db.prepare('UPDATE messages SET read_at = ? WHERE conversation_id = ? AND read_at IS NULL').bind(new Date().toISOString(), conversationId).run()
  return true
}

// Tuck orders (assuming tuck_orders table exists)
export async function getTuckOrders(db: D1Database, placedBy?: string) {
  let query = 'SELECT id, placed_by, items, total_cents, notes, status, placed_at, updated_at FROM tuck_orders ORDER BY placed_at DESC LIMIT 200'
  const params: string[] = []
  if (placedBy) {
    query = 'SELECT id, placed_by, items, total_cents, notes, status, placed_at, updated_at FROM tuck_orders WHERE placed_by = ? ORDER BY placed_at DESC LIMIT 200'
    params.push(placedBy)
  }
  const result = await db.prepare(query).bind(...params).all()
  return result.results.map(r => ({
    id: r.id,
    placedBy: r.placed_by,
    items: JSON.parse(r.items as string),
    total: (r.total_cents as number) / 100,
    notes: r.notes,
    status: r.status,
    placedAt: r.placed_at,
    updatedAt: r.updated_at
  }))
}

export async function createTuckOrder(db: D1Database, order: any) {
  const id = order.id || `order_${Date.now()}`
  const placedBy = order.placedBy || null
  const itemsJson = JSON.stringify(order.items || [])
  const totalCents = Math.round((order.total || 0) * 100)
  const notes = order.notes || null
  const status = order.status || 'pending'
  const now = new Date().toISOString()
  await db.prepare('INSERT INTO tuck_orders(id, placed_by, items, total_cents, notes, status, placed_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)').bind(id, placedBy, itemsJson, totalCents, notes, status, now, now).run()
  return {
    ...order,
    id,
    total: totalCents / 100,
    placedAt: now,
    status
  }
}

export async function updateTuckOrder(db: D1Database, id: string, changes: any) {
  const existing = await db.prepare('SELECT * FROM tuck_orders WHERE id = ?').bind(id).first()
  if (!existing) throw new Error('Order not found')
  if (existing.status !== 'pending') throw new Error('Only pending orders can be amended')
  const update: any = {}
  if (changes.items) update.items = JSON.stringify(changes.items)
  if (typeof changes.total !== 'undefined') update.total_cents = Math.round(changes.total * 100)
  if (typeof changes.notes !== 'undefined') update.notes = changes.notes
  if (typeof changes.status !== 'undefined') update.status = changes.status
  update.updated_at = new Date().toISOString()
  const setClause = Object.keys(update).map(k => `${k} = ?`).join(', ')
  const values = Object.values(update)
  values.push(id)
  await db.prepare(`UPDATE tuck_orders SET ${setClause} WHERE id = ?`).bind(...values).run()
  return true
}

export async function getWeeklyTuckSummary(db: D1Database, placedBy?: string, weeks = 12) {
  const lookback = Math.max(1, Math.min(52, weeks))
  const since = new Date()
  since.setDate(since.getDate() - (lookback * 7))
  let query = 'SELECT * FROM tuck_orders WHERE placed_at >= ?'
  const params = [since.toISOString()]
  if (placedBy) {
    query += ' AND placed_by = ?'
    params.push(placedBy)
  }
  const result = await db.prepare(query).bind(...params).all()
  const groups: any = {}
  result.results.forEach((r: any) => {
    const d = new Date(r.placed_at as string)
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const day = tmp.getUTCDay() || 7
    const monday = new Date(tmp)
    monday.setUTCDate(tmp.getUTCDate() - (day - 1))
    const weekKey = monday.toISOString().slice(0,10)
    const userKey = r.placed_by || 'unknown'
    const key = `${userKey}::${weekKey}`
    if (!groups[key]) groups[key] = { placedBy: userKey, weekStart: weekKey, orders: [], total: 0 }
    groups[key].orders.push({
      id: r.id,
      items: JSON.parse(r.items as string),
      total: (r.total_cents as number) / 100,
      status: r.status,
      placedAt: r.placed_at
    })
    groups[key].total += (r.total_cents as number) / 100
  })
  return Object.values(groups).sort((a: any, b: any) => b.weekStart.localeCompare(a.weekStart))
}