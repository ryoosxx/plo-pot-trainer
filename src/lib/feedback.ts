function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(pattern);
}

function playTone(frequency: number, durationMs: number): void {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    const end = ctx.currentTime + durationMs / 1000;
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(end);
    window.setTimeout(() => {
      void ctx.close();
    }, durationMs + 50);
  } catch {
    // jsdom など AudioContext 非対応
  }
}

export function tapFeedback(vibe: boolean): void {
  if (vibe) vibrate(12);
}

export function resultFeedback(correct: boolean, sound: boolean, vibe: boolean): void {
  if (vibe) vibrate(correct ? 20 : [40, 30, 40]);
  if (sound) playTone(correct ? 880 : 196, correct ? 120 : 220);
}
