import { Smile, Send, Mic, Video, Trash2, Paperclip, Play, Pause, Square } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';

interface InputAreaProps {
  text: string;
  onChange: (text: string) => void;
  onPost: (text: string) => void;
  onPostMedia: (type: 'audio' | 'video' | 'image' | 'file', url: string, name?: string) => void;
  onOpenEmoji: () => void;
}

export function InputArea({ text, onChange, onPost, onPostMedia, onOpenEmoji }: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [recordingType, setRecordingType] = useState<'audio' | 'video' | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ type: 'audio' | 'video', url: string } | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const isPausedRef = useRef(false);
  const sendImmediatelyRef = useRef(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && !recordingType && !previewMedia) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 80)}px`;
    }
  }, [text, recordingType, previewMedia]);

  // Attach stream to video preview when recording video
  useEffect(() => {
    if (recordingType === 'video' && videoPreviewRef.current && streamRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current;
    }
  }, [recordingType]);

  const handleSubmit = () => {
    if (text.trim()) {
      onPost(text);
      onChange('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check size (500MB = 500 * 1024 * 1024)
    if (file.size > 500 * 1024 * 1024) {
      setError("File too large (Max 500MB)");
      return;
    }
    
    setError(null);
    const url = URL.createObjectURL(file);
    let type: 'image' | 'video' | 'audio' | 'file' = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';
    
    onPostMedia(type, url, file.name);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async (type: 'audio' | 'video') => {
    setError(null);
    setIsPaused(false);
    isPausedRef.current = false;
    sendImmediatelyRef.current = false;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 2 },
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: false } // Disabling noise suppression often makes audio much sharper
        },
        video: type === 'video' ? { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } : false
      });
      
      streamRef.current = stream;

      let options: MediaRecorderOptions = {
        audioBitsPerSecond: 128000, // 128 kbps for clearer, sharper audio
      };
      let selectedMimeType = '';
      
      if (type === 'video') {
        options.videoBitsPerSecond = 2500000; // 2.5 Mbps for high quality video
        // Prioritize mp4 for better iOS/Safari compatibility with audio tracks
        const types = [
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm'
        ];
        for (const t of types) {
          if (MediaRecorder.isTypeSupported(t)) {
            selectedMimeType = t;
            break;
          }
        }
      } else {
        const types = [
          'audio/mp4',
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mpeg'
        ];
        for (const t of types) {
          if (MediaRecorder.isTypeSupported(t)) {
            selectedMimeType = t;
            break;
          }
        }
      }

      if (selectedMimeType) {
        options.mimeType = selectedMimeType;
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Use the chunk's actual type if available, to ensure perfect match
          const firstChunk = chunksRef.current[0];
          const chunkType = firstChunk instanceof Blob ? firstChunk.type : undefined;
        const finalMimeType = chunkType || recorder.mimeType || selectedMimeType || (type === 'video' ? 'video/mp4' : 'audio/mp4');
        const blob = new Blob(chunksRef.current, { type: finalMimeType });
        
        // Check size (500MB = 500 * 1024 * 1024)
        if (blob.size > 500 * 1024 * 1024) {
           setError("File too large (Max 500MB)");
        } else if (chunksRef.current.length > 0) {
           const url = URL.createObjectURL(blob);
           const ext = finalMimeType.includes('mp4') ? 'mp4' : 'webm';
           if (sendImmediatelyRef.current) {
             onPostMedia(type, url, `recorded_${type}_${Date.now()}.${ext}`);
           } else {
             setPreviewMedia({ type, url });
           }
        }
        
        // Cleanup stream
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setRecordingType(null);
        setRecordingTime(0);
        setIsPaused(false);
        isPausedRef.current = false;
        sendImmediatelyRef.current = false;
      };

      recorder.start(1000); // collect data every second
      setRecordingType(type);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (isPausedRef.current) return prev;
          if (prev >= 179) { // 3 minutes = 180 seconds
            stopRecording();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Error accessing media devices", err);
      setError("Microphone/Camera access denied");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      isPausedRef.current = true;
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      isPausedRef.current = false;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const sendRecordingImmediately = () => {
    sendImmediatelyRef.current = true;
    stopRecording();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // prevent onstop from posting
      mediaRecorderRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setRecordingType(null);
        setRecordingTime(0);
        setIsPaused(false);
        isPausedRef.current = false;
        sendImmediatelyRef.current = false;
      };
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  if (previewMedia) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3">
        <div className="max-w-5xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">Preview {previewMedia.type}</span>
            <button onClick={() => setPreviewMedia(null)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="flex justify-center bg-slate-50 dark:bg-slate-900 rounded-xl p-2 border border-slate-200 dark:border-slate-800">
            {previewMedia.type === 'video' ? (
              <video src={previewMedia.url} controls playsInline className="max-h-48 rounded-lg" />
            ) : (
              <audio src={previewMedia.url} controls className="w-full max-w-md" />
            )}
          </div>
          <div className="flex justify-end mt-1">
            <button 
              onClick={() => {
                onPostMedia(previewMedia.type, previewMedia.url, `recorded_${previewMedia.type}_${Date.now()}.${previewMedia.type === 'video' ? 'webm' : 'webm'}`);
                setPreviewMedia(null);
              }} 
              className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full transition-all flex items-center gap-2 text-xs font-medium"
            >
              Send <Send size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (recordingType) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3">
        <div className="max-w-5xl mx-auto flex flex-col gap-2">
          {recordingType === 'video' && (
            <div className="flex justify-center bg-slate-900 rounded-xl overflow-hidden relative border border-slate-200 dark:border-slate-800">
              <video ref={videoPreviewRef} autoPlay muted playsInline className="max-h-64 w-auto object-contain" />
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-white text-xs flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full bg-rose-500 ${isPaused ? '' : 'animate-pulse'}`} />
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </div>
            </div>
          )}
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex-1 flex items-center gap-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl py-2 px-3 sm:px-4">
              {recordingType === 'audio' && <div className={`w-2 h-2 rounded-full bg-rose-500 ${isPaused ? '' : 'animate-pulse'}`} />}
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {recordingType === 'audio' 
                  ? `${isPaused ? 'Paused' : 'Recording Audio...'} ${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')} / 3:00`
                  : `${isPaused ? 'Paused' : 'Recording Video...'} (Max 3:00)`}
              </span>
            </div>
            
            {isPaused ? (
              <button onClick={resumeRecording} className="p-2 text-slate-400 hover:text-emerald-500 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Resume">
                <Play size={16} />
              </button>
            ) : (
              <button onClick={pauseRecording} className="p-2 text-slate-400 hover:text-amber-500 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Pause">
                <Pause size={16} />
              </button>
            )}
            
            <button onClick={stopRecording} className="p-2 text-slate-400 hover:text-indigo-500 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Stop & Preview">
              <Square size={16} />
            </button>
            
            <button onClick={cancelRecording} className="p-2 text-slate-400 hover:text-rose-500 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Cancel">
              <Trash2 size={16} />
            </button>
            
            <button onClick={sendRecordingImmediately} className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full transition-all flex items-center justify-center ml-1" title="Send Immediately">
              <Send size={14} className="translate-x-0.5 -translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3">
      {error && (
        <div className="max-w-5xl mx-auto mb-2 px-2 flex justify-between items-center">
          <span className="text-[10px] text-rose-500 font-medium">{error}</span>
          <button onClick={() => setError(null)} className="text-[10px] text-slate-400 hover:text-slate-600">Dismiss</button>
        </div>
      )}
      <div className="max-w-5xl mx-auto flex items-end gap-1.5">
        <div className="flex items-center gap-0.5 mb-0.5">
          <button
            onClick={onOpenEmoji}
            className="p-2 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            title="Emojis"
          >
            <Smile size={16} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            title="Attach File (Max 500MB)"
          >
            <Paperclip size={16} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
          />
          <button
            onClick={() => startRecording('audio')}
            className="p-2 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            title="Record Audio (Max 3m)"
          >
            <Mic size={16} />
          </button>
          <button
            onClick={() => startRecording('video')}
            className="p-2 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            title="Record Video (Max 3m)"
          >
            <Video size={16} />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-2 px-3 text-[10px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none ml-1"
          placeholder="Message..."
          rows={1}
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="p-2 mb-0.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-full transition-all shrink-0 ml-0.5"
        >
          <Send size={14} className={text.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''} />
        </button>
      </div>
    </div>
  );
}
