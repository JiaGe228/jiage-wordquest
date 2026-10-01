// 浏览器语音合成：美式英语发音，儿童友好的语速
let cachedVoice: SpeechSynthesisVoice | null = null

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice
  if (typeof speechSynthesis === 'undefined') return null
  const voices = speechSynthesis.getVoices()
  const prefer = [
    (v: SpeechSynthesisVoice) => /en[-_]US/i.test(v.lang) && /google/i.test(v.name),
    (v: SpeechSynthesisVoice) => /en[-_]US/i.test(v.lang) && /samantha|zira|ava/i.test(v.name),
    (v: SpeechSynthesisVoice) => /^en/i.test(v.lang),
  ]
  for (const test of prefer) {
    const found = voices.find(test)
    if (found) {
      cachedVoice = found
      return found
    }
  }
  return null
}

if (typeof speechSynthesis !== 'undefined') {
  // 某些浏览器需要异步加载语音列表
  speechSynthesis.getVoices()
  speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null
    pickVoice()
  }
}

export function speak(text: string, opts?: { rate?: number; onEnd?: () => void }) {
  if (typeof speechSynthesis === 'undefined') return
  speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'en-US'
  utter.rate = opts?.rate ?? 0.82
  utter.pitch = 1.05
  const voice = pickVoice()
  if (voice) utter.voice = voice
  if (opts?.onEnd) {
    utter.onend = () => opts.onEnd?.()
    utter.onerror = () => opts.onEnd?.()
  }
  speechSynthesis.speak(utter)
}

export function stopSpeak() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}
