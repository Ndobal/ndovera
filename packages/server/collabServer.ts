import WebSocket from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import http from 'http';

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('okay');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  console.log('New collaboration connection established');
  setupWSConnection(conn, req);
});

const PORT = process.env.COLLAB_PORT || 1234;

server.listen(PORT, () => {
  console.log(`Collaborative editing WebSocket server running on port ${PORT}`);
});
