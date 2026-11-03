// /src/audio/AnimeSoundEngine.ts

type Ctx = AudioContext;

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class AnimeSoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainLowGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private started = false;
  private sparkleTimer: number | null = null;
  private sparkleUntil = 0;
  private disposed = false;
  muted = false;

  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    this.ctx = ctx;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 22;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.28;
    compressor.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.82;
    master.connect(compressor);
    this.master = master;

    const reverb = ctx.createConvolver();
    reverb.buffer = this.createImpulseResponse(ctx, 3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.62;
    reverb.connect(wet);
    wet.connect(master);
    this.wet = wet;

    this.noiseBuffer = this.createNoiseBuffer(ctx, 4);

    if (ctx.state === 'suspended') await ctx.resume();
    this.startAmbience(ctx);
  }

  private createImpulseResponse(ctx: Ctx, seconds: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let smooth = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const decay = Math.pow(1 - t, 2.9);
        smooth += ((Math.random() * 2 - 1) - smooth) * 0.38;
        data[i] = smooth * decay * 0.55;
      }
    }
    return buffer;
  }

  private createNoiseBuffer(ctx: Ctx, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private startAmbience(ctx: Ctx): void {
    if (!this.noiseBuffer || !this.master || !this.wet || this.started) return;
    this.started = true;

    const rainSource = ctx.createBufferSource();
    rainSource.buffer = this.noiseBuffer;
    rainSource.loop = true;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 950;
    highpass.Q.value = 0.55;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;
    rainSource.connect(highpass);
    highpass.connect(rainGain);
    rainGain.connect(this.master);
    const rainReverb = ctx.createGain();
    rainReverb.gain.value = 0.22;
    rainGain.connect(rainReverb);
    rainReverb.connect(this.wet);
    rainSource.start();

    const rainLow = ctx.createBufferSource();
    rainLow.buffer = this.noiseBuffer;
    rainLow.loop = true;
    rainLow.playbackRate.value = 0.55;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 420;
    const rainLowGain = ctx.createGain();
    rainLowGain.gain.value = 0;
    rainLow.connect(lowpass);
    lowpass.connect(rainLowGain);
    rainLowGain.connect(this.master);
    rainLow.start();

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.028;
    lfo.connect(lfoGain);
    lfoGain.connect(rainGain.gain);
    lfo.start();

    const windSource = ctx.createBufferSource();
    windSource.buffer = this.noiseBuffer;
    windSource.loop = true;
    windSource.playbackRate.value = 0.8;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 620;
    windFilter.Q.value = 0.9;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.master);
    const windReverb = ctx.createGain();
    windReverb.gain.value = 0.15;
    windGain.connect(windReverb);
    windReverb.connect(this.wet);
    windSource.start();

    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.value = 0.13;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 0.035;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windGain.gain);
    windLfo.start();

    this.rainGain = rainGain;
    this.rainLowGain = rainLowGain;
    this.windGain = windGain;
    this.windFilter = windFilter;

    this.setStorm(0.85);
    this.setWind(0.4);
  }

  setStorm(storm: number): void {
    if (!this.ctx || !this.rainGain || !this.rainLowGain) return;
    const now = this.ctx.currentTime;
    const amount = this.started ? 0.09 + storm * 0.12 : 0;
    this.rainGain.gain.setTargetAtTime(amount, now, 0.8);
    this.rainLowGain.gain.setTargetAtTime(0.035 + storm * 0.05, now, 1.2);
  }

  setWind(strength: number): void {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const now = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.02 + strength * 0.055, now, 0.9);
    this.windFilter.frequency.setTargetAtTime(380 + strength * 520, now, 1.3);
  }

  setRainMix(level: number): void {
    if (!this.ctx || !this.rainGain || !this.rainLowGain) return;
    const now = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(level * 0.17, now, 0.5);
    this.rainLowGain.gain.setTargetAtTime(level * 0.06, now, 0.7);
  }

  thunder(intensity = 1, delay = 0.15): void {
    if (!this.ctx || !this.master || !this.wet || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const distance = 0.55 + Math.random() * 0.45;

    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noiseBuffer;
    rumble.playbackRate.value = 0.4 + Math.random() * 0.15;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200 + Math.random() * 180;
    lp.Q.value = 0.8;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t0);
    rg.gain.linearRampToValueAtTime(0.55 * intensity * distance, t0 + 0.08);
    rg.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6 + Math.random() * 1.8);
    rumble.connect(lp);
    lp.connect(rg);
    rg.connect(this.master);
    const rumbleWet = ctx.createGain();
    rumbleWet.gain.value = 0.5;
    rg.connect(rumbleWet);
    rumbleWet.connect(this.wet);
    rumble.start(t0);
    rumble.stop(t0 + 5);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(54, t0);
    sub.frequency.exponentialRampToValueAtTime(28, t0 + 1.8);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, t0);
    subGain.gain.linearRampToValueAtTime(0.35 * intensity, t0 + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.0);
    sub.connect(subGain);
    subGain.connect(this.master);
    sub.start(t0);
    sub.stop(t0 + 2.2);

    if (distance < 0.8) {
      const crack = ctx.createBufferSource();
      crack.buffer = this.noiseBuffer;
      crack.playbackRate.value = 1.8;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t0);
      cg.gain.linearRampToValueAtTime(0.22 * intensity, t0 + 0.012);
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      crack.connect(hp);
      hp.connect(cg);
      cg.connect(this.master);
      const crackWet = ctx.createGain();
      crackWet.gain.value = 0.7;
      cg.connect(crackWet);
      crackWet.connect(this.wet);
      crack.start(t0);
      crack.stop(t0 + 0.4);
    }
  }

  startSparkles(duration = 6): void {
    if (!this.ctx) return;
    this.sparkleUntil = this.ctx.currentTime + duration;
    if (this.sparkleTimer !== null) return;
    const tick = (): void => {
      if (!this.ctx || this.disposed) return;
      if (this.ctx.currentTime > this.sparkleUntil) {
        this.sparkleTimer = null;
        return;
      }
      this.sparkle();
      this.sparkleTimer = window.setTimeout(tick, 90 + Math.random() * 260);
    };
    this.sparkleTimer = window.setTimeout(tick, 80);
  }

  stopSparkles(): void {
    this.sparkleUntil = 0;
    if (this.sparkleTimer !== null) {
      window.clearTimeout(this.sparkleTimer);
      this.sparkleTimer = null;
    }
  }

  private sparkle(): void {
    if (!this.ctx || !this.master || !this.wet) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + Math.random() * 0.08;
    const freq = 1400 + Math.random() * 2600;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * (1.4 + Math.random() * 0.7), t0 + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.028, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16 + Math.random() * 0.2);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    osc.connect(g);
    g.connect(pan);
    pan.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.8;
    g.connect(send);
    send.connect(this.wet);
    osc.start(t0);
    osc.stop(t0 + 0.6);
  }

  lanternFall(): void {
    if (!this.ctx || !this.master || !this.wet) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const base = 520 + Math.random() * 90;
    [1, 2.4, 3.9].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * ratio, t0);
      osc.frequency.exponentialRampToValueAtTime(base * ratio * 0.72, t0 + 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.035 / (i + 1), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4 + i * 0.3);
      osc.connect(g);
      g.connect(this.master!);
      const send = ctx.createGain();
      send.gain.value = 0.5;
      g.connect(send);
      send.connect(this.wet!);
      osc.start(t0);
      osc.stop(t0 + 2.2);
    });
  }

  furin(strength = 1, delay = 0): void {
    if (!this.ctx || !this.master || !this.wet) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const base = 1350 + Math.random() * 650;
    const partials = [1, 2.76, 5.4, 8.93, 13.34];
    const out = ctx.createGain();
    out.gain.value = 0.055 * strength;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.5 - 0.75;
    partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = Math.min(base * ratio * (1 + (Math.random() - 0.5) * 0.004), 18000);
      const g = ctx.createGain();
      const attack = 0.004 + i * 0.002;
      const decay = 1.5 + i * 0.55;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.7 / (1 + i * 1.2), t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      osc.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + decay + 0.2);
    });
    out.connect(pan);
    pan.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.85;
    out.connect(send);
    send.connect(this.wet);
  }

  private pluck(note: number, delay: number, gain = 0.075, brightness = 3200): void {
    if (!this.ctx || !this.master || !this.wet) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const freq = midiToFreq(note);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = brightness;
    filter.Q.value = 0.4;
    const out = ctx.createGain();
    out.gain.value = 1;
    filter.connect(out);
    out.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.9;
    out.connect(send);
    send.connect(this.wet);

    const harmonics: { ratio: number; level: number; decay: number }[] = [
      { ratio: 1, level: 1, decay: 3.2 },
      { ratio: 2.003, level: 0.42, decay: 2.1 },
      { ratio: 3.01, level: 0.16, decay: 1.3 },
      { ratio: 4.02, level: 0.07, decay: 0.9 },
    ];
    for (const h of harmonics) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * h.ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gain * h.level, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + h.decay);
      osc.connect(g);
      g.connect(filter);
      osc.start(t0);
      osc.stop(t0 + h.decay + 0.2);
    }
  }

  private pad(notes: number[], delay: number, duration: number, gain = 0.018): void {
    if (!this.ctx || !this.master || !this.wet) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.linearRampToValueAtTime(gain, t0 + duration * 0.35);
    out.gain.linearRampToValueAtTime(0.0001, t0 + duration);
    out.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 1.1;
    out.connect(send);
    send.connect(this.wet);
    for (const note of notes) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = midiToFreq(note);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        osc.connect(g);
        g.connect(out);
        osc.start(t0);
        osc.stop(t0 + duration + 0.4);
      }
    }
  }

  sunburst(): void {
    if (!this.ctx || !this.master || !this.wet || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = this.noiseBuffer;
    whoosh.playbackRate.value = 1.1;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(260, t0);
    bp.frequency.exponentialRampToValueAtTime(5200, t0 + 0.85);
    bp.frequency.exponentialRampToValueAtTime(1200, t0 + 2.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.17, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
    whoosh.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 1.0;
    g.connect(send);
    send.connect(this.wet);
    whoosh.start(t0);
    whoosh.stop(t0 + 3);
  }

  climax(): void {
    if (!this.ctx) return;
    this.setRainMix(0.28);
    this.furin(1.0, 0.02);
    this.furin(0.7, 0.55);
    this.furin(0.55, 1.35);
    this.furin(0.4, 2.2);
    this.sunburst();

    const melody = [62, 69, 74, 78, 81, 86, 90, 93, 90, 86, 81, 78, 74, 69];
    melody.forEach((note, i) => {
      this.pluck(note, 0.15 + i * 0.26, i === 0 ? 0.09 : 0.065, 3600);
    });
    const sparkleMelody = [86, 88, 90, 93, 95, 98];
    sparkleMelody.forEach((note, i) => this.pluck(note, 2.4 + i * 0.36, 0.035, 5200));

    this.pad([50, 57, 62, 66], 0.1, 9, 0.02);
    this.pad([45, 52, 57], 4.6, 8, 0.014);

    window.setTimeout(() => {
      if (!this.ctx || this.disposed) return;
      this.furin(0.5, 0.05);
      this.furin(0.35, 0.9);
      this.pluck(81, 0.2, 0.045, 4200);
      this.pluck(86, 0.9, 0.035, 4600);
    }, 4300);
  }

  victoryChime(): void {
    this.furin(0.9, 0);
    this.pluck(93, 0.1, 0.05, 5000);
    this.pluck(98, 0.35, 0.035, 5400);
    this.pad([50, 57, 62, 66, 69], 0.05, 6, 0.016);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.82, this.ctx.currentTime, 0.15);
  }

  dispose(): void {
    this.disposed = true;
    this.stopSparkles();
    this.ctx?.close();
    this.ctx = null;
  }
}
