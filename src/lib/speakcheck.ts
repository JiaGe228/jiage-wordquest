// 「跟读小明星」口语评分：优先用语音识别比对文本，离线/不支持时退回音频特征启发式打分
export interface SpeakResult {
  stars: 1 | 2 | 3
  recognized: string | null
  mode: 'recognition' | 'heuristic'
}

let micStream: MediaStream | null = null

export async function ensureMic(): Promise<MediaStream> {
  if (micStream && micStream.getAudioTracks().length > 0) return micStream
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('microphone unsupported')
  // 某些环境下授权弹窗永不返回：5 秒超时兜底
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('mic timeout')), 5000))
  micStream = await Promise.race([
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }),
    timeout,
  ])
  return micStream
}

/** 录制 PCM（最长 maxSeconds 秒，可提前结束） */
export async function recordPcm(maxSeconds = 4.5): Promise<{ pcm: Float32Array; sampleRate: number }> {
  const mic = await ensureMic()
  const ac = new AudioContext()
  const src = ac.createMediaStreamSource(mic)
  const proc = ac.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []
  const sampleRate = ac.sampleRate
  await new Promise<void>((resolve) => {
    const startedAt = Date.now()
    proc.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      if (Date.now() - startedAt >= maxSeconds * 1000) resolve()
    }
    src.connect(proc)
    proc.connect(ac.destination)
    // 兜底：最多 maxSeconds + 1 秒
    setTimeout(resolve, (maxSeconds + 1) * 1000)
  })
  proc.onaudioprocess = null
  try {
    proc.disconnect()
    src.disconnect()
    void ac.close()
  } catch {
    // 忽略清理错误
  }
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const pcm = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    pcm.set(c, offset)
    offset += c.length
  }
  return { pcm, sampleRate }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]!
}

/** 浏览器语音识别（Safari 为 webkitSpeechRecognition，需联网） */
export function recognize(target: string): Promise<string | null> {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
  if (!SR) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const rec = new SR()
      rec.lang = 'en-US'
      rec.interimResults = false
      rec.maxAlternatives = 3
      let settled = false
      const done = (val: string | null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try {
          rec.stop()
        } catch {
          // ignore
        }
        resolve(val)
      }
      const timer = setTimeout(() => done(null), 6500)
      rec.onresult = (e) => {
        const list = e.results?.[0]
        if (!list || list.length === 0) return done(null)
        const t = normalize(target)
        let best: string | null = null
        let bestDist = Infinity
        for (let i = 0; i < list.length; i++) {
          const alt = String(list[i]?.transcript ?? '').trim()
          if (!alt) continue
          const d = levenshtein(normalize(alt), t)
          if (d < bestDist) {
            bestDist = d
            best = alt
          }
        }
        done(best)
      }
      rec.onerror = () => done(null)
      rec.onnomatch = () => done(null)
      rec.start()
    } catch {
      resolve(null)
    }
  })
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null
  onerror: (() => void) | null
  onnomatch: (() => void) | null
  start: () => void
  stop: () => void
}

/** 离线启发式：能量、有声时长占比、过零率 */
export function heuristicStars(pcm: Float32Array): 1 | 2 | 3 {
  if (pcm.length === 0) return 1
  let sum = 0
  for (let i = 0; i < pcm.length; i++) sum += pcm[i]! * pcm[i]!
  const rms = Math.sqrt(sum / pcm.length)

  let zc = 0
  for (let i = 1; i < pcm.length; i++) if ((pcm[i - 1]! < 0) !== (pcm[i]! < 0)) zc++
  const zcr = zc / pcm.length

  const win = 2048
  let voiced = 0
  const totalWins = Math.floor(pcm.length / win)
  for (let i = 0; i + win <= pcm.length; i += win) {
    let s = 0
    for (let j = i; j < i + win; j++) s += pcm[j]! * pcm[j]!
    if (Math.sqrt(s / win) > 0.012) voiced++
  }
  const voicedRatio = totalWins > 0 ? voiced / totalWins : 0

  let stars: 1 | 2 | 3 = 1
  if (rms > 0.02 && voicedRatio > 0.12) stars = 2
  if (rms > 0.045 && voicedRatio > 0.28 && zcr > 0.015 && zcr < 0.4) stars = 3
  return stars
}

/** 综合评分：先语音识别比对，失败退回启发式 */
export async function scoreSpeak(target: string, pcm: Float32Array): Promise<SpeakResult> {
  const heard = await recognize(target)
  if (heard) {
    const t = normalize(target)
    const a = normalize(heard)
    const d = levenshtein(a, t)
    const tol = Math.max(1, Math.floor(t.length * 0.34))
    if (a === t || d === 0) return { stars: 3, recognized: heard, mode: 'recognition' }
    if (a.includes(t) || t.includes(a) || d <= tol) return { stars: 2, recognized: heard, mode: 'recognition' }
    return { stars: 1, recognized: heard, mode: 'recognition' }
  }
  return { stars: heuristicStars(pcm), recognized: null, mode: 'heuristic' }
}
