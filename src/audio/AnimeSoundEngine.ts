// src/audio/AnimeSoundEngine.ts

export class AnimeSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isStarted: boolean = false;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Background loops
  private musicTimer: number | null = null;
  private chimeTimer: number | null = null;
  private windSource: AudioNode | null = null;

  // Makoto Shinkai inspired peaceful progression (pentatonic notes in Hz)
  // Sparkle / Your Name nostalgic chords: D major / B minor emotion
  private pianoChords = [
    [293.66, 369.99, 440.00, 587.33], // D - F# - A - D
    [220.00, 329.63, 440.00, 554.37], // A - E - A - C#
    [246.94, 293.66, 369.99, 440.00], // Bm7 (B - D - F# - A)
    [196.00, 293.66, 392.00, 493.88], // Gmaj7 (G - D - G - B)
  ];
  private arpeggioMelodyNotes = [587.33, 659.25, 739.99, 880.00, 987.77, 1174.66]; // D5, E5, F#5, A5, B5, D6
  private currentChordIndex = 0;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  public init(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.55, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.startAmbientWind();
      this.startPianoSequence();
      this.startWindChimes();
      this.isStarted = true;
    } catch (e) {
      console.warn('AudioContext not supported or blocked:', e);
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    if (!this.ctx) {
      this.init();
      return true;
    }
    this.resume();
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.7, now + 0.3);
    }
    return !this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  private startAmbientWind(): void {
    if (!this.ctx || !this.ambientGain) return;

    // Create pink noise buffer for night wind
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Wind filter (bandpass filter with slow undulating modulation)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    // LFO for breathing wind gust
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime); // slow wave
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(140, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    whiteNoise.connect(filter);
    filter.connect(this.ambientGain);

    whiteNoise.start();
    lfo.start();
    this.windSource = whiteNoise;
  }

  private playPianoNote(freq: number, time: number, duration: number = 2.4, velocity: number = 0.5): void {
    if (!this.ctx || !this.musicGain) return;

    // Tone oscillator: subtle blend of triangle and sine for warm Rhodes/Piano vibe
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 1.001, time); // subtle chorus detune

    const noteGain = this.ctx.createGain();
    noteGain.gain.setValueAtTime(0, time);
    noteGain.gain.linearRampToValueAtTime(velocity * 0.35, time + 0.04); // quick attack
    noteGain.gain.exponentialRampToValueAtTime(velocity * 0.15, time + 0.4); // initial decay
    noteGain.gain.exponentialRampToValueAtTime(0.0001, time + duration); // smooth release

    // Lowpass filter to give soft warmth
    const noteFilter = this.ctx.createBiquadFilter();
    noteFilter.type = 'lowpass';
    noteFilter.frequency.setValueAtTime(Math.min(freq * 3.5, 3800), time);

    osc1.connect(noteGain);
    osc2.connect(noteGain);
    noteGain.connect(noteFilter);
    noteFilter.connect(this.musicGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  }

  private startPianoSequence(): void {
    const playNextBar = () => {
      if (!this.ctx || !this.musicGain) return;
      const now = this.ctx.currentTime;
      const chord = this.pianoChords[this.currentChordIndex];

      // Play soft arpeggiated chord
      chord.forEach((freq, idx) => {
        const noteTime = now + idx * 0.35;
        this.playPianoNote(freq, noteTime, 3.2, 0.45);
      });

      // Play gentle melodic sparkle note on top
      if (Math.random() > 0.3) {
        const randomMelodyNote = this.arpeggioMelodyNotes[Math.floor(Math.random() * this.arpeggioMelodyNotes.length)];
        this.playPianoNote(randomMelodyNote, now + 1.4 + Math.random() * 0.4, 2.5, 0.38);
      }

      this.currentChordIndex = (this.currentChordIndex + 1) % this.pianoChords.length;

      // Repeat every 3.8 seconds
      this.musicTimer = window.setTimeout(playNextBar, 3800);
    };

    playNextBar();
  }

  private startWindChimes(): void {
    const triggerChime = () => {
      if (!this.ctx || !this.ambientGain) return;
      const now = this.ctx.currentTime;

      // Pentatonic chime cluster
      const chimeFreqs = [1046.50, 1174.66, 1318.51, 1567.98, 1760.00, 2093.00];
      const count = 2 + Math.floor(Math.random() * 3);

      for (let i = 0; i < count; i++) {
        const freq = chimeFreqs[Math.floor(Math.random() * chimeFreqs.length)];
        const time = now + i * 0.12 + Math.random() * 0.08;

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.08, time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.8);

        osc.connect(gain);
        gain.connect(this.ambientGain);

        osc.start(time);
        osc.stop(time + 1.8);
      }

      const nextInterval = 4000 + Math.random() * 7000;
      this.chimeTimer = window.setTimeout(triggerChime, nextInterval);
    };

    this.chimeTimer = window.setTimeout(triggerChime, 3000);
  }

  // SFX when a sky lantern is released or clicked
  public playLanternRelease(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Upward frequency sweep (ascending chime)
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(392.00, now); // G4
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.9); // D6

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 1.6);

    // Harmonic sparkle
    setTimeout(() => {
      if (!this.ctx || !this.sfxGain) return;
      const t = this.ctx.currentTime;
      const sparkle = this.ctx.createOscillator();
      sparkle.type = 'sine';
      sparkle.frequency.setValueAtTime(1567.98, t); // G6
      const spkGain = this.ctx.createGain();
      spkGain.gain.setValueAtTime(0.18, t);
      spkGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      sparkle.connect(spkGain);
      spkGain.connect(this.sfxGain);
      sparkle.start(t);
      sparkle.stop(t + 1.2);
    }, 250);
  }

  public playDistantThunder(): void {
    if (!this.ctx || !this.ambientGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 2.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

    osc.connect(gain);
    gain.connect(this.ambientGain);

    osc.start(now);
    osc.stop(now + 3.0);
  }

  public dispose(): void {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    if (this.chimeTimer) clearTimeout(this.chimeTimer);
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
  }
}
