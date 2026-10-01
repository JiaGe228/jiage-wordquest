// 轻量音效：用 WebAudio 合成，无需音频文件
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18) {
  const ac = getCtx()
  if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = ac.currentTime + start
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export const sfx = {
  click() {
    tone(660, 0, 0.08, 'triangle', 0.1)
  },
  correct() {
    tone(523, 0, 0.12, 'sine', 0.16)
    tone(659, 0.09, 0.12, 'sine', 0.16)
    tone(784, 0.18, 0.22, 'sine', 0.18)
  },
  wrong() {
    tone(220, 0, 0.18, 'sawtooth', 0.08)
    tone(180, 0.12, 0.24, 'sawtooth', 0.08)
  },
  flip() {
    tone(440, 0, 0.07, 'triangle', 0.08)
  },
  complete() {
    const notes = [523, 587, 659, 784, 1047]
    notes.forEach((n, i) => tone(n, i * 0.11, 0.24, 'sine', 0.16))
  },
  heartLost() {
    tone(330, 0, 0.15, 'sine', 0.12)
    tone(262, 0.12, 0.2, 'sine', 0.12)
  },
}
