// Sound, synthesized only: no audio files. A WebAudio context is created on the first
// user gesture (browsers forbid sound before one). Engine hum follows the car's speed,
// the siren is a two-tone wail while police are near, and gunshots, crashes, pickups
// and mission chimes are short synthesized bursts. M toggles mute.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let noiseBuf = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // One shared noise buffer for bursts (gunshots, crashes, skids).
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      // Looping engine oscillator, quiet until the player drives.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Looping siren oscillator, quiet until police are close.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, filterType) {
    if (!ctx || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType || 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  return {
    /** Call from any user gesture; safe to call every frame. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** Engine hum follows speed 0..1; call every frame while driving, 0 on foot. */
    engine(speed01) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(speed01 * 0.16, t, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 110, t, 0.08);
    },
    /** Siren loudness 0..1 and its two-tone wail; call every frame. */
    siren(level01, time) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      sirenGain.gain.setTargetAtTime(level01 * 0.05, t, 0.1);
      sirenOsc.frequency.setTargetAtTime((Math.floor(time * 2) % 2 === 0 ? 660 : 880), t, 0.05);
    },
    gunshot() {
      noise(0.14, 0.5, 2600, 'highpass');
      blip(160, 0.1, 'square', 0.25, 60);
    },
    punch() {
      noise(0.08, 0.3, 900);
    },
    crash(strength01) {
      noise(0.3, 0.25 + strength01 * 0.45, 700);
      blip(90, 0.25, 'sine', 0.3, 45);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.3);
      blip(990, 0.14, 'sine', 0.3);
    },
    cash() {
      blip(880, 0.08, 'triangle', 0.3);
      blip(1320, 0.12, 'triangle', 0.3);
    },
    missionDone() {
      blip(523, 0.12, 'triangle', 0.35);
      blip(659, 0.12, 'triangle', 0.35);
      blip(784, 0.22, 'triangle', 0.35);
    },
    missionFail() {
      blip(330, 0.18, 'sawtooth', 0.25, 220);
      blip(220, 0.3, 'sawtooth', 0.25, 150);
    },
    wantedUp() {
      blip(440, 0.1, 'square', 0.2);
      blip(440, 0.1, 'square', 0.2);
    },
  };
}
