// AstroBase: Junior Mission Commander
// A short two-note tone for critical alerts, generated with Web Audio (no sound files needed).
let context: AudioContext | null = null;

export function playAlertTone(): void {
  try {
    context ??= new AudioContext();
    const ctx = context;
    const now = ctx.currentTime;
    [660, 520].forEach((frequency, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.17);
    });
  } catch {
    // Audio is optional; ignore browsers that block it.
  }
}
