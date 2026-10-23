type AudioContextConstructor = typeof AudioContext;
type NoiseColor = "pink" | "brown";

function audioContextConstructor(): AudioContextConstructor | null {
  const legacy = window as unknown as { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? legacy.webkitAudioContext ?? null;
}

// Crossfading the tail into the head makes a loop with no seam.
function makeLoop(context: AudioContext, seconds: number, color: NoiseColor): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.floor(rate * seconds);
  const fade = Math.min(Math.floor(rate * 1.25), Math.floor(length / 3));
  const raw = new Float32Array(length + fade);
  let peak = 0;
  let brown = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let index = 0; index < raw.length; index += 1) {
    const white = Math.random() * 2 - 1;
    let sample: number;
    if (color === "pink") {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    } else {
      brown = (brown + 0.02 * white) / 1.02;
      sample = brown * 3.2;
    }
    raw[index] = sample;
    const level = Math.abs(sample);
    if (level > peak) peak = level;
  }

  const scale = peak > 0 ? 0.9 / peak : 1;
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    const value =
      index < fade
        ? raw[index] * (index / fade) + raw[length + index] * (1 - index / fade)
        : raw[index];
    data[index] = value * scale;
  }
  return buffer;
}

function makeBurst(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * 0.85;
  }
  return buffer;
}

export class WindowSound {
  #context: AudioContext | null = null;
  #master: GainNode | null = null;
  #rainBus: GainNode | null = null;
  #nearBus: GainNode | null = null;
  #windBus: GainNode | null = null;
  #dropBuffer: AudioBuffer | null = null;
  #timers = new Set<number>();
  #running = false;
  #wet = true;

  get running(): boolean {
    return this.#running;
  }

  async start(wet: boolean): Promise<void> {
    if (this.#running) return;
    this.#wet = wet;
    if (!this.#context) this.#build();
    const context = this.#context;
    const master = this.#master;
    if (!context || !master) return;
    this.#running = true;
    try {
      await context.resume();
    } catch (error) {
      this.#running = false;
      throw error;
    }

    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.9, now + 2.6);
    if (this.#nearBus) {
      this.#nearBus.gain.cancelScheduledValues(now);
      this.#nearBus.gain.setValueAtTime(1, now);
    }
    this.#applyWeather(2.6);
    this.#scheduleDroplet(900);
    this.#scheduleGust(9_000 + Math.random() * 8_000);
    this.#scheduleHorn(26_000);
  }

  stop(): void {
    this.#running = false;
    const context = this.#context;
    if (!context || !this.#master) return;
    const now = context.currentTime;
    this.#master.gain.cancelScheduledValues(now);
    this.#master.gain.setValueAtTime(this.#master.gain.value, now);
    this.#master.gain.linearRampToValueAtTime(0, now + 1.4);
    this.#clearTimers();
    window.setTimeout(() => {
      if (!this.#running) void context.suspend();
    }, 1_600);
  }

  setWet(wet: boolean): void {
    if (this.#wet === wet) return;
    this.#wet = wet;
    if (this.#running) this.#applyWeather(1.8);
  }

  dispose(): void {
    this.#running = false;
    this.#clearTimers();
    const context = this.#context;
    this.#context = null;
    if (context) void context.close();
  }

  #applyWeather(fade: number): void {
    const context = this.#context;
    if (!context) return;
    const now = context.currentTime;
    const ramp = (gain: GainNode | null, value: number) => {
      if (!gain) return;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(value, now + fade);
    };
    ramp(this.#rainBus, this.#wet ? 0.9 : 0);
    ramp(this.#windBus, this.#wet ? 0.55 : 2.3);
    if (!this.#wet) ramp(this.#nearBus, 1);
  }

  #build(): void {
    const Constructor = audioContextConstructor();
    if (!Constructor) return;
    const context = new Constructor();
    this.#context = context;

    const master = context.createGain();
    master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 22;
    compressor.ratio.value = 2.5;
    compressor.attack.value = 0.02;
    compressor.release.value = 0.5;
    master.connect(compressor);
    compressor.connect(context.destination);
    this.#master = master;

    this.#dropBuffer = makeBurst(context, 1.6);

    const rainBus = context.createGain();
    rainBus.gain.value = 0;
    rainBus.connect(master);
    this.#rainBus = rainBus;

    const nearBus = context.createGain();
    nearBus.gain.value = 1;
    nearBus.connect(rainBus);
    this.#nearBus = nearBus;

    const pink = makeLoop(context, 9, "pink");
    const brown = makeLoop(context, 11, "brown");

    const nearLayers = [
      { offset: 0, pan: -0.42, rate: 0.047, depth: 0.055 },
      { offset: 2.9, pan: 0.42, rate: 0.061, depth: 0.045 },
    ];
    for (const layer of nearLayers) {
      const source = context.createBufferSource();
      source.buffer = pink;
      source.loop = true;
      const highpass = context.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 560;
      highpass.Q.value = 0.55;
      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 7_200;
      lowpass.Q.value = 0.4;
      const gain = context.createGain();
      gain.gain.value = 0.2;
      const panner = context.createStereoPanner();
      panner.pan.value = layer.pan;
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(panner);
      panner.connect(nearBus);

      const lfo = context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = layer.rate;
      const depth = context.createGain();
      depth.gain.value = layer.depth;
      lfo.connect(depth);
      depth.connect(gain.gain);
      lfo.start();
      source.start(0, layer.offset);
    }

    const air = context.createBufferSource();
    air.buffer = pink;
    air.loop = true;
    const airHighpass = context.createBiquadFilter();
    airHighpass.type = "highpass";
    airHighpass.frequency.value = 5_000;
    airHighpass.Q.value = 0.4;
    const airGain = context.createGain();
    airGain.gain.value = 0.055;
    const airPanner = context.createStereoPanner();
    airPanner.pan.value = 0.26;
    air.connect(airHighpass);
    airHighpass.connect(airGain);
    airGain.connect(airPanner);
    airPanner.connect(nearBus);

    const airLfo = context.createOscillator();
    airLfo.type = "sine";
    airLfo.frequency.value = 0.043;
    const airDepth = context.createGain();
    airDepth.gain.value = 0.014;
    airLfo.connect(airDepth);
    airDepth.connect(airGain.gain);
    airLfo.start();
    air.start(0, 4.2);

    const body = context.createBufferSource();
    body.buffer = brown;
    body.loop = true;
    const bodyHighpass = context.createBiquadFilter();
    bodyHighpass.type = "highpass";
    bodyHighpass.frequency.value = 150;
    bodyHighpass.Q.value = 0.5;
    const bodyLowpass = context.createBiquadFilter();
    bodyLowpass.type = "lowpass";
    bodyLowpass.frequency.value = 1_600;
    bodyLowpass.Q.value = 0.5;
    const bodyGain = context.createGain();
    bodyGain.gain.value = 0.09;
    body.connect(bodyHighpass);
    bodyHighpass.connect(bodyLowpass);
    bodyLowpass.connect(bodyGain);
    bodyGain.connect(rainBus);

    const bodyLfo = context.createOscillator();
    bodyLfo.type = "sine";
    bodyLfo.frequency.value = 0.031;
    const bodyDepth = context.createGain();
    bodyDepth.gain.value = 0.022;
    bodyLfo.connect(bodyDepth);
    bodyDepth.connect(bodyGain.gain);
    bodyLfo.start();
    body.start(0, 5.4);

    const sea = context.createBufferSource();
    sea.buffer = brown;
    sea.loop = true;
    const seaLowpass = context.createBiquadFilter();
    seaLowpass.type = "lowpass";
    seaLowpass.frequency.value = 190;
    seaLowpass.Q.value = 0.5;
    const seaGain = context.createGain();
    seaGain.gain.value = 0.032;
    sea.connect(seaLowpass);
    seaLowpass.connect(seaGain);
    seaGain.connect(master);

    const seaLfo = context.createOscillator();
    seaLfo.type = "sine";
    seaLfo.frequency.value = 0.037;
    const seaDepth = context.createGain();
    seaDepth.gain.value = 0.011;
    seaLfo.connect(seaDepth);
    seaDepth.connect(seaGain.gain);
    seaLfo.start();
    sea.start(0, 1.7);

    const windBus = context.createGain();
    windBus.gain.value = 0;
    windBus.connect(master);
    this.#windBus = windBus;

    const wind = context.createBufferSource();
    wind.buffer = brown;
    wind.loop = true;
    const windHighpass = context.createBiquadFilter();
    windHighpass.type = "highpass";
    windHighpass.frequency.value = 70;
    windHighpass.Q.value = 0.5;
    const windLowpass = context.createBiquadFilter();
    windLowpass.type = "lowpass";
    windLowpass.frequency.value = 460;
    windLowpass.Q.value = 0.5;
    const windGain = context.createGain();
    windGain.gain.value = 0.065;
    const windPanner = context.createStereoPanner();
    windPanner.pan.value = -0.38;
    wind.connect(windHighpass);
    windHighpass.connect(windLowpass);
    windLowpass.connect(windGain);
    windGain.connect(windPanner);
    windPanner.connect(windBus);

    const windLfo = context.createOscillator();
    windLfo.type = "sine";
    windLfo.frequency.value = 0.052;
    const windDepth = context.createGain();
    windDepth.gain.value = 0.024;
    windLfo.connect(windDepth);
    windDepth.connect(windGain.gain);
    windLfo.start();
    wind.start(0, 7.8);

    const windAir = context.createBufferSource();
    windAir.buffer = pink;
    windAir.loop = true;
    const windAirHighpass = context.createBiquadFilter();
    windAirHighpass.type = "highpass";
    windAirHighpass.frequency.value = 320;
    windAirHighpass.Q.value = 0.5;
    const windAirLowpass = context.createBiquadFilter();
    windAirLowpass.type = "lowpass";
    windAirLowpass.frequency.value = 1_400;
    windAirLowpass.Q.value = 0.4;
    const windAirGain = context.createGain();
    windAirGain.gain.value = 0.032;
    const windAirPanner = context.createStereoPanner();
    windAirPanner.pan.value = 0.55;
    windAir.connect(windAirHighpass);
    windAirHighpass.connect(windAirLowpass);
    windAirLowpass.connect(windAirGain);
    windAirGain.connect(windAirPanner);
    windAirPanner.connect(windBus);

    const windAirLfo = context.createOscillator();
    windAirLfo.type = "sine";
    windAirLfo.frequency.value = 0.044;
    const windAirDepth = context.createGain();
    windAirDepth.gain.value = 0.011;
    windAirLfo.connect(windAirDepth);
    windAirDepth.connect(windAirGain.gain);
    windAirLfo.start();
    windAir.start(0, 6.3);
  }

  #scheduleDroplet(delay?: number): void {
    const wait = delay ?? 750 + Math.random() * 2_700;
    const timer = window.setTimeout(() => {
      this.#timers.delete(timer);
      if (!this.#running) return;
      if (this.#wet) this.#droplet();
      this.#scheduleDroplet();
    }, wait);
    this.#timers.add(timer);
  }

  #droplet(): void {
    const context = this.#context;
    const rainBus = this.#rainBus;
    const buffer = this.#dropBuffer;
    if (!context || !rainBus || !buffer) return;
    const now = context.currentTime + Math.random() * 0.22;
    const duration = 0.04 + Math.random() * 0.085;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 450;
    highpass.Q.value = 0.5;
    const bandpass = context.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 900 + Math.pow(Math.random(), 1.6) * 3_200;
    bandpass.Q.value = 1.4 + Math.random() * 4;
    const gain = context.createGain();
    const level = 0.035 + Math.random() * 0.06;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const panner = context.createStereoPanner();
    panner.pan.value = Math.random() * 1.6 - 0.8;
    source.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(panner);
    panner.connect(rainBus);
    source.start(now, Math.random() * 1.4, duration + 0.02);
  }

  #scheduleGust(delay?: number): void {
    const wait = delay ?? 16_000 + Math.random() * 26_000;
    const timer = window.setTimeout(() => {
      this.#timers.delete(timer);
      if (!this.#running) return;
      this.#gust();
      this.#scheduleGust();
    }, wait);
    this.#timers.add(timer);
  }

  #gust(): void {
    const context = this.#context;
    const nearBus = this.#nearBus;
    if (!context || !nearBus || !this.#wet) return;
    const now = context.currentTime;
    nearBus.gain.cancelScheduledValues(now);
    nearBus.gain.setValueAtTime(nearBus.gain.value, now);
    nearBus.gain.linearRampToValueAtTime(1.45, now + 3.4);
    nearBus.gain.setValueAtTime(1.45, now + 4.6);
    nearBus.gain.linearRampToValueAtTime(1, now + 12.5);

    const drops = 3 + Math.floor(Math.random() * 4);
    for (let index = 0; index < drops; index += 1) {
      const timer = window.setTimeout(
        () => {
          this.#timers.delete(timer);
          if (this.#running && this.#wet) this.#droplet();
        },
        180 + Math.random() * 2_600,
      );
      this.#timers.add(timer);
    }
  }

  #scheduleHorn(delay?: number): void {
    const wait = delay ?? 55_000 + Math.random() * 100_000;
    const timer = window.setTimeout(() => {
      this.#timers.delete(timer);
      if (!this.#running) return;
      this.#horn();
      this.#scheduleHorn();
    }, wait);
    this.#timers.add(timer);
  }

  #horn(): void {
    const context = this.#context;
    const master = this.#master;
    if (!context || !master) return;
    const now = context.currentTime + 0.2;
    const attack = 1.8;
    const hold = 3.2 + Math.random() * 2.2;
    const release = 6.4;
    const root = 84 + Math.random() * 14;

    const tone = context.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 720;
    tone.Q.value = 0.4;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.018, now + attack);
    gain.gain.setValueAtTime(0.018, now + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold + release);
    const panner = context.createStereoPanner();
    panner.pan.value = -0.45;
    tone.connect(gain);
    gain.connect(panner);
    panner.connect(master);

    const echo = context.createDelay(1);
    echo.delayTime.value = 0.42;
    const feedback = context.createGain();
    feedback.gain.value = 0.26;
    const damp = context.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 650;
    const echoGain = context.createGain();
    echoGain.gain.value = 0.3;
    gain.connect(echo);
    echo.connect(damp);
    damp.connect(feedback);
    feedback.connect(echo);
    damp.connect(echoGain);
    echoGain.connect(master);

    const voices: Array<[number, number, OscillatorType]> = [
      [root, 0.5, "triangle"],
      [root * 1.5 + 0.12, 0.28, "triangle"],
      [root * 2 + 0.07, 0.16, "sine"],
    ];
    for (const [frequency, level, type] of voices) {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      const voiceGain = context.createGain();
      voiceGain.gain.value = level;
      oscillator.connect(voiceGain);
      voiceGain.connect(tone);
      oscillator.start(now);
      oscillator.stop(now + attack + hold + release + 0.2);
    }
  }

  #clearTimers(): void {
    for (const timer of this.#timers) window.clearTimeout(timer);
    this.#timers.clear();
  }
}
