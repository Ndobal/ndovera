// Group WebRTC signaling server (Node.js, WebSocket)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map(); // roomId -> Set of userIds
const clients = new Map(); // userId -> ws

wss.on('connection', (ws) => {
  let userId = null;
  let roomId = null;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'register') {
        userId = data.userId;
        clients.set(userId, ws);
      } else if (data.type === 'join-room') {
        roomId = data.roomId;
        if (!rooms.has(roomId)) rooms.set(roomId, new Set());
        rooms.get(roomId).add(userId);
      } else if (data.type === 'leave-room') {
        if (roomId && rooms.has(roomId)) rooms.get(roomId).delete(userId);
      } else if (data.type === 'signal') {
        // Broadcast signal to all other users in the room
        if (roomId && rooms.has(roomId)) {
          rooms.get(roomId).forEach((peerId) => {
            if (peerId !== userId) {
              const peerWs = clients.get(peerId);
              if (peerWs) {
                peerWs.send(JSON.stringify({
                  type: 'signal',
                  from: userId,
                  signal: data.signal,
                  roomId
                }));
              }
            }
          });
        }
      } else if (data.type === 'invite') {
        // Send invitation to target user
        const targetWs = clients.get(data.target);
        if (targetWs) {
          targetWs.send(JSON.stringify({
            type: 'invite',
            from: userId,
            roomId: data.roomId
          }));
        }
      } else if (data.type === 'accept-invite') {
        // Notify inviter
        const inviterWs = clients.get(data.inviter);
        if (inviterWs) {
          inviterWs.send(JSON.stringify({
            type: 'accept-invite',
            from: userId,
            roomId: data.roomId
          }));
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    if (userId) clients.delete(userId);
    if (roomId && rooms.has(roomId)) rooms.get(roomId).delete(userId);
  });
});

console.log('Group WebRTC signaling server running on ws://localhost:8080');
