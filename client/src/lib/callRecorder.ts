export class CallRecorder {
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  // Start recording the combined channels of local and remote streams
  start(localStream: MediaStream, remoteStream: MediaStream) {
    this.chunks = [];
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      // Create destination to output mixed audio stream
      const destination = this.audioContext.createMediaStreamDestination();
      
      // Map local microphone tracks to context source
      if (localStream.getAudioTracks().length > 0) {
        const localSource = this.audioContext.createMediaStreamSource(
          new MediaStream([localStream.getAudioTracks()[0]])
        );
        localSource.connect(destination);
      }
      
      // Map remote audio tracks to context source
      if (remoteStream.getAudioTracks().length > 0) {
        const remoteSource = this.audioContext.createMediaStreamSource(
          new MediaStream([remoteStream.getAudioTracks()[0]])
        );
        remoteSource.connect(destination);
      }
      
      // Setup browser recorder options
      let options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/webm' };
      }
      
      this.mediaRecorder = new MediaRecorder(destination.stream, options);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };
      
      this.mediaRecorder.start(1000); // buffer chunks every second
      console.log('Live WebRTC audio mixing recorder initialized.');
    } catch (err) {
      console.error('Failed to initialize Web Audio mixer:', err);
    }
  }

  // Stop recording and consolidate chunks into a single WebM blob
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('Audio recorder was not initialized.'));
      }
      
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        
        // Clean up audio context
        if (this.audioContext) {
          this.audioContext.close();
          this.audioContext = null;
        }
        
        resolve(blob);
      };
      
      this.mediaRecorder.stop();
    });
  }
}

export default CallRecorder;
