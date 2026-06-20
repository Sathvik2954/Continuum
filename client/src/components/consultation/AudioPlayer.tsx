import React, { useRef, useState } from 'react';

interface Props {
  src: string;
  label: string;
}

export const AudioPlayer: React.FC<Props> = ({ src, label }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setProgress(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleEnded = () => setPlaying(false);

  const formatTime = (s: number): string => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <div className="glass-subtle rounded-md p-3">
      <div className="text-[11px] font-medium text-sky-600 uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(14,165,233,0.75)', border: '0.5px solid rgba(255,255,255,0.45)' }}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="flex-1">
          <div className="w-full h-1.5 rounded-full bg-[rgba(14,165,233,0.15)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{ width: `${pct}%`, background: '#38BDF8' }}
            />
          </div>
        </div>

        <span className="text-[11px] font-mono text-[#78716C] flex-shrink-0">
          {formatTime(progress)} / {formatTime(duration)}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden"
      />
    </div>
  );
};

const PlayIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#FEF9F0">
    <polygon points="6,4 20,12 6,20" />
  </svg>
);

const PauseIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#FEF9F0">
    <rect x="5" y="4" width="5" height="16" />
    <rect x="14" y="4" width="5" height="16" />
  </svg>
);
