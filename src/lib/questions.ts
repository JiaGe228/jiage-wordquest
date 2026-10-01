import type { Question, QType, Word } from '@/types/game'
import { UNITS, QUESTIONS_PER_LEVEL, WORDS_PER_LEVEL } from '@/data/words'

// 伪随机数（按关卡种子固定，保证每次进入同一关题目一致）
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickDistractors<T>(pool: T[], target: T, n: number, rng: () => number): T[] {
  const others = shuffle(pool.filter((x) => x !== target), rng)
  return others.slice(0, n)
}

/** 生成某一关的题目列表 */
export function generateQuestions(unitId: string, levelIndex: number): Question[] {
  const unit = UNITS.find((u) => u.id === unitId)
  if (!unit) return []
  const rng = mulberry32(hashStr(`${unitId}-L${levelIndex}`))
  const levelWords = unit.words.slice(levelIndex * WORDS_PER_LEVEL, (levelIndex + 1) * WORDS_PER_LEVEL)
  const unitWords = unit.words
  const allWords = UNITS.flatMap((u) => u.words)
  const allMeanings = allWords.map((w) => w.meaning)
  const allSpellings = allWords.map((w) => w.word)
  const allEmojis = allWords.map((w) => w.emoji)

  // 关卡难度递进：越往后拼写/翻译占比越高
  // 「闯天下」主题单元（单词带小知识）穿插知识卡
  const isWorldUnit = Boolean(unit.words[0]?.fact)
  const typePlans: QType[][] = isWorldUnit
    ? [
        ['image-pick-zh', 'speak', 'fact', 'translate-en', 'spelling', 'fact'],
        ['listen', 'translate-en', 'fact', 'speak', 'fill-blank', 'fact'],
        ['fact', 'spelling', 'speak', 'fact', 'translate-en', 'listen'],
      ]
    : [
        ['image-pick-zh', 'image-pick-en', 'speak', 'image-pick-zh', 'listen', 'translate-en'],
        ['listen', 'translate-en', 'spelling', 'speak', 'translate-en', 'spelling'],
        ['spelling', 'fill-blank', 'speak', 'spelling', 'listen', 'fill-blank'],
      ]
  const plan = typePlans[Math.min(levelIndex, typePlans.length - 1)]

  const questions: Question[] = []
  for (let i = 0; i < Math.min(QUESTIONS_PER_LEVEL, plan.length); i++) {
    const type = plan[i]
    const word = type === 'fact' ? levelWords[(i * 2 + 1) % levelWords.length] : levelWords[i % levelWords.length]
    questions.push(buildQuestion(type, word, { unitWords, allMeanings, allSpellings, allEmojis, rng, idx: i }))
  }
  return questions
}

function buildQuestion(
  type: QType,
  word: Word,
  ctx: {
    unitWords: Word[]
    allMeanings: string[]
    allSpellings: string[]
    allEmojis: string[]
    rng: () => number
    idx: number
  }
): Question {
  const { unitWords, allMeanings, allSpellings, allEmojis, rng, idx } = ctx
  const base: Question = {
    id: `${word.id}-q${idx}`,
    type,
    word,
    prompt: '',
    optionKind: 'text',
    options: [],
    correct: '',
  }

  switch (type) {
    case 'image-pick-zh': {
      // 看图片+单词，选中文意思
      const distractors = pickDistractors(allMeanings, word.meaning, 3, rng)
      base.prompt = '这个单词是什么意思？'
      base.options = shuffle([word.meaning, ...distractors], rng)
      base.correct = word.meaning
      break
    }
    case 'image-pick-en': {
      // 看中文，选图片
      const distractors = pickDistractors(allEmojis, word.emoji, 3, rng)
      base.prompt = `哪个图片是「${word.meaning}」？`
      base.optionKind = 'emoji'
      base.options = shuffle([word.emoji, ...distractors], rng)
      base.correct = word.emoji
      break
    }
    case 'listen': {
      // 听发音选单词
      const distractors = pickDistractors(allSpellings, word.word, 3, rng)
      base.prompt = '听一听，选出你听到的单词'
      base.options = shuffle([word.word, ...distractors], rng)
      base.correct = word.word
      break
    }
    case 'translate-en': {
      // 中文 → 英文
      const distractors = pickDistractors(allSpellings, word.word, 3, rng)
      base.prompt = `「${word.meaning}」用英语怎么说？`
      base.options = shuffle([word.word, ...distractors], rng)
      base.correct = word.word
      break
    }
    case 'spelling': {
      // 拼写
      base.prompt = '按顺序点字母，拼出这个单词'
      let letters = shuffle(word.word.split(''), rng)
      // 避免初始顺序恰好等于答案
      if (letters.join('') === word.word && letters.length > 1) {
        letters = shuffle(letters, rng)
      }
      base.letters = letters
      base.optionKind = 'text'
      base.options = []
      base.correct = word.word
      break
    }
    case 'speak': {
      // 🎤 跟读打分：无选项，由 Lesson 组件驱动录音评分
      base.prompt = '点麦克风，大声跟读这个单词！'
      base.optionKind = 'text'
      base.options = []
      base.correct = word.word
      break
    }
    case 'fact': {
      // 🌍 闯天下主题：世界/历史小知识卡（不判分、不扣心）
      base.prompt = '🌍 世界小知识'
      base.factText = word.fact ?? ''
      base.optionKind = 'text'
      base.options = []
      base.correct = ''
      break
    }
    case 'fill-blank': {
      // 补全例句：优先用本单元词做干扰项
      const sameUnit = unitWords.filter((w) => w.id !== word.id).map((w) => w.word)
      const distractors = shuffle(sameUnit, rng).slice(0, 3)
      while (distractors.length < 3) {
        const extra = pickDistractors(allSpellings, word.word, 1, rng)[0]
        if (extra && !distractors.includes(extra)) distractors.push(extra)
        else break
      }
      const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      base.sentence = word.example.replace(new RegExp(`\\b${escaped}\\b`, 'i'), '______')
      base.prompt = '选出空格里的单词'
      base.options = shuffle([word.word, ...distractors], rng)
      base.correct = word.word
      break
    }
  }
  return base
}
