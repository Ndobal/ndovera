import React, { useState } from 'react';
import { liveSessionSeed } from '../data/classroomData';

export default function LiveTab() {
  const currentUserName = localStorage.getItem('userName') || 'Current Student';
  const [liveActive, setLiveActive] = useState(false);
  const [permissionPopupOpen, setPermissionPopupOpen] = useState(false);
  const [cameraAllowed, setCameraAllowed] = useState(true);
  const [micAllowed, setMicAllowed] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [liveChats, setLiveChats] = useState(liveSessionSeed.chats || []);
  const [livePanel, setLivePanel] = useState('chat');
  const [raisedHand, setRaisedHand] = useState(false);

  if (!liveSessionSeed.sessionTitle) {
    return (
      <section className="glass-surface rounded-3xl p-5 text-center">
        <p className="micro-label accent-amber">No live session scheduled</p>
        <p className="mt-2 text-slate-300">Live class information will appear here when a teacher starts or schedules a real session.</p>
      </section>
    );
  }

  const requestLivePermissions = () => setPermissionPopupOpen(true);
  const confirmPermissions = () => {
    setPermissionPopupOpen(false);
    setLiveActive(true);
  };

  const sendLiveChat = () => {
    const message = chatInput.trim();
    if (!message) return;
    setLiveChats(prev => [...prev, { id: `l-c-${Date.now()}`, user: currentUserName, text: message, time: 'Now' }]);
    setChatInput('');
  };

  return (
    <div className="space-y-4">
      <section className="glass-surface rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl command-title neon-title">{liveSessionSeed.sessionTitle}</h3>
            <p className="neon-subtle text-sm">Host: {liveSessionSeed.host}</p>
          </div>
          <div className="flex gap-2">
            {!liveActive && <button onClick={requestLivePermissions} className="px-4 py-2 rounded-xl bg-indigo-500/30 border border-indigo-300/40 text-white">Join Live</button>}
            {liveActive && <button onClick={() => setLiveActive(false)} className="px-4 py-2 rounded-xl bg-rose-500/30 border border-rose-300/40 text-white">End Class</button>}
          </div>
        </div>
      </section>

      {liveActive && (
        <section className="glass-surface rounded-3xl p-5 space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-3xl border border-white/10 bg-slate-950/60 p-4 space-y-3">
              <p className="micro-label accent-rose">Main Video Grid</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveSessionSeed.participants.map(participant => (
                  <div key={participant.name} className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                    <p className="text-slate-100 font-semibold">{participant.name}</p>
                    <p className="text-xs text-slate-300">{participant.role}</p>
                    {participant.speaking && <p className="micro-label mt-2 accent-emerald">Speaking</p>}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="px-3 py-1 rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-100">Share Screen</button>
                <button className="px-3 py-1 rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-100">Open Whiteboard</button>
                <button className="px-3 py-1 rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-100">Record Session</button>
                <button onClick={() => setRaisedHand(prev => !prev)} className="px-3 py-1 rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-100">{raisedHand ? 'Lower Hand' : 'Raise Hand'}</button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/30 p-4 space-y-3">
              <div className="flex gap-2">
                {['chat', 'participants', 'polls'].map(panel => (
                  <button key={panel} onClick={() => setLivePanel(panel)} className={livePanel === panel ? 'px-3 py-1 rounded-xl bg-indigo-500/30 border border-indigo-300/40 text-white text-xs' : 'px-3 py-1 rounded-xl bg-slate-900/40 border border-white/10 text-slate-200 text-xs'}>{panel}</button>
                ))}
              </div>

              {livePanel === 'chat' && (
                <div className="space-y-2">
                  <div className="max-h-56 overflow-y-auto space-y-2">
                    {liveChats.map(chat => <div key={chat.id} className="rounded-xl border border-white/10 bg-slate-900/40 p-2"><p className="text-xs text-slate-300"><span className="text-slate-100 font-semibold">{chat.user}:</span> {chat.text}</p></div>)}
                  </div>
                  <div className="flex gap-2">
                    <input value={chatInput} onChange={event => setChatInput(event.target.value)} className="flex-1 rounded-xl bg-slate-900/40 border border-white/10 px-3 py-1.5 text-xs text-slate-100" placeholder="Type message" />
                    <button onClick={sendLiveChat} className="px-3 py-1 rounded-xl border border-white/10 bg-slate-900/40 text-xs text-slate-100">Send</button>
                  </div>
                </div>
              )}

              {livePanel === 'participants' && (
                <div className="space-y-2">
                  {liveSessionSeed.participants.map(participant => <div key={participant.name} className="rounded-xl border border-white/10 bg-slate-900/40 p-2 flex justify-between text-xs"><span className="text-slate-100">{participant.name}</span><span className="text-slate-300">{participant.role}</span></div>)}
                  <p className="micro-label accent-emerald">Attendance: {liveSessionSeed.participants.length} present</p>
                </div>
              )}

              {livePanel === 'polls' && (
                <div className="space-y-3">
                  {liveSessionSeed.polls.map(poll => (
                    <div key={poll.id} className="rounded-xl border border-white/10 bg-slate-900/40 p-3 space-y-2">
                      <p className="text-sm text-slate-100 font-semibold">{poll.question}</p>
                      {poll.options.map((option, index) => (
                        <div key={option} className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-300"><span>{option}</span><span>{poll.votes[index]} votes</span></div>
                          <div className="h-2 rounded-full bg-slate-700 overflow-hidden"><div className="h-full bg-indigo-400" style={{ width: `${Math.min((poll.votes[index] / 20) * 100, 100)}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 space-y-1"><p className="micro-label accent-indigo">Permissions</p><p className="text-sm text-slate-200">Camera: {cameraAllowed ? 'Allowed' : 'Blocked'}</p><p className="text-sm text-slate-200">Microphone: {micAllowed ? 'Allowed' : 'Blocked'}</p></div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 space-y-1"><p className="micro-label accent-amber">Controls</p><p className="text-sm text-slate-200">Mute participants, manage chat, and track attendance in real-time.</p></div>
          </div>
        </section>
      )}

      {permissionPopupOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-surface rounded-3xl p-6 space-y-4">
            <h4 className="text-xl command-title neon-title">Live Permission Request</h4>
            <p className="text-slate-200">Allow camera and microphone to join the class session.</p>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/30 p-3 text-sm text-slate-100">Allow Camera<input type="checkbox" checked={cameraAllowed} onChange={event => setCameraAllowed(event.target.checked)} /></label>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/30 p-3 text-sm text-slate-100">Allow Microphone<input type="checkbox" checked={micAllowed} onChange={event => setMicAllowed(event.target.checked)} /></label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPermissionPopupOpen(false)} className="px-4 py-2 rounded-xl border border-white/10 bg-slate-900/30 text-slate-100">Cancel</button>
              <button onClick={confirmPermissions} className="px-4 py-2 rounded-xl border border-indigo-300/40 bg-indigo-500/20 text-white">Join Session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
