import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { getSocket, disconnectSocket } from '../../lib/socket';
import { WebRTCSession } from '../../lib/webrtc';
import { CallRecorder } from '../../lib/callRecorder';
import { queueItem } from '../../lib/syncEngine';
import { GlassCard } from '../../components/ui/GlassCard';

type RoomState = 'idle' | 'requesting_media' | 'waiting_for_peer' | 'connected' | 'ended' | 'error';

export const CallRoomPage: React.FC = () => {
  const { id: callId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPatient = user?.role === 'PATIENT';

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<WebRTCSession | null>(null);
  const recorderRef = useRef<CallRecorder | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const stateRef = useRef<RoomState>('idle');

  const [state, setState] = useState<RoomState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [uploadingRecording, setUploadingRecording] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Duration timer once connected
  useEffect(() => {
    if (state !== 'connected') return;
    if (!startTimeRef.current) startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current!) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  const joinCall = useCallback(async () => {
    if (!callId) return;
    setState('requesting_media');
    setErrorMsg('');

    try {
      // 1. Get local media
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      // Recording is patient-only (spec FR-34) — avoids duplicate recordings
      // from both participants and keeps storage cost predictable.
      if (isPatient) {
        recorderRef.current = new CallRecorder();
        recorderRef.current.start(localStream);
      }

      // 2. Fetch ICE config (STUN + TURN)
      const iceRes = await api.get(`/calls/${callId}/ice-config`);
      const iceServers: RTCIceServer[] = iceRes.data.iceServers;

      // 3. Connect socket + WebRTC session
      const socket = getSocket();
      const session = new WebRTCSession(socket, callId, {
        onRemoteStream: (stream) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
          setState('connected');
        },
        onPeerJoined: () => setState('connected'),
        onPeerLeft: () => {
          setErrorMsg('The other participant left the call.');
        },
        onCallEnded: async () => {
          setState('ended');
          const blobPromise = recorderRef.current?.stop() || Promise.resolve(null);
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
          }
          cleanup();

          setUploadingRecording(true);
          try {
            const blob = await blobPromise;
            if (blob && callId) {
              const formData = new FormData();
              formData.append('recording', blob, 'call-recording.webm');
              if (navigator.onLine) {
                await api.post(`/calls/${callId}/recording`, formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
              } else {
                const base64 = await blobToBase64(blob);
                await queueItem('call_recording', { callId, recordingBase64: base64 });
              }
            }
          } catch (err) {
            console.error('Recording upload failed:', err);
          } finally {
            setUploadingRecording(false);
          }
        },
        onError: (message) => {
          setErrorMsg(message);
          setState('error');
        },
      });

      sessionRef.current = session;
      await session.join(localStream, iceServers);
      setState('waiting_for_peer');
    } catch (err) {
      console.error('Failed to join call:', err);
      setErrorMsg('Could not access camera/microphone, or connection failed.');
      setState('error');
    }
  }, [callId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    sessionRef.current?.cleanup();
    sessionRef.current = null;
    disconnectSocket();
  };

  const saveRecordingOnUnmount = async () => {
    if (isPatient && recorderRef.current && recorderRef.current.isRecording()) {
      const blob = await recorderRef.current.stop();
      if (blob && callId) {
        const formData = new FormData();
        formData.append('recording', blob, 'call-recording.webm');
        try {
          if (navigator.onLine) {
            await api.post(`/calls/${callId}/recording`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } else {
            const base64 = await blobToBase64(blob);
            await queueItem('call_recording', { callId, recordingBase64: base64 });
          }
        } catch (err) {
          console.error('Recording upload failed on unmount:', err);
        }
      }
    }
  };

  useEffect(() => {
    return () => {
      if (stateRef.current !== 'ended' && stateRef.current !== 'idle' && stateRef.current !== 'error') {
        saveRecordingOnUnmount();
      }
      cleanup();
    };
  }, [callId]);

  const handleEndCall = async () => {
    setState('ended');
    const blobPromise = recorderRef.current?.stop() || Promise.resolve(null);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    sessionRef.current?.endCall();
    cleanup();

    setUploadingRecording(true);
    try {
      const blob = await blobPromise;
      if (blob && callId) {
        const formData = new FormData();
        formData.append('recording', blob, 'call-recording.webm');
        if (navigator.onLine) {
          await api.post(`/calls/${callId}/recording`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } else {
          const base64 = await blobToBase64(blob);
          await queueItem('call_recording', { callId, recordingBase64: base64 });
        }
      }
    } catch (err) {
      console.error('Recording upload failed:', err);
    } finally {
      setUploadingRecording(false);
    }
  };

  const handleToggleMute = () => {
    sessionRef.current?.toggleAudio(muted); // muted=true means we're currently muted, so pass `muted` to re-enable
    setMuted(!muted);
  };

  const handleToggleVideo = () => {
    sessionRef.current?.toggleVideo(videoOff);
    setVideoOff(!videoOff);
  };

  const formatDuration = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  if (state === 'idle') {
    return (
      <div className="max-w-md mx-auto px-6 pt-16 text-center">
        <GlassCard className="p-8">
          <div className="text-[16px] font-medium text-sky-900 mb-2">Ready to join your call?</div>
          <p className="text-[13px] text-[#78716C] mb-6">
            We'll need access to your camera and microphone. Make sure the other person is also ready to join.
          </p>
          <button
            onClick={joinCall}
            className="w-full h-11 rounded-sm text-[14px] font-medium text-cream-50"
            style={{ background: 'rgba(14,165,233,0.75)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.45)' }}
          >
            Join call
          </button>
        </GlassCard>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="max-w-md mx-auto px-6 pt-16 text-center">
        <GlassCard className="p-8">
          <div className="text-[16px] font-medium text-[#991B1B] mb-2">Something went wrong</div>
          <p className="text-[13px] text-[#78716C] mb-6">{errorMsg}</p>
          <button onClick={() => navigate('/dashboard')} className="text-[13px] text-sky-600">
            ← Back to dashboard
          </button>
        </GlassCard>
      </div>
    );
  }

  if (state === 'ended') {
    return (
      <div className="max-w-md mx-auto px-6 pt-16 text-center">
        <GlassCard className="p-8">
          <div className="text-[16px] font-medium text-sky-900 mb-2">Call ended</div>
          <p className="text-[13px] text-[#78716C] mb-2">
            Duration: {formatDuration(duration)}
          </p>
          {isPatient && (
            <p className="text-[12px] text-sky-600 mb-6">
              {uploadingRecording ? 'Saving recording to your timeline…' : '✓ Recording saved to your health timeline'}
            </p>
          )}
          <button onClick={() => navigate('/dashboard')}
            className="w-full h-11 rounded-sm text-[14px] font-medium text-cream-50"
            style={{ background: 'rgba(14,165,233,0.75)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.45)' }}>
            Return to dashboard
          </button>
        </GlassCard>
      </div>
    );
  }

  // requesting_media | waiting_for_peer | connected
  return (
    <div className="fixed inset-0 z-50" style={{ background: 'linear-gradient(135deg, #FEF9F0 0%, #BAE8FF 100%)' }}>
      {/* Top bar */}
      <div className="glass-navbar h-14 flex items-center justify-between px-5">
        <div className="flex items-center gap-2">
          {state === 'connected' ? (
            <span className="pill" style={{ background: 'rgba(6,182,212,0.18)', borderColor: 'rgba(6,182,212,0.45)', color: '#0E7490' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-live-DEFAULT animate-pulse-slow" />
              LIVE
            </span>
          ) : (
            <span className="text-[13px] text-[#78716C]">Connecting…</span>
          )}
        </div>
        {state === 'connected' && (
          <span className="text-[13px] font-mono text-[#78716C]">{formatDuration(duration)}</span>
        )}
      </div>

      {/* Video area */}
      <div className="relative w-full" style={{ height: 'calc(100vh - 56px - 64px)' }}>
        {/* Remote video — main */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          style={{ background: '#0C4A6E' }}
        />

        {state === 'waiting_for_peer' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="glass-elevated rounded-xl px-6 py-4 text-center">
              <div className="text-[14px] font-medium text-sky-900">Waiting for the other person to join…</div>
            </div>
          </div>
        )}

        {/* Local video — picture-in-picture */}
        <div className="absolute top-4 right-4 w-[140px] h-[105px] rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.60)' }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ background: '#0C4A6E' }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="glass-elevated h-16 flex items-center justify-center gap-4">
        <button
          onClick={handleToggleMute}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            background: muted ? 'rgba(239,68,68,0.20)' : 'rgba(255,255,255,0.20)',
            border: '0.5px solid rgba(255,255,255,0.45)',
          }}
        >
          {muted ? '🔇' : '🎙'}
        </button>
        <button
          onClick={handleToggleVideo}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            background: videoOff ? 'rgba(239,68,68,0.20)' : 'rgba(255,255,255,0.20)',
            border: '0.5px solid rgba(255,255,255,0.45)',
          }}
        >
          {videoOff ? '📷' : '🎥'}
        </button>
        <button
          onClick={handleEndCall}
          className="w-14 h-11 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.85)', border: '0.5px solid rgba(255,255,255,0.45)' }}
        >
          📞
        </button>
      </div>
    </div>
  );
};
