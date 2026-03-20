import Database from 'better-sqlite3';

const db = new Database('ndovera.db');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// --- Schema Definition ---
export function initializeDb() {
  const createUsersTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      avatarUrl TEXT
    )
  `);

  const createConversationsTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      name TEXT
    )
  `);

  const createConversationParticipantsTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  const createMessagesTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      read_by TEXT DEFAULT '[]',
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    )
  `);

  const createAttachmentsTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id)
    )
  `);

  // Execute all table creation statements
  db.transaction(() => {
    createUsersTable.run();
    createConversationsTable.run();
    createConversationParticipantsTable.run();
    createMessagesTable.run();
    createAttachmentsTable.run();
  })();

  console.log('Database initialized successfully.');
}

// --- Seeding Logic ---
export function seedData() {
  const isSeeded = db.prepare('SELECT count(*) as count FROM users').get().count > 0;
  if (isSeeded) {
    console.log('Database already seeded.');
    return;
  }

  // Your mock data from MessagingScreen.tsx
  const mockUsers = {
    'user_teacher_1': { id: 'user_teacher_1', name: 'Mr. Adekunle', role: 'TEACHER', avatarUrl: 'https://picsum.photos/seed/teacher1/100' },
    'user_student_1': { id: 'user_student_1', name: 'Bisi Adebayo', role: 'STUDENT', avatarUrl: 'https://picsum.photos/seed/student1/100' },
    'user_parent_1': { id: 'user_parent_1', name: 'Mr. & Mrs. Okoro', role: 'PARENT', avatarUrl: 'https://picsum.photos/seed/parent1/100' },
    'user_admin_1': { id: 'user_admin_1', name: 'School Admin', role: 'HOS', avatarUrl: 'https://picsum.photos/seed/admin1/100' },
  };

  const mockConversations = [
    { id: 'conv_1', participants: ['user_teacher_1', 'user_student_1'] },
    { id: 'conv_2', participants: ['user_teacher_1', 'user_parent_1'] },
    { id: 'conv_3', participants: ['user_teacher_1', 'user_admin_1'] },
  ];

  const mockMessages = {
    'conv_1': [
      { id: 'msg1', conversationId: 'conv_1', senderId: 'user_student_1', text: 'Good morning, sir. I have a question about the assignment.', timestamp: Date.now() - 100000, readBy: [] },
      { id: 'msg2', conversationId: 'conv_1', senderId: 'user_teacher_1', text: 'Good morning, Bisi. I am here to help. What is your question?', timestamp: Date.now() - 90000, readBy: ['user_student_1'] },
    ],
    'conv_2': [
      { id: 'msg3', conversationId: 'conv_2', senderId: 'user_parent_1', text: "Thank you for the update on Chinedu's progress.", timestamp: Date.now() - 200000, readBy: ['user_teacher_1'] },
    ],
    'conv_3': [
      { id: 'msg4', conversationId: 'conv_3', senderId: 'user_admin_1', text: 'Please remember the staff meeting tomorrow at 10 AM.', timestamp: Date.now() - 300000, readBy: ['user_teacher_1'] },
    ],
  };

  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, role, avatarUrl) VALUES (?, ?, ?, ?)');
  const insertConversation = db.prepare('INSERT OR IGNORE INTO conversations (id) VALUES (?)');
  const insertParticipant = db.prepare('INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)');
  const insertMessage = db.prepare('INSERT OR IGNORE INTO messages (id, conversation_id, sender_id, text, timestamp, read_by) VALUES (?, ?, ?, ?, ?, ?)');

  db.transaction(() => {
    Object.values(mockUsers).forEach(user => {
      insertUser.run(user.id, user.name, user.role, user.avatarUrl);
    });

    mockConversations.forEach(conv => {
      insertConversation.run(conv.id);
      conv.participants.forEach(userId => {
        insertParticipant.run(conv.id, userId);
      });
    });

    Object.values(mockMessages).flat().forEach(msg => {
      insertMessage.run(msg.id, msg.conversationId, msg.senderId, msg.text, msg.timestamp, JSON.stringify(msg.readBy || []));
    });
  })();

  console.log('Database seeded successfully.');
}



export default db;
