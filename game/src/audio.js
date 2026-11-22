// A pocket synthesiser: every sound in the game is an oscillator blip shaped here, so the game
// needs no audio files. The context opens on the first user gesture (browsers refuse it sooner)
// and M mutes the whole kit.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === 'suspended') context.resume();
    return context;
  }

  function tone(freqFrom, freqTo, at, duration, type = 'sine', volume = 0.12) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  const sounds = {
    cash() { tone(880, 1320, 0, 0.09, 'sine', 0.1); },
    gem() { tone(660, 660, 0, 0.09); tone(880, 880, 0.08, 0.09); tone(1320, 1320, 0.16, 0.16); },
    tick() { tone(1560, 1400, 0, 0.04, 'square', 0.045); },
    trip() { tone(1180, 1180, 0, 0.1, 'square', 0.08); tone(1180, 1180, 0.14, 0.1, 'square', 0.08); },
    caught() { tone(320, 62, 0, 0.55, 'sawtooth', 0.14); },
    complete() { tone(523, 523, 0, 0.1); tone(659, 659, 0.09, 0.1); tone(784, 784, 0.18, 0.1); tone(1046, 1046, 0.27, 0.22); },
    click() { tone(520, 420, 0, 0.05, 'triangle', 0.08); },
  };

  return {
    play(name) {
      if (muted) return;
      const sound = sounds[name];
      if (sound) sound();
    },
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() { return muted; },
  };
}
