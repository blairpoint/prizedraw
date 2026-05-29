let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext() {
  if (!audioCtx && typeof window !== "undefined") {
    // @ts-ignore
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export const toggleGlobalSound = (enabled: boolean) => {
  soundEnabled = enabled;
  if (!enabled && audioCtx) {
    audioCtx.suspend();
  } else if (enabled && audioCtx) {
    audioCtx.resume();
  }
};

export const isSoundEnabled = () => soundEnabled;

/**
 * Play a high-pitched mechanical tick / click sound
 */
export const playTick = (frequency = 1200, duration = 0.015) => {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
  } catch (e) {
    // Audio fail-safe
  }
};

/**
 * Play progress rumble during dramatic spinner roll
 */
export const playRumbleTick = () => {
  playTick(250, 0.05);
};

/**
 * Play a celebratory victory fanfare chord
 */
export const playCelebration = () => {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Play a sequence of ascending notes for a fanfare chord: C4, E4, G4, C5
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = index % 2 === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now + index * 0.08);
      
      // Volume ramp
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + index * 0.08 + 0.01);
      gain.gain.setValueAtTime(0.12, now + index * 0.08 + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.8);
      
      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 1.2);
    });
  } catch (e) {
    // Audio fail-safe
  }
};

/**
 * Play a gentle alert chime
 */
export const playChime = () => {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    // Audio fail-safe
  }
};
