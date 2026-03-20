import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, LoaderCircle, Mic, Square, Video } from 'lucide-react';

export type ClassroomMediaRecorderMode = 'audio' | 'video';

export type ClassroomMediaChunk = {
  chunk: Blob;
  fileName: string;
  index: number;
  mimeType: string;
  sessionId: string;
  startedAt: number;
  type: ClassroomMediaRecorderMode;
};

export type ClassroomMediaCapture = {
  chunks: Blob[];
  durationSeconds: number;
  file: File;
  sessionId: string;
  type: ClassroomMediaRecorderMode;
};

type ClassroomMediaRecorderProps = {
  buttonVariant?: 'default' | 'bare';
  compact?: boolean;
  controlsBefore?: ReactNode;
  disabled?: boolean;
  onCaptureComplete: (capture: ClassroomMediaCapture) => Promise<void> | void;
  onComplete?: (capture: ClassroomMediaCapture) => Promise<void> | void;
  onChunk?: (chunk: ClassroomMediaChunk) => Promise<void> | void;
  onError?: (message: string | null) => void;
  showWaveform?: boolean;
};

const INITIAL_WAVE_BARS = Array.from({ length: 28 }, () => 0.25);

function buildWaveformBars(count: number) {
  const heights = [0.45, 0.72, 0.38, 0.86, 0.58, 0.9, 0.42, 0.68, 0.54, 0.8, 0.5, 0.74];
  return Array.from({ length: count }, (_, index) => heights[index % heights.length]);
}

function getAdaptiveMediaProfile(type: ClassroomMediaRecorderMode) {
  const connection = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection
    : undefined;
  const effectiveType = connection?.effectiveType || '4g';
  const saveData = Boolean(connection?.saveData);

  if (type === 'audio') {
    return {
      audioBitsPerSecond: saveData || effectiveType === '2g' ? 48_000 : 64_000,
    };
  }

  if (saveData || effectiveType === '2g') {
    return {
      audioBitsPerSecond: 48_000,
      height: 360,
      videoBitsPerSecond: 600_000,
      width: 640,
    };
  }

  if (effectiveType === '3g') {
    return {
      audioBitsPerSecond: 64_000,
      height: 540,
      videoBitsPerSecond: 900_000,
      width: 960,
    };
  }

  return {
    audioBitsPerSecond: 64_000,
    height: 720,
    videoBitsPerSecond: 1_200_000,
    width: 1280,
  };
}

async function getMediaStream(type: ClassroomMediaRecorderMode) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Media devices are not supported in this browser.');
  }

  const profile = getAdaptiveMediaProfile(type);
  return navigator.mediaDevices.getUserMedia({
    video: type === 'video'
      ? {
          width: { ideal: profile.width },
          height: { ideal: profile.height },
          facingMode: 'user',
        }
      : false,
    audio: {
      autoGainControl: true,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
}

function getRecorderMimeType(type: ClassroomMediaRecorderMode) {
  const mediaElement = document.createElement(type === 'audio' ? 'audio' : 'video');
  const canPreviewMimeType = (mimeType: string) => mediaElement.canPlayType(mimeType.split(';')[0]) !== '';
  const options = type === 'audio'
    ? ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
    : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm'];
  return options.find((option) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(option) && canPreviewMimeType(option));
}

function buildRecorderOptions(type: ClassroomMediaRecorderMode, mimeType?: string) {
  const profile = getAdaptiveMediaProfile(type);
  if (type === 'audio') {
    return mimeType ? { audioBitsPerSecond: profile.audioBitsPerSecond, mimeType } : { audioBitsPerSecond: profile.audioBitsPerSecond };
  }
  return mimeType
    ? { audioBitsPerSecond: profile.audioBitsPerSecond, mimeType, videoBitsPerSecond: profile.videoBitsPerSecond }
    : { audioBitsPerSecond: profile.audioBitsPerSecond, videoBitsPerSecond: profile.videoBitsPerSecond };
}

function getRecordedExtension(mimeType: string | undefined, type: ClassroomMediaRecorderMode) {
  const normalized = mimeType?.split(';')[0] || '';
  if (normalized === 'audio/mp4' || normalized === 'video/mp4') return 'mp4';
  if (normalized === 'audio/ogg' || normalized === 'video/ogg') return 'ogg';
  return type === 'audio' || type === 'video' ? 'webm' : 'bin';
}

export function ClassroomMediaRecorder({ buttonVariant = 'default', compact = false, controlsBefore, disabled = false, onCaptureComplete, onComplete, onChunk, onError, showWaveform = true }: ClassroomMediaRecorderProps) {
  const [recordingMode, setRecordingMode] = useState<ClassroomMediaRecorderMode | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveWaveformBars, setLiveWaveformBars] = useState<number[]>(INITIAL_WAVE_BARS);
  const [micLevel, setMicLevel] = useState(0);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);
  const chunkIndexRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const sessionIdRef = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformAnimationRef = useRef<number | null>(null);

  const createSessionId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  };

  const actionButtonClassName = buttonVariant === 'bare'
    ? 'bg-transparent text-slate-300 hover:text-white'
    : 'classroom-stream-chip text-slate-700';

  // Cleanly stop all live transport resources so preview, mic analysis, and timers never leak between sessions.
  const stopTransport = () => {
    if (waveformAnimationRef.current) {
      window.cancelAnimationFrame(waveformAnimationRef.current);
      waveformAnimationRef.current = null;
    }
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    analyserRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    if (livePreviewRef.current) livePreviewRef.current.srcObject = null;
    setLiveWaveformBars(INITIAL_WAVE_BARS);
    setMicLevel(0);
  };

  useEffect(() => {
    return () => {
      stopTransport();
    };
  }, []);

  // Audio analysis is separated from recording so monitoring never corrupts the captured file.
  const startAudioAnalysis = async (stream: MediaStream) => {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    await audioContext.resume();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const tick = () => {
      analyser.getByteFrequencyData(buffer);
      const nextBars = Array.from({ length: 28 }, (_, index) => {
        const bucketSize = Math.max(1, Math.floor(buffer.length / 28));
        const start = index * bucketSize;
        const end = Math.min(buffer.length, start + bucketSize);
        const slice = buffer.slice(start, end);
        const average = slice.length ? slice.reduce((sum, value) => sum + value, 0) / slice.length : 0;
        return Math.max(0.14, average / 255);
      });
      const overallAverage = buffer.length ? buffer.reduce((sum, value) => sum + value, 0) / buffer.length : 0;
      setMicLevel(Math.min(100, Math.round((overallAverage / 255) * 100)));
      setLiveWaveformBars(nextBars);
      waveformAnimationRef.current = window.requestAnimationFrame(tick);
    };

    tick();
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.requestData();
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
  };

  const startRecording = async (type: ClassroomMediaRecorderMode) => {
    if (disabled || isFinalizing || recordingMode) return;
    onError?.(null);

    try {
      // 1) Capture the unified stream first. Preview and recording branch from the same source.
      const stream = await getMediaStream(type);
      recordingStreamRef.current = stream;
      await startAudioAnalysis(stream);

      // 2) Preview stays separate from the recorder so the camera view appears instantly.
      if (type === 'video' && livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream;
        livePreviewRef.current.muted = true;
        livePreviewRef.current.playsInline = true;
        await livePreviewRef.current.play().catch(() => undefined);
      }

      // 3) MediaRecorder runs on the raw captured stream. Chunk events are exposed for future chunk-upload assembly.
      const mimeType = getRecorderMimeType(type);
      const recorder = new MediaRecorder(stream, buildRecorderOptions(type, mimeType));
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingSecondsRef.current = 0;
      recordingStartedAtRef.current = Date.now();
      chunkIndexRef.current = 0;
      sessionIdRef.current = createSessionId();
      setRecordingMode(type);
      setRecordingSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size <= 0) return;
        recordingChunksRef.current.push(event.data);
        const fileName = `${type}-note-${recordingStartedAtRef.current}.${getRecordedExtension(recorder.mimeType || event.data.type, type)}`;
        const payload: ClassroomMediaChunk = {
          chunk: event.data,
          fileName,
          index: chunkIndexRef.current,
          mimeType: recorder.mimeType || event.data.type || `${type}/webm`,
          sessionId: sessionIdRef.current,
          startedAt: recordingStartedAtRef.current,
          type,
        };
        chunkIndexRef.current += 1;
        void Promise.resolve(onChunk?.(payload)).catch((error) => {
          onError?.(error instanceof Error ? error.message : 'Unable to upload recording chunk.');
        });
      };

      recorder.onstop = async () => {
        const chunks = [...recordingChunksRef.current];
        const blob = new Blob(chunks, { type: recorder.mimeType || `${type}/webm` });
        const extension = getRecordedExtension(blob.type, type);
        const durationSeconds = Math.max(recordingSecondsRef.current, 1);
        const file = new File([blob], `${type}-note-${Date.now()}.${extension}`, { type: blob.type || `${type}/webm` });
        const sessionId = sessionIdRef.current;

        stopTransport();
        setRecordingMode(null);
        setRecordingSeconds(0);
        recordingChunksRef.current = [];
        sessionIdRef.current = '';

        const minimumBlobSize = type === 'audio' ? 2048 : 4096;
        if (blob.size < minimumBlobSize) {
          onError?.(type === 'audio' ? 'Voice note was too short to save. Try again.' : 'Video note was too short to save. Try again.');
          return;
        }

        try {
          setIsFinalizing(true);
          await (onCaptureComplete || onComplete)?.({ chunks, durationSeconds, file, sessionId, type });
        } catch (error) {
          onError?.(error instanceof Error ? error.message : 'Unable to finish recording.');
        } finally {
          setIsFinalizing(false);
        }
      };

      // 4) Emit one chunk every second so the component is ready for resumable uploads.
      recorder.start(1000);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => {
          const next = current >= 59 ? 60 : current + 1;
          recordingSecondsRef.current = next;
          if (next >= 60) {
            mediaRecorderRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch (error) {
      stopTransport();
      setRecordingMode(null);
      setRecordingSeconds(0);
      onError?.(error instanceof Error ? error.message : `Unable to start ${type} recording.`);
    }
  };

  const videoCountdownProgress = Math.min(recordingSeconds / 60, 1);
  const countdownRadius = 18;
  const countdownCircumference = 2 * Math.PI * countdownRadius;
  const countdownOffset = countdownCircumference * (1 - videoCountdownProgress);

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {recordingMode === 'video' ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-slate-950/85 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-white">
            <span className="inline-flex items-center gap-2">
              <Camera className="h-4 w-4 text-rose-400" />
              Recording short video • {recordingSeconds}s / 60s
            </span>
            <div className="flex items-center gap-3">
              <div className="classroom-stream-countdown-ring">
                <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
                  <circle cx="24" cy="24" r={countdownRadius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="4" />
                  <circle
                    cx="24"
                    cy="24"
                    r={countdownRadius}
                    fill="none"
                    stroke="url(#classroomVideoCountdownReusable)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={countdownCircumference}
                    strokeDashoffset={countdownOffset}
                  />
                  <defs>
                    <linearGradient id="classroomVideoCountdownReusable" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#fb7185" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="classroom-stream-countdown-label">{60 - Math.min(recordingSeconds, 60)}</span>
              </div>
              <button type="button" onClick={stopRecording} className="rounded-full bg-white/10 px-3 py-1.5 text-white">
                Stop recording
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full bg-slate-950/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              Live preview
            </div>
            <video ref={livePreviewRef} muted autoPlay playsInline className="max-h-64 w-full rounded-2xl object-cover" />
          </div>
        </div>
      ) : null}

      {recordingMode === 'audio' ? (
        <div className="rounded-3xl border border-sky-200/40 bg-sky-950/75 p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Recording voice note</p>
              <p className="text-xs text-sky-100/80">{recordingSeconds}s / 60s</p>
            </div>
            <button type="button" onClick={stopRecording} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
              Stop recording
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-100/80">Mic level</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-linear-to-r from-emerald-300 via-sky-300 to-cyan-200 transition-all duration-150" style={{ width: `${Math.max(micLevel, 4)}%` }} />
            </div>
            <span className="min-w-9 text-right text-xs font-semibold text-white">{micLevel}%</span>
          </div>
          {showWaveform ? (
            <div className="mt-4 classroom-stream-waveform classroom-stream-waveform-live" aria-hidden="true">
              {liveWaveformBars.map((height, index) => (
                <span
                  key={`media-recorder-wave_${index}`}
                  className="classroom-stream-wave-bar"
                  style={{ height: `${Math.round(height * 100)}%`, animationDelay: `${index * 80}ms` }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {controlsBefore}
        <button
          type="button"
          title="Record voice note"
          onClick={() => startRecording('audio')}
          disabled={disabled || recordingMode !== null || isFinalizing}
          className={`inline-flex items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonClassName} ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}
        >
          <Mic className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Record short video"
          onClick={() => startRecording('video')}
          disabled={disabled || recordingMode !== null || isFinalizing}
          className={`inline-flex items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonClassName} ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}
        >
          <Video className="h-4 w-4" />
        </button>
        {recordingMode ? (
          <button type="button" title="Stop recording" onClick={stopRecording} className={`inline-flex items-center justify-center rounded-full bg-rose-500 text-white ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}>
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {isFinalizing ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Processing capture…
          </div>
        ) : null}
      </div>

      {!recordingMode && !compact && showWaveform ? (
        <div className="classroom-stream-waveform" aria-hidden="true">
          {buildWaveformBars(18).map((height, index) => (
            <span
              key={`media-recorder-idle_${index}`}
              className="classroom-stream-wave-bar"
              style={{ height: `${Math.round(height * 100)}%`, animationDelay: `${index * 80}ms` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
