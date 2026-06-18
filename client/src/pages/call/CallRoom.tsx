import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, ShieldAlert, CheckCircle, Clock } from 'lucide-react';
import apiClient from '../../lib/apiClient';
import db from '../../lib/offlineDB';
import syncEngine from '../../lib/syncEngine';
import WebRTCConnection from '../../lib/webrtc';
import CallRecorder from '../../lib/callRecorder';

export const CallRoom = () => {
  const { id } = useParams(); // consultationId of the call
  const navigate = useNavigate();

  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [callDetails, setCallDetails] = useState<any>(null);
  
  // Media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoStopped, setIsVideoStopped] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [callEnded, setCallEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const rtcConnectionRef = useRef<WebRTCConnection | null>(null);
  const callRecorderRef = useRef<CallRecorder | null>(null);

  const loadSession = () => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setLoggedUser(JSON.parse(stored));
    } else {
      navigate('/login');
    }
  };

  const loadCallDetails = async () => {
    try {
      const res = await apiClient.get(`/consultations/${id}`);
      setCallDetails(res.data.consultation);
    } catch (err: any) {
      console.error('Failed to load call room info:', err);
      setError('Access forbidden. You are not authorized to join this call room.');
    }
  };

  useEffect(() => {
    loadSession();
    loadCallDetails();
  }, [id]);

  useEffect(() => {
    if (!loggedUser || !callDetails) return;

    // 1. Initialize WebRTC connection
    const connection = new WebRTCConnection({
      callId: id!,
      userId: loggedUser.id,
      role: loggedUser.role,
      onLocalStream: (stream) => {
        setLocalStream(stream);
      },
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        
        // Patients record call audio locally
        if (loggedUser.role === 'PATIENT') {
          if (!callRecorderRef.current) {
            callRecorderRef.current = new CallRecorder();
          }
          // Start mixed audio recording once remote stream is acquired
          if (rtcConnectionRef.current) {
            // Get local stream from ref as state update might be async
            const local = rtcConnectionRef.current['localStream'];
            if (local) {
              callRecorderRef.current.start(local, stream);
            }
          }
        }
      },
      onConnectionStateChange: (state) => {
        setConnectionState(state);
        if (state === 'connected') {
          // Update call status to ACTIVE on the server
          apiClient.patch(`/calls/${callDetails._id}/status`, { status: 'ACTIVE' }).catch(console.error);
        } else if (state === 'disconnected' || state === 'failed') {
          setCallEnded(true);
        }
      },
    });

    rtcConnectionRef.current = connection;
    connection.start().catch((err) => {
      console.error('WebRTC initialization failed:', err);
      setError('Could not access camera/microphone media devices.');
    });

    // Handle incoming hangup event from signaling server
    const socket = connection['socket'];
    socket.on('call_ended', () => {
      console.log('Remote peer hung up, closing call room.');
      setCallEnded(true);
    });

    return () => {
      if (rtcConnectionRef.current) {
        rtcConnectionRef.current.hangup();
      }
    };
  }, [loggedUser, callDetails]);

  // Bind streams to HTML video elements
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle Controls Toggles
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.toggleMute(nextMuted);
    }
  };

  const handleToggleVideo = () => {
    const nextVideoStop = !isVideoStopped;
    setIsVideoStopped(nextVideoStop);
    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.toggleCamera(nextVideoStop);
    }
  };

  const handleHangup = async () => {
    setCallEnded(true);
    
    // Stop WebRTC tracks
    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.hangup();
    }

    // Update status to ENDED
    if (callDetails) {
      await apiClient.patch(`/calls/${callDetails._id}/status`, { status: 'ENDED' }).catch(console.error);
    }

    // Save Patient audio recording to background sync queue
    if (loggedUser?.role === 'PATIENT' && callRecorderRef.current) {
      try {
        const audioBlob = await callRecorderRef.current.stop();
        const syncId = id!; // Use consultation ID as sync queue key

        // Save blob in Dexie blobs
        await db.blobs.put({ id: syncId, type: 'audio', blob: audioBlob });
        
        // Write sync queue record for call recording upload
        await db.sync_queue.put({
          id: syncId,
          type: 'call_recording',
          data: {
            id: syncId,
            callRecordingUrl: '',
            updatedAt: new Date().toISOString()
          },
          blobField: 'callRecordingUrl',
          syncStatus: 'pending',
          retryCount: 0,
          createdAt: Date.now()
        });

        // Trigger sync flush immediately
        syncEngine.triggerSync();
        console.log('Call audio recording queued for sync.');
      } catch (err) {
        console.error('Failed to consolidate call recording:', err);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-6 text-center">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-2">
        <Link
          to="/"
          className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold font-sans text-slate-100">Live Consultation Room</h1>
      </div>

      {error ? (
        <div className="glass-panel border-rose-500/20 bg-rose-500/5 rounded-2xl p-10 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-200">Connection Blocked</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">{error}</p>
          <Link
            to="/"
            className="inline-block px-5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 rounded-lg"
          >
            Go Back
          </Link>
        </div>
      ) : callEnded ? (
        <div className="glass-panel border-emerald-500/20 bg-slate-900/60 rounded-2xl p-12 text-center space-y-4 max-w-md mx-auto animate-fade-in">
          <CheckCircle className="w-12 h-12 text-primary-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-100">Consultation Session Completed</h3>
          <p className="text-xs text-slate-400">
            {loggedUser?.role === 'PATIENT'
              ? 'The live consultation call has ended. Your combined session audio recording is synchronizing in the background.'
              : 'The live consultation call has ended. You can review the patient clinical history dossiers in the dashboard.'}
          </p>
          <Link
            to="/"
            className="inline-block px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-xs font-bold text-dark-950 rounded-lg transition-all"
          >
            Return to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border border-slate-850 rounded-xl max-w-xl mx-auto text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${
                connectionState === 'connected' ? 'bg-primary-500 animate-pulse' : 'bg-amber-500 animate-ping'
              }`} />
              <span className="capitalize">Status: {connectionState}</span>
            </div>
            
            {loggedUser?.role === 'PATIENT' && (
              <div className="flex items-center space-x-1.5 text-primary-500 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Recording Audio Session</span>
              </div>
            )}
          </div>

          {/* Video Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-stretch">
            
            {/* Remote Video Container (Spans 3 cols on desktop) */}
            <div className="md:col-span-3 bg-slate-950/80 border border-slate-800 rounded-2xl relative overflow-hidden h-[450px] shadow-lg flex items-center justify-center">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-2xl"
              />
              
              {!remoteStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-500 space-y-3">
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-full animate-pulse">
                    <VideoIcon className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-xs">Waiting for peer connection to establish...</p>
                </div>
              )}

              {/* Float Local Video (Miniature Overlay) */}
              {localStream && (
                <div className="absolute top-4 right-4 w-32 h-44 bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-2xl z-20">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {isVideoStopped && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 text-[10px] text-slate-500">
                      Camera Off
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Side Information Panel */}
            <div className="md:col-span-1 glass-panel border-slate-800 p-5 rounded-2xl flex flex-col justify-between text-left space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-bold font-sans text-slate-200 uppercase tracking-wider border-b border-slate-850 pb-2">
                  Session Info
                </h3>
                <div className="space-y-1 text-xs">
                  <span className="text-slate-500 block">Room ID:</span>
                  <span className="text-slate-350 block font-mono font-semibold truncate" title={id}>{id}</span>
                </div>
                {callDetails && (
                  <div className="space-y-2 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-slate-500 block">Consultation Type:</span>
                      <span className="text-slate-200 font-semibold block">{callDetails.type}</span>
                    </div>
                    <div className="space-y-0.5 pt-1">
                      <span className="text-slate-500 block">Initiated By:</span>
                      <span className="text-slate-200 font-semibold block capitalize">{callDetails.initiatedBy?.toLowerCase()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Call Control Buttons Panel */}
              <div className="flex flex-row md:flex-col justify-center gap-3 pt-4 border-t border-slate-850">
                <button
                  onClick={handleToggleMute}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex justify-center items-center flex-1 md:flex-none ${
                    isMuted
                      ? 'bg-rose-500/20 border-rose-500/35 text-rose-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  onClick={handleToggleVideo}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex justify-center items-center flex-1 md:flex-none ${
                    isVideoStopped
                      ? 'bg-rose-500/20 border-rose-500/35 text-rose-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title={isVideoStopped ? 'Start Video' : 'Stop Video'}
                >
                  {isVideoStopped ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
                </button>

                <button
                  onClick={handleHangup}
                  className="p-3 bg-rose-500 hover:bg-rose-600 border border-rose-600 text-slate-100 rounded-xl transition-all cursor-pointer flex justify-center items-center flex-1 md:flex-none"
                  title="Hang Up"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallRoom;
