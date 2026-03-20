// Simple Node.js WebSocket signaling server for WebRTC
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const clients = new Map(); // userId -> ws

wss.on('connection', (ws) => {
  let userId = null;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'register') {
        userId = data.userId;
        clients.set(userId, ws);
      } else if (data.type === 'signal') {
        const targetWs = clients.get(data.target);
        if (targetWs) {
          targetWs.send(JSON.stringify({
            type: 'signal',
            from: userId,
            signal: data.signal
          }));
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    if (userId) clients.delete(userId);
  });
});

console.log('WebRTC signaling server running on ws://localhost:8080');
