import React, { useRef, useState, useEffect } from 'react';
import { SIGNALING_WS_URL } from '../services/runtimeConfig';

const userId = 'user_' + Math.floor(Math.random() * 10000);

export function GroupWebRTC({ roomId, users, onClose }: { roomId: string, users: string[], onClose: () => void }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [peers, setPeers] = useState<{ [peerId: string]: RTCPeerConnection }>({});
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [callStarted, setCallStarted] = useState(false);
  const [invites, setInvites] = useState<{ from: string, roomId: string }[]>([]);

  useEffect(() => {
    if (!SIGNALING_WS_URL) return;
    const socket = new window.WebSocket(SIGNALING_WS_URL);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'register', userId }));
      socket.send(JSON.stringify({ type: 'join-room', roomId }));
    };
    setWs(socket);
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'leave-room', roomId }));
      }
      socket.close();
    };
  }, [roomId]);

  const startCall = async () => {
    setCallStarted(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    users.forEach(async (peerId) => {
      if (peerId === userId) return;
      const pc = new RTCPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      pc.onicecandidate = (event) => {
        if (event.candidate && ws) {
          ws.send(JSON.stringify({ type: 'signal', roomId, signal: { candidate: event.candidate }, target: peerId }));
        }
      };
      pc.ontrack = (event) => {
        // TODO: Render remote video for each peer
      };
      setPeers(prev => ({ ...prev, [peerId]: pc }));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws?.send(JSON.stringify({ type: 'signal', roomId, signal: { sdp: offer }, target: peerId }));
    });
  };

  useEffect(() => {
    if (!ws) return;
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'invite') {
        setInvites(inv => [...inv, { from: data.from, roomId: data.roomId }]);
      }
      if (data.type === 'accept-invite') {
        // Handle accepted invite
      }
      if (data.type === 'signal' && data.roomId === roomId) {
        const peerId = data.from;
        let pc = peers[peerId];
        if (!pc) {
          pc = new RTCPeerConnection();
          setPeers(prev => ({ ...prev, [peerId]: pc }));
        }
        if (data.signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
          if (data.signal.sdp.type === 'offer') {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'signal', roomId, signal: { sdp: answer }, target: peerId }));
          }
        }
        if (data.signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
        }
      }
    };
  }, [ws, peers, roomId]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-6 shadow-lg max-w-md w-full relative">
        <button className="absolute top-4 right-4 text-red-500 font-bold" onClick={onClose}>Close</button>
        <h2 className="text-xl font-bold mb-4">Group WebRTC Call</h2>
        <div className="flex flex-col items-center gap-4">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-64 h-48 bg-black rounded" />
          {/* TODO: Render remote videos for each peer */}
          {!callStarted && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={startCall}>Start Group Call</button>
          )}
          {invites.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Call Invitations</h3>
              {invites.map(inv => (
                <div key={inv.from} className="flex items-center gap-2 mb-2">
                  <span>Invited by {inv.from}</span>
                  <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={() => ws?.send(JSON.stringify({ type: 'accept-invite', inviter: inv.from, roomId: inv.roomId }))}>Accept</button>
                  <button className="px-2 py-1 bg-gray-400 text-white rounded" onClick={() => setInvites(invites.filter(i => i.from !== inv.from))}>Decline</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
