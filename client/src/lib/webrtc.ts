import { Socket } from 'socket.io-client';

interface WebRTCCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onPeerJoined: () => void;
  onPeerLeft: () => void;
  onCallEnded: () => void;
  onError: (message: string) => void;
}

/**
 * Wraps RTCPeerConnection + Socket.io signaling into a single class.
 * Handles the offer/answer/ICE dance so the UI component only needs to
 * call join(), then react to the callbacks.
 *
 * Negotiation flow:
 *  1. Both peers join_room.
 *  2. The peer who joins SECOND sends an SDP offer (we use "second joiner
 *     initiates" to avoid a glare condition where both peers offer at once).
 *  3. First peer responds with an SDP answer.
 *  4. Both exchange ICE candidates as they're discovered.
 */
export class WebRTCSession {
  private pc: RTCPeerConnection | null = null;
  private socket: Socket;
  private callId: string;
  private localStream: MediaStream | null = null;
  private callbacks: WebRTCCallbacks;
  private isInitiator = false;
  private hasReceivedPeer = false;

  constructor(socket: Socket, callId: string, callbacks: WebRTCCallbacks) {
    this.socket = socket;
    this.callId = callId;
    this.callbacks = callbacks;
  }

  async join(localStream: MediaStream, iceServers: RTCIceServer[]): Promise<void> {
    this.localStream = localStream;

    this.pc = new RTCPeerConnection({ iceServers });

    // Add local tracks to the connection
    localStream.getTracks().forEach((track) => {
      this.pc!.addTrack(track, localStream);
    });

    // Remote stream arrives here
    this.pc.ontrack = (event) => {
      this.callbacks.onRemoteStream(event.streams[0]);
    };

    // Send our ICE candidates to the peer as they're discovered
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice_candidate', { callId: this.callId, candidate: event.candidate });
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'failed') {
        this.callbacks.onError('Connection failed - this may be a network issue.');
      }
    };

    this.registerSocketListeners();

    this.socket.emit('join_room', { callId: this.callId });
  }

  private registerSocketListeners(): void {
    this.socket.on('peer_joined', async () => {
      this.hasReceivedPeer = true;
      this.callbacks.onPeerJoined();

      // The peer who is ALREADY in the room (received this event) initiates
      // the offer, since they were first. This avoids both sides offering
      // simultaneously (a "glare" condition in WebRTC).
      this.isInitiator = true;
      await this.createAndSendOffer();
    });

    this.socket.on('sdp_offer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      if (!this.pc) return;
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.socket.emit('sdp_answer', { callId: this.callId, sdp: answer });
    });

    this.socket.on('sdp_answer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      if (!this.pc) return;
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    this.socket.on('ice_candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (!this.pc) return;
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Failed to add ICE candidate:', err);
      }
    });

    this.socket.on('peer_left', () => {
      this.callbacks.onPeerLeft();
    });

    this.socket.on('call_ended', () => {
      this.callbacks.onCallEnded();
    });

    this.socket.on('error', ({ message }: { message: string }) => {
      this.callbacks.onError(message);
    });
  }

  private async createAndSendOffer(): Promise<void> {
    if (!this.pc) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.socket.emit('sdp_offer', { callId: this.callId, sdp: offer });
  }

  endCall(): void {
    this.socket.emit('call_ended', { callId: this.callId });
    this.cleanup();
  }

  cleanup(): void {
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((t) => t.stop());

    this.socket.off('peer_joined');
    this.socket.off('sdp_offer');
    this.socket.off('sdp_answer');
    this.socket.off('ice_candidate');
    this.socket.off('peer_left');
    this.socket.off('call_ended');
    this.socket.off('error');
  }

  toggleAudio(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  toggleVideo(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }
}
