import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import webpush from 'web-push';
import { initializeDb, seedData, default as db } from './src/db';

async function startServer() {
  // Initialize the database
  initializeDb();
  seedData();

  const uploadDir = './uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  // Set up multer for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
  });
  const upload = multer({ storage });

  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const pushNotificationsEnabled = Boolean(vapidPublicKey && vapidPrivateKey);

  if (pushNotificationsEnabled) {
    webpush.setVapidDetails(
      'mailto:your-email@example.com',
      vapidPublicKey,
      vapidPrivateKey
    );
  } else {
    console.warn('VAPID keys are not configured; web push notifications are disabled.');
  }

  const subscriptions = {};

  const PORT = 3000;

  const onlineUsers = new Set();

  // WebSocket connection logic
  wss.on('connection', (ws) => {
    let userId = ''; // Will be set on the first message

    console.log('Client connected');

    ws.on('message', (message) => {
      const parsedMessage = JSON.parse(message.toString());

      if (!userId) {
        userId = parsedMessage.sender_id || parsedMessage.user_id;
        if (userId) {
          onlineUsers.add(userId);
          broadcastOnlineUsers();
        }
      }

      if (parsedMessage.type === 'typing' || parsedMessage.type === 'stop_typing') {
        // Broadcast typing status to other clients in the same conversation
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(message.toString());
          }
        });
      } else if (parsedMessage.type === 'message_read') {
        // Update the message in the database
        const updateMessage = db.prepare("UPDATE messages SET read_by = json_insert(read_by, '$[#]', ?) WHERE id = ?");
        updateMessage.run(parsedMessage.user_id, parsedMessage.message_id);

        // Broadcast the event to the other user in the conversation
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(message.toString());
          }
        });
      } else {
        // Save the message to the database
        const insertMessage = db.prepare('INSERT INTO messages (id, conversation_id, sender_id, text, timestamp) VALUES (?, ?, ?, ?, ?)');
        insertMessage.run(parsedMessage.id, parsedMessage.conversation_id, parsedMessage.sender_id, parsedMessage.text, parsedMessage.timestamp);

        console.log(`Received and saved message: ${parsedMessage.text}`);
        
        // Send push notification
        const participants = db.prepare('SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?').all(parsedMessage.conversation_id, parsedMessage.sender_id);
        participants.forEach(participant => {
          if (pushNotificationsEnabled && subscriptions[participant.user_id]) {
            const payload = JSON.stringify({ title: 'New Message', body: parsedMessage.text });
            webpush.sendNotification(subscriptions[participant.user_id], payload).catch(error => console.error(error));
          }
        });
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(message.toString());
          }
        });
      }
    });

    ws.on('close', () => {
      if (userId) {
        onlineUsers.delete(userId);
        broadcastOnlineUsers();
      }
      console.log('Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  function broadcastOnlineUsers() {
    const message = JSON.stringify({ type: 'online_users', users: Array.from(onlineUsers) });
    wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }

  app.use('/uploads', express.static('uploads'));

  // API routes can go here in the future
  app.get('/api/online-users', (req, res) => {
    res.json(Array.from(onlineUsers));
  });
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    // For simplicity, we'll just return the file path
    // In a real app, you would create a new message and attachment in the database here
    res.json({ filePath: `/uploads/${req.file.filename}` });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/conversations', (req, res) => {
    // A more complex query to get all the data we need for the conversation list
    const conversationsQuery = `
      SELECT 
        c.id as conversation_id,
        (SELECT text FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message_text,
        (SELECT timestamp FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message_timestamp,
        u.id as user_id,
        u.name as user_name,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND instr(read_by, 'user_teacher_1') = 0) as unread_count,
        u.avatarUrl as user_avatar
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      JOIN users u ON u.id = cp.user_id
      WHERE cp.user_id != 'user_teacher_1' -- In a real app, this would be the current user's ID
    `;
    const conversations = db.prepare(conversationsQuery).all();
    res.json(conversations);
  });

  app.get('/api/messages/:conversationId', (req, res) => {
    const { conversationId } = req.params;
    const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ?').all(conversationId);
    res.json(messages);
  });

  app.get('/api/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    res.json(users);
  });

  app.post('/api/subscribe', (req, res) => {
    const { subscription, userId } = req.body;
    subscriptions[userId] = subscription;
    res.status(201).json({});
  });

  app.get('/api/search/messages', (req, res) => {
    const { query, userId } = req.query;
    if (!query || !userId) {
      return res.status(400).json({ error: 'Query and userId are required.' });
    }

    const searchQuery = `
      SELECT m.*, c.name as conversation_name, u.name as sender_name
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = ?)
        AND m.text LIKE ?
      ORDER BY m.timestamp DESC
    `;

    const messages = db.prepare(searchQuery).all(userId, `%${query}%`);
    res.json(messages);
  });

  app.post('/api/conversations', express.json(), (req, res) => {
    const { userIds, name } = req.body;
    const currentUser = 'user_teacher_1'; // This would come from auth
    const allUserIds = [currentUser, ...userIds];

    if (allUserIds.length < 2) {
      return res.status(400).json({ error: 'At least two users are required for a conversation.' });
    }

    if (allUserIds.length === 2 && !name) {
      // Check for existing one-on-one conversation
      const existingConversation = db.prepare(`
        SELECT conversation_id FROM conversation_participants
        WHERE conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = ?)
        GROUP BY conversation_id
        HAVING COUNT(DISTINCT user_id) = 2
          AND SUM(CASE WHEN user_id IN (?, ?) THEN 1 ELSE 0 END) = 2
      `).get(allUserIds[0], allUserIds[0], allUserIds[1]);

      if (existingConversation) {
        return res.json({ conversation_id: existingConversation.conversation_id, isNew: false });
      }
    }

    // Create a new conversation
    const newConvId = `conv_${Date.now()}`;
    db.prepare('INSERT INTO conversations (id, name) VALUES (?, ?)')
      .run(newConvId, name || null);
    
    const insertParticipant = db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)');
    allUserIds.forEach(userId => {
      insertParticipant.run(newConvId, userId);
    });

    res.status(201).json({ conversation_id: newConvId, isNew: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
