import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, MicOff, Video, VideoOff, MonitorUp, Hand, 
  PhoneOff, Sparkles, MoreVertical, Sun, Moon,
  Smile, Heart, ThumbsUp, PartyPopper, Clapperboard,
  MoreHorizontal, Share2, Clipboard, Settings2, Users,
  CircleDot
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface IconButtonProps {
  icon: any;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  label?: string;
  className?: string;
}

export const IconButton = ({ 
  icon: Icon, 
  onClick, 
  active = false, 
  danger = false, 
  label,
  className 
}: IconButtonProps) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={cn(
      "relative group flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 shrink-0",
      active ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
      danger && "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white",
      className
    )}
  >
    <Icon size={20} />
    {label && (
      <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {label}
      </span>
    )}
  </button>
);

export const MeetingControls = ({
  isMuted,
  setIsMuted,
  isCameraOff,
  setIsCameraOff,
  isSharing,
  setIsSharing,
  isHandRaised,
  toggleHand,
  isRecording,
  toggleRecording,
  onLeave,
  theme,
  toggleTheme,
  onReaction,
  onSettings,
  onInvite,
  setToast
}: any) => {
  const [showReactions, setShowReactions] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const reactions = [
    { icon: ThumbsUp, label: 'Like' },
    { icon: Heart, label: 'Love' },
    { icon: PartyPopper, label: 'Celebrate' },
    { icon: Smile, label: 'Laugh' },
    { icon: Clapperboard, label: 'Clap' },
  ];

  return (
    <div className="h-20 md:h-24 flex items-center justify-start md:justify-center gap-2 md:gap-4 px-4 md:px-8 overflow-x-auto no-scrollbar w-full">
      <IconButton 
        icon={theme === 'dark' ? Sun : Moon} 
        onClick={toggleTheme}
        label={theme === 'dark' ? "Light Mode" : "Dark Mode"}
      />
      <div className="h-8 w-px bg-white/10 mx-2 light:bg-slate-200 shrink-0" />
      
      <IconButton 
        icon={isMuted ? MicOff : Mic} 
        onClick={() => setIsMuted(!isMuted)} 
        active={!isMuted} 
        danger={isMuted}
        label={isMuted ? "Unmute" : "Mute"}
      />
      <IconButton 
        icon={isCameraOff ? VideoOff : Video} 
        onClick={() => setIsCameraOff(!isCameraOff)} 
        active={!isCameraOff} 
        danger={isCameraOff}
        label={isCameraOff ? "Start Video" : "Stop Video"}
      />
      <IconButton 
        icon={MonitorUp} 
        onClick={() => setIsSharing(!isSharing)} 
        active={isSharing}
        label="Share Screen"
      />
      
      <div className="h-8 w-px bg-white/10 mx-2 light:bg-slate-200 shrink-0" />
      
      <IconButton 
        icon={Hand} 
        onClick={toggleHand} 
        active={isHandRaised}
        label="Raise Hand"
      />

      <IconButton 
        icon={CircleDot} 
        onClick={toggleRecording} 
        active={isRecording}
        danger={isRecording}
        label={isRecording ? "Stop Recording" : "Record Meeting"}
      />

      {/* Reactions Dropdown */}
      <div className="relative">
        <IconButton 
          icon={Smile} 
          onClick={() => setShowReactions(!showReactions)} 
          active={showReactions}
          label="Reactions" 
        />
        <AnimatePresence>
          {showReactions && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex gap-2 p-2 glass-dark rounded-2xl z-50"
            >
              {reactions.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onReaction(r.label);
                    setShowReactions(false);
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white"
                >
                  <r.icon size={20} />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* More Menu Dropdown */}
      <div className="relative">
        <IconButton 
          icon={MoreHorizontal} 
          onClick={() => setShowMore(!showMore)} 
          active={showMore}
          label="More Options" 
        />
        <AnimatePresence>
          {showMore && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-48 glass-dark rounded-2xl overflow-hidden flex flex-col z-50"
            >
              <button onClick={() => { onSettings(); setShowMore(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-sm font-medium text-white/80 hover:text-white transition-colors">
                <Settings2 size={16} />
                Settings
              </button>
              <button onClick={() => { setToast("Visual Effects coming soon!"); setShowMore(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-sm font-medium text-white/80 hover:text-white transition-colors">
                <Sparkles size={16} />
                Visual Effects
              </button>
              <button onClick={() => { setToast("Breakout Rooms coming soon!"); setShowMore(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-sm font-medium text-white/80 hover:text-white transition-colors">
                <Users size={16} />
                Breakout Rooms
              </button>
              <button onClick={() => { onInvite(); setShowMore(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-sm font-medium text-white/80 hover:text-white transition-colors">
                <Share2 size={16} />
                Invite Others
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-8 w-px bg-white/10 mx-2 light:bg-slate-200 shrink-0" />
      
      <button 
        onClick={onLeave}
        aria-label="Leave meeting"
        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 shrink-0"
      >
        <PhoneOff size={18} />
        <span className="text-sm">Leave</span>
      </button>
    </div>
  );
};
