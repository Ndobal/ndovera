import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, MessageSquare, LayoutGrid, Sparkles, 
  BrainCircuit, FileText, Clock, Settings,
  Mic, MicOff, Video, VideoOff, Edit3, Hand,
  BarChart3, PenTool, Grid, List, Layers, CircleDot,
  Play, Square, Volume2, Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Participant, Message, TranscriptionEntry, cn } from './lib/utils';
import { askAIAssistant, getTranscriptionSummary } from './services/gemini';
import { VideoGrid } from './components/Meeting/VideoGrid';
import { MeetingControls, IconButton } from './components/Meeting/Controls';
import { Sidebar } from './components/Meeting/Sidebar';

export default function App() {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeSidebar, setActiveSidebar] = useState<'chat' | 'participants' | 'ai' | 'summary' | 'settings' | 'notes' | 'polls' | 'whiteboard' | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sharedNotes, setSharedNotes] = useState('# Meeting Notes\n\n- Discuss project timeline\n- Review design assets\n- Assign action items');
  const [isJoined, setIsJoined] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [lobbyAudioLevel, setLobbyAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isTestRecording, setIsTestRecording] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isTestPlaying, setIsTestPlaying] = useState(false);
  const testRecorderRef = useRef<MediaRecorder | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const testChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const [audioQuality, setAudioQuality] = useState<'standard' | 'high-fidelity'>('standard');

  const fetchDevices = async () => {
    try {
      const deviceInfos = await navigator.mediaDevices.enumerateDevices();
      setDevices(deviceInfos);
      
      // Set defaults if not set
      if (!selectedAudioInput) {
        const defaultAudio = deviceInfos.find(d => d.kind === 'audioinput');
        if (defaultAudio) setSelectedAudioInput(defaultAudio.deviceId);
      }
      if (!selectedVideoInput) {
        const defaultVideo = deviceInfos.find(d => d.kind === 'videoinput');
        if (defaultVideo) setSelectedVideoInput(defaultVideo.deviceId);
      }
    } catch (err) {
      console.error("Error fetching devices:", err);
    }
  };

  useEffect(() => {
    navigator.mediaDevices.addEventListener('devicechange', fetchDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', fetchDevices);
  }, []);

  useEffect(() => {
    if (!isJoined && localStream && !isMuted) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(localStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setLobbyAudioLevel(Math.min(100, (average / 128) * 100));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
      
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        source.disconnect();
      };
    } else {
      setLobbyAudioLevel(0);
    }
  }, [isJoined, isMuted, localStream]);
  const [toast, setToast] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionEntry[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [layout, setLayout] = useState<'grid' | 'list' | 'stacked'>('grid');
  const [sessionTime, setSessionTime] = useState(3780); // 1 hour 3 minutes
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [userName, setUserName] = useState('Will Ndobal');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);

  // Session Timer
  useEffect(() => {
    if (!isJoined) return;
    const interval = setInterval(() => {
      setSessionTime(prev => {
        // Auto-show modal when exactly 1 hour (3600s) or 5 mins (300s) remains
        if (prev === 3600 || prev === 300) {
          setShowExtendModal(true);
        }
        return Math.max(0, prev - 1);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isJoined]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  // Handle Camera & Microphone Initialization
  const startMedia = async () => {
    try {
      const isHighFidelity = audioQuality === 'high-fidelity';
      const audioConstraints = selectedAudioInput ? { 
        deviceId: { exact: selectedAudioInput },
        echoCancellation: !isHighFidelity,
        noiseSuppression: !isHighFidelity,
        autoGainControl: !isHighFidelity,
        sampleRate: 48000,
        channelCount: 2
      } : {
        echoCancellation: !isHighFidelity,
        noiseSuppression: !isHighFidelity,
        autoGainControl: !isHighFidelity,
        sampleRate: 48000,
        channelCount: 2
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true,
          audio: audioConstraints
        });
      } catch (videoErr: any) {
        console.warn("Could not start video, falling back to audio only:", videoErr);
        // Fallback to audio only if video fails (e.g., camera in use)
        stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: audioConstraints
        });
        setIsCameraOff(true); // Automatically turn off camera state
        setToast("Camera unavailable. Joined with audio only.");
      }

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (lobbyVideoRef.current) {
        lobbyVideoRef.current.srcObject = stream;
      }
      // Initial track states
      stream.getAudioTracks().forEach(track => track.enabled = !isMuted);
      stream.getVideoTracks().forEach(track => track.enabled = !isCameraOff);
      
      // Only show success toast if we didn't show the fallback toast
      if (stream.getVideoTracks().length > 0) {
        setToast("Camera and microphone connected");
      }
      
      // Fetch devices after getting permission
      fetchDevices();
    } catch (err: any) {
      console.error("Error accessing media devices:", err);
      if (err.name === 'NotAllowedError') {
        setToast("Microphone/Camera access denied. Please enable them in your browser settings.");
      } else if (err.name === 'NotFoundError') {
        setToast("No microphone or camera found on this device.");
      } else {
        setToast("Failed to access camera/microphone. Please check your browser permissions.");
      }
    }
  };

  useEffect(() => {
    startMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAudioInput, selectedVideoInput, audioQuality]); // Re-run when devices or quality change

  // Update tracks when muted/camera toggled
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isCameraOff;
      });
    }
  }, [isMuted, isCameraOff, localStream]);

  // Toast Timer
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const toggleScreenShare = async () => {
    if (!isSharing) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(displayStream);
        setIsSharing(true);
        setToast("You are now sharing your screen");
        
        displayStream.getVideoTracks()[0].onended = () => {
          setIsSharing(false);
          setScreenStream(null);
          setToast("Screen sharing ended");
        };
      } catch (err: any) {
        console.error("Error sharing screen:", err);
        if (err.name === 'NotAllowedError' || err.message?.includes('Permissions policy')) {
          setToast("Screen sharing is blocked by browser policy in this view. Try opening in a new tab.");
        } else {
          setToast("Failed to share screen. Check browser permissions.");
        }
      }
    } else {
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      setIsSharing(false);
      setScreenStream(null);
      setToast("Screen sharing ended");
    }
  };

  const activeStream = React.useMemo(() => {
    if (isSharing && screenStream) {
      const combined = new MediaStream();
      screenStream.getVideoTracks().forEach(t => combined.addTrack(t));
      if (localStream) {
        localStream.getAudioTracks().forEach(t => combined.addTrack(t));
      }
      return combined;
    }
    return localStream;
  }, [isSharing, screenStream, localStream]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleToggleRecording = () => {
    if (!isRecording) {
      if (!localStream) {
        setToast("No media stream available to record");
        return;
      }
      
      try {
        recordedChunksRef.current = [];
        const options = { mimeType: 'video/webm;codecs=vp8,opus' };
        const recorder = new MediaRecorder(
          localStream, 
          MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined
        );
        
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.style.display = 'none';
          a.href = url;
          a.download = `auralis-recording-${new Date().toISOString().slice(0,10)}.webm`;
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          setToast("Recording saved");
        };
        
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setToast("Recording started");
      } catch (err) {
        console.error("Error starting recording:", err);
        setToast("Failed to start recording");
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  const startTestRecording = () => {
    if (!localStream) {
      setToast("No microphone access");
      return;
    }
    try {
      // Ensure audio tracks are enabled for the test
      localStream.getAudioTracks().forEach(t => t.enabled = true);
      
      testChunksRef.current = [];
      // Create a stream with only audio for the test recorder
      const audioOnlyStream = new MediaStream(localStream.getAudioTracks());
      
      // Try to find a supported mimeType
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/webm',
        'audio/mp4'
      ];
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      
      const recorder = new MediaRecorder(audioOnlyStream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) testChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(testChunksRef.current, { type: mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setTestAudioUrl(url);
        setToast("Mic check complete. Click play to listen.");
        
        // Restore muted state if it was muted
        if (isMuted) {
          localStream.getAudioTracks().forEach(t => t.enabled = false);
        }
      };
      recorder.start();
      testRecorderRef.current = recorder;
      setIsTestRecording(true);
      setTestAudioUrl(null);
      
      // Auto stop after 5 seconds
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          setIsTestRecording(false);
        }
      }, 5000);
    } catch (err) {
      console.error("Test recording error:", err);
      setToast("Failed to start mic check");
    }
  };

  const stopTestRecording = () => {
    if (testRecorderRef.current && testRecorderRef.current.state === 'recording') {
      testRecorderRef.current.stop();
      setIsTestRecording(false);
    }
  };

  const [testAudioProgress, setTestAudioProgress] = useState(0);

  const playSampleAudio = () => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4 note
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 1);
    setToast("Playing test tone...");
  };

  const playTestAudio = () => {
    if (testAudioUrl && testAudioRef.current) {
      testAudioRef.current.muted = false;
      testAudioRef.current.volume = 1.0;
      testAudioRef.current.currentTime = 0;
      testAudioRef.current.play().catch(err => {
        console.error("Playback error:", err);
        setToast("Playback failed. Check browser settings.");
        setIsTestPlaying(false);
      });
      setIsTestPlaying(true);
      
      const updateProgress = () => {
        if (testAudioRef.current && !testAudioRef.current.paused) {
          const progress = (testAudioRef.current.currentTime / testAudioRef.current.duration) * 100;
          setTestAudioProgress(progress);
          requestAnimationFrame(updateProgress);
        } else {
          setTestAudioProgress(0);
        }
      };
      updateProgress();
    }
  };

  const stopTestAudio = () => {
    if (testAudioRef.current) {
      testAudioRef.current.pause();
      testAudioRef.current.currentTime = 0;
      setIsTestPlaying(false);
    }
  };

  // ... (rest of the participants and simulation logic)

  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: 'Dr. Sarah Chen', role: 'teacher', isMuted: false, isCameraOff: false, isSharingScreen: false, isHandRaised: false },
    { id: '2', name: 'Marcus Aurelius', role: 'student', isMuted: true, isCameraOff: false, isSharingScreen: false, isHandRaised: false },
    { id: '3', name: 'Elena Rodriguez', role: 'student', isMuted: false, isCameraOff: true, isSharingScreen: false, isHandRaised: true },
    { id: '4', name: 'Kenji Sato', role: 'student', isMuted: true, isCameraOff: false, isSharingScreen: false, isHandRaised: false },
    { id: '5', name: 'Aria Montgomery', role: 'student', isMuted: false, isCameraOff: false, isSharingScreen: false, isHandRaised: false },
    { id: '6', name: 'Liam Wilson', role: 'student', isMuted: true, isCameraOff: false, isSharingScreen: false, isHandRaised: false },
  ]);

  const localParticipant: Participant = {
    id: 'local',
    name: userName,
    role: 'student',
    isMuted,
    isCameraOff,
    isSharingScreen: isSharing,
    isHandRaised
  };

  // Real-time Transcription using Web Speech API
  useEffect(() => {
    if (!isJoined || isMuted) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let currentTranscriptId = '';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      if (!text.trim()) return;

      const newId = currentTranscriptId || Date.now().toString();
      if (!currentTranscriptId) {
        currentTranscriptId = newId;
      }

      setTranscription(prev => {
        const newEntry: TranscriptionEntry = {
          id: newId,
          speakerName: userName,
          text: text,
          timestamp: Date.now()
        };

        const existingIndex = prev.findIndex(entry => entry.id === newId);
        if (existingIndex >= 0) {
          const newPrev = [...prev];
          newPrev[existingIndex] = newEntry;
          return newPrev;
        } else {
          return [...prev, newEntry];
        }
      });

      if (finalTranscript) {
        currentTranscriptId = ''; // Reset for next sentence
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start speech recognition", e);
    }

    return () => {
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [isJoined, isMuted, userName]);

  const handleToggleAudio = (id: string) => {
    if (id === 'local') {
      setIsMuted(!isMuted);
    } else {
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, isMuted: !p.isMuted } : p));
    }
  };

  const handleToggleVideo = (id: string) => {
    if (id === 'local') {
      setIsCameraOff(!isCameraOff);
    } else {
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, isCameraOff: !p.isCameraOff } : p));
    }
  };

  const handleToggleShare = (id: string) => {
    if (id === 'local') {
      toggleScreenShare();
    } else {
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, isSharingScreen: !p.isSharingScreen } : p));
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: 'local',
      senderName: localParticipant.name,
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    if (activeSidebar === 'ai') {
      setIsAiThinking(true);
      try {
        const context = transcription.map(t => `${t.speakerName}: ${t.text}`).join('\n');
        const aiResponse = await askAIAssistant(inputText, context);
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          senderId: 'ai',
          senderName: 'Auralis AI',
          text: aiResponse || "I'm sorry, I couldn't process that.",
          timestamp: Date.now(),
          isAI: true
        };
        setMessages(prev => [...prev, aiMsg]);
      } catch (error) {
        console.error("AI Error:", error);
      } finally {
        setIsAiThinking(false);
      }
    }
  };

  const generateSummary = async () => {
    setIsAiThinking(true);
    setActiveSidebar('summary');
    try {
      const transcript = transcription.map(t => `${t.speakerName}: ${t.text}`).join('\n');
      const summary = await getTranscriptionSummary(transcript);
      setAiSummary(summary || "No summary available.");
    } catch (error) {
      console.error("Summary Error:", error);
    } finally {
      setIsAiThinking(false);
    }
  };

  const toggleHand = () => {
    setIsHandRaised(!isHandRaised);
    if (!isHandRaised) {
      handleReaction('Celebrate');
      setToast("You raised your hand");
    } else {
      setToast("You lowered your hand");
    }
  };

  const handleReaction = (type: string) => {
    const colors = {
      'Like': ['#0ea5e9', '#ffffff'],
      'Love': ['#ef4444', '#ffffff'],
      'Celebrate': ['#f59e0b', '#10b981', '#ffffff'],
      'Laugh': ['#facc15', '#ffffff'],
      'Clap': ['#fb923c', '#ffffff'],
    }[type] || ['#ffffff'];

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.7 },
      colors,
      zIndex: 9999
    });
  };

  const handleInvite = () => {
    try {
      const url = window.location.href;
      // Fallback for clipboard copy in iframe
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        alert("Meeting link copied to clipboard!");
      } catch (err) {
        navigator.clipboard.writeText(url).then(() => {
          alert("Meeting link copied to clipboard!");
        });
      }
      document.body.removeChild(textArea);
    } catch (error) {
      console.error("Invite error:", error);
    }
  };

  const handleSettings = () => {
    setActiveSidebar('settings');
  };

  const resumeAudio = async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const handleJoin = async () => {
    await resumeAudio();
    setIsJoined(true);
  };

  if (!isJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] light:bg-[#f8fafc] p-6 transition-colors duration-500">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center mb-6 shadow-2xl shadow-brand-500/40">
                <Sparkles className="text-white" size={24} />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white light:text-slate-900">
                Ready to join <span className="text-brand-500 italic font-serif">Auralis</span>?
              </h1>
              <p className="text-white/40 light:text-slate-500 text-lg">Check your audio and video before entering the classroom.</p>
            </div>

            <div className="space-y-4">
              {devices.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 light:text-slate-500">Microphone</label>
                    <select 
                      value={selectedAudioInput}
                      onChange={(e) => setSelectedAudioInput(e.target.value)}
                      className="w-full bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-xl py-3 px-4 text-sm text-white light:text-slate-900 focus:outline-none focus:border-brand-500/50 transition-all appearance-none"
                    >
                      {devices.filter(d => d.kind === 'audioinput').map(d => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900 text-white">{d.label || `Microphone ${d.deviceId.slice(0, 5)}...`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 light:text-slate-500">Camera</label>
                    <select 
                      value={selectedVideoInput}
                      onChange={(e) => setSelectedVideoInput(e.target.value)}
                      className="w-full bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-xl py-3 px-4 text-sm text-white light:text-slate-900 focus:outline-none focus:border-brand-500/50 transition-all appearance-none"
                    >
                      {devices.filter(d => d.kind === 'videoinput').map(d => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900 text-white">{d.label || `Camera ${d.deviceId.slice(0, 5)}...`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 light:text-slate-500">Audio Quality</label>
                    <select 
                      value={audioQuality}
                      onChange={(e) => setAudioQuality(e.target.value as 'standard' | 'high-fidelity')}
                      className="w-full bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-xl py-3 px-4 text-sm text-white light:text-slate-900 focus:outline-none focus:border-brand-500/50 transition-all appearance-none"
                    >
                      <option value="standard" className="bg-zinc-900 text-white">Standard (Voice Optimized - Noise Cancellation On)</option>
                      <option value="high-fidelity" className="bg-zinc-900 text-white">High Fidelity (Music/Instruments - Processing Off)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 light:text-slate-500">Your Name</label>
                <input 
                  type="text" 
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name" 
                  className="w-full bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 rounded-2xl py-4 px-6 text-white light:text-slate-900 focus:outline-none focus:border-brand-500/50 transition-all"
                />
              </div>
              
              <button 
                onClick={handleJoin}
                className="w-full py-5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-2xl shadow-[0_20px_40px_rgba(14,165,233,0.3)] transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group"
              >
                <span>Join Meeting</span>
                <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
              </button>

              <p className="text-xs text-center text-white/40 light:text-slate-500 mt-4">
                All Ndovera accounts can join meetings. One at a time.
              </p>
            </div>
          </div>

          <div className="relative aspect-video rounded-3xl overflow-hidden bg-zinc-900 border border-white/5 shadow-2xl">
            {!localStream && !isCameraOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 backdrop-blur-sm z-10 p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                  <VideoOff className="text-red-500" size={32} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Permissions Required</h3>
                <p className="text-white/60 text-sm mb-6 max-w-xs">We need access to your camera and microphone to start the meeting.</p>
                <button 
                  onClick={startMedia}
                  className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-all"
                >
                  Request Permissions
                </button>
              </div>
            )}
            {isCameraOff ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                <div className="w-24 h-24 rounded-full bg-zinc-700 flex items-center justify-center text-3xl font-bold text-white/20">
                  {userName.charAt(0)}
                </div>
              </div>
            ) : (
              <video 
                ref={lobbyVideoRef}
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover"
              />
            )}
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-6 w-full px-6">
              {!isMuted && (
                <div className="flex flex-col items-center gap-2 w-full max-w-[200px]">
                  <div className="flex justify-between w-full text-micro opacity-100 text-brand-500">
                    <span>Input Level</span>
                    <span>{Math.round(lobbyAudioLevel)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <motion.div 
                      className="h-full bg-brand-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"
                      animate={{ width: `${lobbyAudioLevel}%` }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  className={cn(
                    "p-5 rounded-2xl transition-all border backdrop-blur-md",
                    isMuted 
                      ? "bg-red-500/20 border-red-500/50 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]" 
                      : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                  )}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <button 
                  onClick={() => setIsCameraOff(!isCameraOff)}
                  aria-label={isCameraOff ? "Start Video" : "Stop Video"}
                  className={cn(
                    "p-5 rounded-2xl transition-all border backdrop-blur-md",
                    isCameraOff 
                      ? "bg-red-500/20 border-red-500/50 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]" 
                      : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                  )}
                >
                  {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
                </button>

                <div className="h-14 w-[1px] bg-white/10 mx-2" />

                {!testAudioUrl ? (
                  <button 
                    onClick={isTestRecording ? stopTestRecording : startTestRecording}
                    className={cn(
                      "flex items-center gap-3 px-6 rounded-2xl transition-all border backdrop-blur-md font-bold text-xs uppercase tracking-widest",
                      isTestRecording 
                        ? "bg-red-500/20 border-red-500/50 text-red-500 animate-pulse" 
                        : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                    )}
                  >
                    {isTestRecording ? <Square size={18} /> : <CircleDot size={18} />}
                    <span>{isTestRecording ? "Stop Test" : "Mic Check"}</span>
                  </button>
                ) : (
                  <button 
                    onClick={isTestPlaying ? stopTestAudio : playTestAudio}
                    className={cn(
                      "flex items-center gap-3 px-6 rounded-2xl transition-all border backdrop-blur-md font-bold text-xs uppercase tracking-widest relative overflow-hidden",
                      isTestPlaying 
                        ? "bg-brand-500/20 border-brand-500/50 text-brand-500" 
                        : "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
                    )}
                  >
                    {isTestPlaying && (
                      <div 
                        className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-100"
                        style={{ width: `${testAudioProgress}%` }}
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-3">
                      {isTestPlaying ? <Square size={18} /> : <Play size={18} />}
                      <span>{isTestPlaying ? "Playing..." : "Hear Test"}</span>
                    </div>
                  </button>
                )}
                
                {testAudioUrl && !isTestPlaying && (
                  <button 
                    onClick={() => setTestAudioUrl(null)}
                    className="p-5 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all"
                    title="Clear test"
                  >
                    <Trash2 size={20} />
                  </button>
                )}

                <button 
                  onClick={playSampleAudio}
                  className="flex items-center gap-3 px-6 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all font-bold text-xs uppercase tracking-widest"
                  title="Test Speakers"
                >
                  <Volume2 size={18} />
                  <span>Test Sound</span>
                </button>
              </div>
              <audio 
                ref={testAudioRef} 
                src={testAudioUrl || undefined} 
                onEnded={() => {
                  setIsTestPlaying(false);
                  setTestAudioProgress(0);
                }}
                muted={false}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#050505] light:bg-[#f8fafc] overflow-hidden font-sans transition-colors duration-300">
      {/* --- Mobile Top Navigation --- */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 light:border-slate-200 bg-black/20 light:bg-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/40">
            <Sparkles className="text-white" size={16} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-white to-white/40 light:from-slate-900 light:to-slate-500 bg-clip-text text-transparent">
              Auralis
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-white/40 light:text-slate-500">
              <span className={cn(sessionTime <= 3600 && "text-brand-500 font-bold")}>{formatTime(sessionTime)}</span>
              <button 
                onClick={() => setShowExtendModal(true)}
                className="px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-500 hover:bg-brand-500 hover:text-white transition-colors uppercase tracking-widest text-[8px] font-bold"
              >
                Extend
              </button>
              {isRecording && <span className="text-red-500 font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> REC</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <IconButton icon={LayoutGrid} onClick={() => { setActiveSidebar(null); setFocusedId(null); }} active={!activeSidebar && !focusedId} className="p-2" />
          <IconButton icon={Users} onClick={() => setActiveSidebar(activeSidebar === 'participants' ? null : 'participants')} active={activeSidebar === 'participants'} className="p-2" />
          <IconButton icon={MessageSquare} onClick={() => setActiveSidebar(activeSidebar === 'chat' ? null : 'chat')} active={activeSidebar === 'chat'} className="p-2" />
          <IconButton icon={Edit3} onClick={() => setActiveSidebar(activeSidebar === 'notes' ? null : 'notes')} active={activeSidebar === 'notes'} className="p-2" />
          <IconButton icon={PenTool} onClick={() => setActiveSidebar(activeSidebar === 'whiteboard' ? null : 'whiteboard')} active={activeSidebar === 'whiteboard'} className="p-2" />
          <IconButton icon={BarChart3} onClick={() => setActiveSidebar(activeSidebar === 'polls' ? null : 'polls')} active={activeSidebar === 'polls'} className="p-2" />
          <IconButton icon={BrainCircuit} onClick={() => setActiveSidebar(activeSidebar === 'ai' ? null : 'ai')} active={activeSidebar === 'ai'} className="p-2" />
          <IconButton icon={FileText} onClick={generateSummary} active={activeSidebar === 'summary'} className="p-2" />
          <IconButton icon={Settings} onClick={handleSettings} active={activeSidebar === 'settings'} className="p-2" />
        </div>
      </div>

      {/* --- Left Sidebar (Navigation) - Desktop --- */}
      <div className="hidden md:flex w-20 flex-col items-center py-8 border-r border-white/5 light:border-slate-200 bg-black/20 light:bg-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center mb-12 shadow-2xl shadow-brand-500/40">
          <Sparkles className="text-white" size={24} />
        </div>
        
        <div className="flex flex-col gap-6 flex-1">
          <IconButton icon={LayoutGrid} onClick={() => { setActiveSidebar(null); setFocusedId(null); }} active={!activeSidebar && !focusedId} label="Meeting" />
          <IconButton icon={Users} onClick={() => setActiveSidebar(activeSidebar === 'participants' ? null : 'participants')} active={activeSidebar === 'participants'} label="Participants" />
          <IconButton icon={MessageSquare} onClick={() => setActiveSidebar(activeSidebar === 'chat' ? null : 'chat')} active={activeSidebar === 'chat'} label="Chat" />
          <IconButton icon={Edit3} onClick={() => setActiveSidebar(activeSidebar === 'notes' ? null : 'notes')} active={activeSidebar === 'notes'} label="Notes" />
          <IconButton icon={PenTool} onClick={() => setActiveSidebar(activeSidebar === 'whiteboard' ? null : 'whiteboard')} active={activeSidebar === 'whiteboard'} label="Whiteboard" />
          <IconButton icon={BarChart3} onClick={() => setActiveSidebar(activeSidebar === 'polls' ? null : 'polls')} active={activeSidebar === 'polls'} label="Polls" />
          <IconButton icon={BrainCircuit} onClick={() => setActiveSidebar(activeSidebar === 'ai' ? null : 'ai')} active={activeSidebar === 'ai'} label="AI Tutor" />
          <IconButton icon={FileText} onClick={generateSummary} active={activeSidebar === 'summary'} label="Summary" />
        </div>

        <IconButton icon={Settings} onClick={handleSettings} active={activeSidebar === 'settings'} label="Settings" />
      </div>

      {/* --- Main Stage --- */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="hidden md:flex h-20 items-center justify-between px-8 border-b border-white/5 light:border-slate-200">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 light:from-slate-900 light:to-slate-500 bg-clip-text text-transparent">
              Auralis <span className="text-brand-500 font-serif italic ml-1">Classroom</span>
            </h1>

            <button
              onClick={handleToggleRecording}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border",
                isRecording 
                  ? "bg-red-500/20 border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]" 
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <CircleDot size={14} className={cn(isRecording && "animate-pulse")} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {isRecording ? "Stop Rec" : "Record"}
              </span>
            </button>

            <div className="h-4 w-[1px] bg-white/10 light:bg-slate-200" />
            <div className="flex items-center gap-2 text-xs text-white/40 light:text-slate-400 font-medium">
              <Clock size={14} />
              <span className={cn(sessionTime <= 3600 && "text-brand-500 font-bold")}>
                Session: {formatTime(sessionTime)}
              </span>
              <button 
                onClick={() => setShowExtendModal(true)}
                className="ml-2 px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 hover:bg-brand-500 hover:text-white transition-colors uppercase tracking-widest text-[10px] font-bold"
              >
                Extend
              </button>
              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 uppercase tracking-widest text-[10px]">Live</span>
              {isRecording && (
                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 uppercase tracking-widest text-[10px] flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Recording
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white/5 light:bg-slate-200 rounded-xl p-1 mr-4">
              <button 
                onClick={() => setLayout('grid')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  layout === 'grid' ? "bg-brand-500 text-white shadow-lg" : "text-white/40 hover:text-white"
                )}
                title="Grid View"
              >
                <Grid size={16} />
              </button>
              <button 
                onClick={() => setLayout('list')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  layout === 'list' ? "bg-brand-500 text-white shadow-lg" : "text-white/40 hover:text-white"
                )}
                title="List View"
              >
                <List size={16} />
              </button>
              <button 
                onClick={() => setLayout('stacked')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  layout === 'stacked' ? "bg-brand-500 text-white shadow-lg" : "text-white/40 hover:text-white"
                )}
                title="Speaker View"
              >
                <Layers size={16} />
              </button>
            </div>

            <div className="flex -space-x-2">
              {participants.slice(0, 3).map(p => (
                <div key={p.id} className="w-8 h-8 rounded-full border-2 border-[#050505] light:border-[#f8fafc] bg-zinc-800 light:bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                  {p.name.charAt(0)}
                </div>
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-[#050505] light:border-[#f8fafc] bg-brand-500 flex items-center justify-center text-[10px] font-bold">
                +{participants.length - 3}
              </div>
            </div>
            <button 
              onClick={handleInvite}
              className="px-4 py-2 rounded-xl glass text-xs font-semibold hover:bg-white/10 light:hover:bg-slate-100 transition-colors"
            >
              Invite
            </button>
          </div>
        </header>

        {/* Video Grid */}
        <main className="flex-1 overflow-y-auto">
          <VideoGrid 
            participants={participants} 
            localParticipant={localParticipant} 
            localVideoRef={localVideoRef} 
            localStream={activeStream}
            focusedId={focusedId}
            onFocus={setFocusedId}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            onToggleShare={handleToggleShare}
            layout={layout}
          />
        </main>

        {/* Bottom Controls */}
        <div className="overflow-x-auto no-scrollbar border-t border-white/5 light:border-slate-200 bg-black/40 backdrop-blur-xl light:bg-white/90">
          <div className="min-w-max">
            <MeetingControls 
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              isCameraOff={isCameraOff}
              setIsCameraOff={setIsCameraOff}
              isSharing={isSharing}
              setIsSharing={toggleScreenShare}
              isHandRaised={isHandRaised}
              toggleHand={toggleHand}
              isRecording={isRecording}
              toggleRecording={handleToggleRecording}
              onLeave={() => window.location.reload()}
              theme={theme}
              toggleTheme={toggleTheme}
              onReaction={handleReaction}
              onSettings={handleSettings}
              onInvite={handleInvite}
              setToast={setToast}
            />
          </div>
        </div>

        {/* Floating Transcription */}
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 pointer-events-none flex flex-col items-center gap-4">
          {/* Toast Notification */}
          {toast && (
            <div className="glass-dark px-6 py-3 rounded-full shadow-2xl text-center animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center gap-3">
              <Sparkles size={16} className="text-brand-500" />
              <span className="text-sm font-medium text-white">{toast}</span>
            </div>
          )}

          {transcription.slice(-1).map(entry => (
            <div
              key={entry.id}
              className="glass-dark px-6 py-3 rounded-2xl shadow-2xl text-center animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <span className="text-brand-500 font-bold text-xs uppercase tracking-widest mr-2">{entry.speakerName}:</span>
              <span className="text-sm text-white/90 light:text-slate-900">{entry.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* --- Right Sidebar (Panels) --- */}
      <Sidebar 
        activeSidebar={activeSidebar}
        setActiveSidebar={setActiveSidebar}
        messages={messages}
        participants={participants}
        localParticipant={localParticipant}
        inputText={inputText}
        setInputText={setInputText}
        handleSendMessage={handleSendMessage}
        isAiThinking={isAiThinking}
        aiSummary={aiSummary}
        transcription={transcription}
        sharedNotes={sharedNotes}
        setSharedNotes={setSharedNotes}
        theme={theme}
        toggleTheme={toggleTheme}
        userName={userName}
        setUserName={setUserName}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        isCameraOff={isCameraOff}
        setIsCameraOff={setIsCameraOff}
        devices={devices}
        selectedAudioInput={selectedAudioInput}
        setSelectedAudioInput={setSelectedAudioInput}
        selectedVideoInput={selectedVideoInput}
        setSelectedVideoInput={setSelectedVideoInput}
        audioQuality={audioQuality}
        setAudioQuality={setAudioQuality}
      />

      {/* --- Extend Time Modal --- */}
      <AnimatePresence>
        {showExtendModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-white">Extend Session</h2>
                <button onClick={() => setShowExtendModal(false)} className="text-white/40 hover:text-white">
                  <Trash2 size={20} className="hidden" /> {/* Placeholder for close icon, using text instead */}
                  <span className="text-xs font-bold uppercase tracking-widest">Close</span>
                </button>
              </div>
              <p className="text-white/60 text-sm mb-6">
                Your meeting time is running out. Extend your session to keep the conversation going.
              </p>
              
              <div className="space-y-3 mb-6">
                <button 
                  onClick={() => {
                    setSessionTime(prev => prev + 3600);
                    setShowExtendModal(false);
                    setToast("Session extended by 1 hour");
                  }} 
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-white/10 hover:border-brand-500 hover:bg-brand-500/10 transition-all group"
                >
                  <span className="text-white font-medium group-hover:text-brand-500 transition-colors">+1 Hour</span>
                  <span className="text-brand-500 font-bold bg-brand-500/10 px-3 py-1 rounded-lg">12,000</span>
                </button>
                <button 
                  onClick={() => {
                    setSessionTime(prev => prev + 7200);
                    setShowExtendModal(false);
                    setToast("Session extended by 2 hours");
                  }} 
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-white/10 hover:border-brand-500 hover:bg-brand-500/10 transition-all group"
                >
                  <span className="text-white font-medium group-hover:text-brand-500 transition-colors">+2 Hours</span>
                  <span className="text-brand-500 font-bold bg-brand-500/10 px-3 py-1 rounded-lg">24,000</span>
                </button>
              </div>
              
              <div className="text-center">
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Secure Payment Processing</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
