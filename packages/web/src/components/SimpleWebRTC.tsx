import React, { useRef, useState, useEffect } from 'react';
import { SIGNALING_WS_URL } from '../services/runtimeConfig';

// Replace with your actual userId logic
const userId = 'user_' + Math.floor(Math.random() * 10000);

export function SimpleWebRTC({ targetUserId, onClose }: { targetUserId: string, onClose: () => void }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callStarted, setCallStarted] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [peer, setPeer] = useState<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!SIGNALING_WS_URL) return;
    const socket = new window.WebSocket(SIGNALING_WS_URL);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'register', userId }));
    };
    setWs(socket);
    return () => socket.close();
  }, []);

  const startCall = async () => {
    setCallStarted(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    const pc = new RTCPeerConnection();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };
    pc.onicecandidate = (event) => {
      if (event.candidate && ws) {
        ws.send(JSON.stringify({ type: 'signal', target: targetUserId, signal: { candidate: event.candidate } }));
      }
    };
    setPeer(pc);
    // Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws?.send(JSON.stringify({ type: 'signal', target: targetUserId, signal: { sdp: offer } }));
  };

  useEffect(() => {
    if (!ws || !peer) return;
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'signal' && data.from === targetUserId) {
        if (data.signal.sdp) {
          await peer.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
          if (data.signal.sdp.type === 'offer') {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream.getTracks().forEach(track => peer.addTrack(track, stream));
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'signal', target: targetUserId, signal: { sdp: answer } }));
          }
        }
        if (data.signal.candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
        }
      }
    };
  }, [ws, peer, targetUserId]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-6 shadow-lg max-w-md w-full relative">
        <button className="absolute top-4 right-4 text-red-500 font-bold" onClick={onClose}>Close</button>
        <h2 className="text-xl font-bold mb-4">WebRTC Peer Call</h2>
        <div className="flex flex-col items-center gap-4">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-64 h-48 bg-black rounded" />
          <video ref={remoteVideoRef} autoPlay playsInline className="w-64 h-48 bg-black rounded" />
          {!callStarted && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={startCall}>Start Call</button>
          )}
        </div>
      </div>
    </div>
  );
}
