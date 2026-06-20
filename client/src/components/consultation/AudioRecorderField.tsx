import React from 'react';
import { useAudioRecorder } from '../../lib/useAudioRecorder';

interface Props {
  maxDurationSeconds: number;
  onRecordingComplete: (blob: Blob | null) => void;
  label?: string;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const AudioRecorderField: React.FC<Props> = ({
  maxDurationSeconds, onRecordingComplete, label = 'Record audio',
}) => {
  const {
    isRecording, durationSeconds, audioBlob, audioUrl, error,
    startRecording, stopRecording, resetRecording,
  } = useAudioRecorder({ maxDurationSeconds });

  const handleStart = async () => {
    await startRecording();
  };

  const handleStop = () => {
    stopRecording();
  };

  // Notify parent when blob is ready
  React.useEffect(() => {
    onRecordingComplete(audioBlob);
  }, [audioBlob, onRecordingComplete]);

  const handleReset = () => {
    resetRecording();
    onRecordingComplete(null);
  };

  const pctRemaining = (durationSeconds / maxDurationSeconds) * 100;

  return (
    <div>
      <label className="block text-[12px] font-medium text-sky-600 mb-1.5">
        {label}
        <span className="text-[#A8A29E] font-normal ml-1">
          (optional, max {Math.floor(maxDurationSeconds / 60)} min)
        </span>
      </label>

      <div className="glass-subtle rounded-md p-4">
        {error && (
          <div className="text-[12px] text-[#991B1B] mb-3">{error}</div>
        )}

        {!audioUrl ? (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={isRecording ? handleStop : handleStart}
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: isRecording ? 'rgba(239,68,68,0.85)' : 'rgba(14,165,233,0.75)',
                border: '0.5px solid rgba(255,255,255,0.45)',
              }}
            >
              {isRecording ? (
                <span className="w-3.5 h-3.5 rounded-xs bg-cream-50" />
              ) : (
                <MicIcon />
              )}
            </button>

            <div className="flex-1">
              {isRecording ? (
                <>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-urgent animate-pulse-fast" />
                    <span className="text-[13px] font-medium text-[#991B1B]">
                      Recording · {formatTime(durationSeconds)}
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[rgba(239,68,68,0.15)] overflow-hidden">
                    <div
                      className="h-full bg-urgent rounded-full transition-all duration-1000"
                      style={{ width: `${pctRemaining}%` }}
                    />
                  </div>
                </>
              ) : (
                <span className="text-[13px] text-[#78716C]">
                  Tap to record your symptoms
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <audio controls src={audioUrl} className="flex-1 h-9" style={{ maxWidth: '100%' }} />
            <button
              type="button"
              onClick={handleReset}
              className="text-[12px] text-[#78716C] px-3 py-1.5 rounded-sm glass hover:text-[#991B1B] transition-colors flex-shrink-0"
            >
              Re-record
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const MicIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FEF9F0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
  </svg>
);
