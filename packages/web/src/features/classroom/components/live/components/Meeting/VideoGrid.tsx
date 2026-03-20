import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Participant } from '../../lib/utils';
import { Shield, MicOff, Mic, Video, VideoOff, MonitorUp, Hand, Wifi, Palette } from 'lucide-react';
import { cn } from '../../lib/utils';

export const VideoCard = ({ 
  participant, 
  isLocal = false, 
  videoRef,
  stream,
  isFocused = false,
  onClick,
  onToggleAudio,
  onToggleVideo,
  onToggleShare
}: { 
  participant: Participant, 
  isLocal?: boolean,
  videoRef?: React.RefObject<HTMLVideoElement | null>,
  stream?: MediaStream | null,
  isFocused?: boolean,
  onClick?: () => void,
  onToggleAudio?: () => void,
  onToggleVideo?: () => void,
  onToggleShare?: () => void
}) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [filter, setFilter] = useState<string>('none');
  const [showFilters, setShowFilters] = useState(false);

  const filters = [
    { name: 'Normal', value: 'none' },
    { name: 'Grayscale', value: 'grayscale(100%)' },
    { name: 'Sepia', value: 'sepia(100%)' },
    { name: 'Blur', value: 'blur(5px)' },
    { name: 'High Contrast', value: 'contrast(200%)' },
    { name: 'Hue Rotate', value: 'hue-rotate(90deg)' },
    { name: 'Invert', value: 'invert(100%)' }
  ];

  useEffect(() => {
    if (videoRef?.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef]);

  // Audio level visualization
  useEffect(() => {
    if (!participant.isMuted && stream) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      let animationFrame: number;
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(100, (average / 128) * 100));
        animationFrame = requestAnimationFrame(updateLevel);
      };
      updateLevel();
      
      return () => {
        cancelAnimationFrame(animationFrame);
        source.disconnect();
        audioCtx.close();
      };
    } else {
      setAudioLevel(0);
    }
  }, [participant.isMuted, stream]);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className={cn(
        "relative aspect-video rounded-3xl overflow-hidden bg-zinc-900 border border-white/5 group transition-all duration-500 cursor-pointer",
        participant.isHandRaised && "ring-2 ring-yellow-500/50 shadow-2xl shadow-yellow-500/10",
        isFocused && "ring-4 ring-brand-500 shadow-2xl shadow-brand-500/20",
        "dark:bg-zinc-900 light:bg-slate-100"
      )}
    >
      {participant.isCameraOff && !participant.isSharingScreen ? (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/50 dark:bg-zinc-800/50 light:bg-slate-200/50">
          <div className="w-24 h-24 rounded-full bg-zinc-700/50 dark:bg-zinc-700/50 light:bg-slate-300/50 flex items-center justify-center text-3xl font-bold text-white/20 dark:text-white/20 light:text-slate-900/20 border border-white/5">
            {participant.name.charAt(0)}
          </div>
        </div>
      ) : participant.isSharingScreen && !isLocal ? (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <div className="flex flex-col items-center gap-4 text-white/50">
            <MonitorUp size={48} />
            <span className="text-sm font-medium">{participant.name} is sharing their screen</span>
          </div>
        </div>
      ) : (
        <video 
          ref={videoRef}
          autoPlay 
          muted={isLocal} 
          playsInline 
          className={cn("w-full h-full object-cover transition-all duration-300", participant.isSharingScreen && "object-contain bg-black")}
          style={{ filter: filter }}
        />
      )}
      
      <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full glass-dark">
        <span className="text-xs font-medium">{participant.name} {isLocal && "(You)"}</span>
        {participant.isMuted && <MicOff size={12} className="text-red-500" />}
        {participant.role === 'teacher' && <Shield size={12} className="text-brand-500" />}
        
        {!participant.isMuted && (
          <div className="flex items-end gap-0.5 h-3 ml-1">
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                className="audio-bar" 
                style={{ height: `${Math.max(20, audioLevel * (0.5 + Math.random() * 0.5))}%` }} 
              />
            ))}
          </div>
        )}
      </div>

      <div className="absolute top-4 left-4 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md">
        <Wifi size={12} className={cn(
          "transition-colors",
          isLocal ? "text-green-400" : "text-green-400/80"
        )} />
      </div>

      {participant.isHandRaised && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute top-4 right-4 p-2 rounded-full bg-yellow-500 text-black shadow-xl"
        >
          <Hand size={16} fill="currentColor" />
        </motion.div>
      )}

      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleAudio?.(); }}
            className={cn(
              "p-3 rounded-full transition-colors",
              participant.isMuted ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/30 backdrop-blur-md"
            )}
          >
            {participant.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleVideo?.(); }}
            className={cn(
              "p-3 rounded-full transition-colors",
              participant.isCameraOff ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/30 backdrop-blur-md"
            )}
          >
            {participant.isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleShare?.(); }}
            className={cn(
              "p-3 rounded-full transition-colors",
              participant.isSharingScreen ? "bg-brand-500 text-white" : "bg-white/20 text-white hover:bg-white/30 backdrop-blur-md"
            )}
          >
            <MonitorUp size={20} />
          </button>
          
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowFilters(!showFilters); }}
              className="p-3 rounded-full transition-colors bg-white/20 text-white hover:bg-white/30 backdrop-blur-md"
              title="Filters"
            >
              <Palette size={20} />
            </button>
            
            <AnimatePresence>
              {showFilters && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 rounded-xl p-2 shadow-xl w-32 z-50 pointer-events-auto"
                >
                  {filters.map(f => (
                    <button
                      key={f.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilter(f.value);
                        setShowFilters(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs rounded-lg transition-colors",
                        filter === f.value ? "bg-brand-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {f.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {videoRef?.current && document.pictureInPictureEnabled && (
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (document.pictureInPictureElement) {
                  document.exitPictureInPicture();
                } else if (videoRef.current) {
                  videoRef.current.requestPictureInPicture();
                }
              }}
              className="p-3 rounded-full transition-colors bg-white/20 text-white hover:bg-white/30 backdrop-blur-md"
              title="Picture-in-Picture"
            >
              <MonitorUp size={20} className="rotate-180" />
            </button>
          )}
        </div>
        {!isFocused && <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 pointer-events-none">Click to focus</span>}
      </div>
    </motion.div>
  );
};

export const VideoGrid = ({ 
  participants, 
  localParticipant,
  localVideoRef,
  localStream,
  focusedId,
  onFocus,
  onToggleAudio,
  onToggleVideo,
  onToggleShare,
  layout = 'grid'
}: { 
  participants: Participant[], 
  localParticipant: Participant,
  localVideoRef: React.RefObject<HTMLVideoElement | null>,
  localStream: MediaStream | null,
  focusedId: string | null,
  onFocus: (id: string | null) => void,
  onToggleAudio?: (id: string) => void,
  onToggleVideo?: (id: string) => void,
  onToggleShare?: (id: string) => void,
  layout?: 'grid' | 'list' | 'stacked'
}) => {
  const allParticipants = [localParticipant, ...participants];
  const focusedParticipant = allParticipants.find(p => p.id === focusedId) || (focusedId === 'local' ? localParticipant : null);

  if (layout === 'stacked' && focusedId) {
    const others = allParticipants.filter(p => p.id !== focusedId);
    return (
      <div className="flex flex-col h-full w-full p-4 md:p-6 gap-4 overflow-hidden">
        <div className="flex-1 min-h-0">
          <VideoCard 
            participant={focusedParticipant!} 
            isLocal={focusedId === 'local'} 
            videoRef={focusedId === 'local' ? localVideoRef : undefined} 
            stream={focusedId === 'local' ? localStream : null}
            isFocused={true}
            onClick={() => onFocus(null)}
            onToggleAudio={() => onToggleAudio?.(focusedId)}
            onToggleVideo={() => onToggleVideo?.(focusedId)}
            onToggleShare={() => onToggleShare?.(focusedId)}
          />
        </div>
        <div className="h-32 md:h-40 flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {others.map(p => (
            <div key={p.id} className="w-48 md:w-64 shrink-0">
              <VideoCard 
                participant={p} 
                isLocal={p.id === 'local'}
                videoRef={p.id === 'local' ? localVideoRef : undefined}
                stream={p.id === 'local' ? localStream : null}
                isFocused={false}
                onClick={() => onFocus(p.id)} 
                onToggleAudio={() => onToggleAudio?.(p.id)}
                onToggleVideo={() => onToggleVideo?.(p.id)}
                onToggleShare={() => onToggleShare?.(p.id)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "max-w-7xl mx-auto p-4 md:p-6 pb-24 md:pb-32 transition-all duration-500",
      layout === 'grid' && "video-grid",
      layout === 'list' && "flex flex-col gap-6 max-w-2xl",
      layout === 'stacked' && "video-grid" // Fallback if no focus
    )}>
      <VideoCard 
        participant={localParticipant} 
        isLocal 
        videoRef={localVideoRef} 
        stream={localStream}
        isFocused={focusedId === 'local'}
        onClick={() => onFocus(focusedId === 'local' ? null : 'local')}
        onToggleAudio={() => onToggleAudio?.('local')}
        onToggleVideo={() => onToggleVideo?.('local')}
        onToggleShare={() => onToggleShare?.('local')}
      />
      {participants.map(p => (
        <VideoCard 
          key={p.id} 
          participant={p} 
          isFocused={focusedId === p.id}
          onClick={() => onFocus(focusedId === p.id ? null : p.id)} 
          onToggleAudio={() => onToggleAudio?.(p.id)}
          onToggleVideo={() => onToggleVideo?.(p.id)}
          onToggleShare={() => onToggleShare?.(p.id)}
        />
      ))}
    </div>
  );
};
