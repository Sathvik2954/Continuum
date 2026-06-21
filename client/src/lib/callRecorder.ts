/**
 * Records the local audio stream during a live call.
 * Separate from useAudioRecorder (Phase 3) because this attaches to an
 * EXISTING MediaStream from getUserMedia(), rather than requesting one itself.
 */
export class CallRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recording = false;

  start(stream: MediaStream): void {
    // Record audio only — strip video tracks to keep file size manageable
    const audioOnlyStream = new MediaStream(stream.getAudioTracks());

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : '';

    this.mediaRecorder = new MediaRecorder(
      audioOnlyStream,
      mimeType ? { mimeType } : undefined
    );
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.start(1000); // collect in 1s chunks, safer against mid-call crashes
    this.recording = true;
  }

  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.recording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        this.recording = false;
        resolve(blob.size > 0 ? blob : null);
      };

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.recording;
  }
}
