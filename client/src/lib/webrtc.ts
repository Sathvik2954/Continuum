import getSocket from './socket';

interface WebRTCOptions {
  callId: string;
  userId: string;
  role: 'PATIENT' | 'DOCTOR';
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

export class WebRTCConnection {
  private pc: RTCPeerConnection | null = null;
  private socket = getSocket();
  private localStream: MediaStream | null = null;
  private callId: string;
  private userId: string;
  private role: string;

  constructor(private options: WebRTCOptions) {
    this.callId = options.callId;
    this.userId = options.userId;
    this.role = options.role;
  }

  // Get ICE Servers list based on environments with stun fallback
  private getIceServers() {
    const servers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
    ];

    const turnUrl = import.meta.env.VITE_TURN_URL;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME;
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

    if (turnUrl) {
      servers.push({
        urls: turnUrl,
        username: turnUsername || '',
        credential: turnCredential || '',
      });
    }

    return servers;
  }

  // Start peer connection & acquire local media
  async start() {
    // 1. Capture local camera/microphone
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (videoError) {
      console.warn('Failed to capture video, attempting audio-only fallback:', videoError);
      // Audio-only fallback if camera is absent or blocked
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
    }

    this.options.onLocalStream(this.localStream);

    // 2. Initialize RTCPeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: this.getIceServers(),
    });

    // Handle connection state callbacks
    this.pc.onconnectionstatechange = () => {
      if (this.options.onConnectionStateChange && this.pc) {
        this.options.onConnectionStateChange(this.pc.connectionState);
      }
    };

    // Attach local media tracks to Peer Connection
    this.localStream.getTracks().forEach((track) => {
      if (this.pc && this.localStream) {
        this.pc.addTrack(track, this.localStream);
      }
    });

    // Handle incoming remote media stream tracks
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.options.onRemoteStream(event.streams[0]);
      }
    };

    // Handle candidate generation and relay
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice_candidate', {
          callId: this.callId,
          candidate: event.candidate,
        });
      }
    };

    // 3. Connect to signaling socket and join call room
    this.socket.connect();
    this.socket.emit('join_room', {
      callId: this.callId,
      userId: this.userId,
      role: this.role,
    });

    // 4. Setup signaling room event listeners
    this.setupSignalingListeners();
  }

  private setupSignalingListeners() {
    // When a peer joins, the peer already in the room initiates the offer
    this.socket.on('peer_joined', async () => {
      console.log('Peer joined, creating WebRTC SDP offer...');
      if (!this.pc) return;
      try {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.socket.emit('sdp_offer', {
          callId: this.callId,
          sdp: offer,
        });
      } catch (err) {
        console.error('Failed to create local SDP offer:', err);
      }
    });

    // Handle incoming SDP Offer (callee flow)
    this.socket.on('sdp_offer', async ({ sdp }) => {
      console.log('SDP offer received, setting remote & creating answer...');
      if (!this.pc) return;
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.socket.emit('sdp_answer', {
          callId: this.callId,
          sdp: answer,
        });
      } catch (err) {
        console.error('Failed to respond to SDP offer:', err);
      }
    });

    // Handle incoming SDP Answer (caller flow)
    this.socket.on('sdp_answer', async ({ sdp }) => {
      console.log('SDP answer received, setting remote description...');
      if (!this.pc) return;
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error('Failed to set remote SDP answer:', err);
      }
    });

    // Handle incoming ICE candidate
    this.socket.on('ice_candidate', async ({ candidate }) => {
      if (!this.pc) return;
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Failed to add remote ICE candidate:', err);
      }
    });
  }

  // Mute/Unmute microphone
  toggleMute(mute: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !mute;
      });
    }
  }

  // Stop/Start camera stream
  toggleCamera(stop: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !stop;
      });
    }
  }

  // Tear down connections and release media resources
  hangup() {
    // Emit call_ended
    this.socket.emit('call_ended', { callId: this.callId });

    // Clean up local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }

    // Close PeerConnection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    // Disconnect socket listeners
    this.socket.off('peer_joined');
    this.socket.off('sdp_offer');
    this.socket.off('sdp_answer');
    this.socket.off('ice_candidate');
    this.socket.disconnect();
  }
}

export default WebRTCConnection;
