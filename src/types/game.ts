export interface Word {
  id: string
  word: string
  phonetic: string
  meaning: string
  emoji: string
  example: string
  exampleCn: string
  fact?: string // 世界/历史小知识（闯天下主题单元）
}

export interface Unit {
  id: string
  title: string
  subtitle: string
  color: string // hex
  icon: string
  place?: string // 旅行目的地介绍
  words: Word[]
}

export type QType =
  | 'image-pick-zh' // 看图片选中文意思
  | 'image-pick-en' // 看中文选图片
  | 'listen' // 听发音选单词
  | 'translate-en' // 中文 → 英文
  | 'spelling' // 拼写
  | 'fill-blank' // 补全例句
  | 'speak' // 🎤 跟读打分
  | 'fact' // 🌍 世界小知识卡（闯天下主题）

export interface Question {
  id: string
  type: QType
  word: Word
  prompt: string
  optionKind: 'text' | 'emoji'
  options: string[]
  correct: string
  letters?: string[] // 拼写题：打乱后的字母
  sentence?: string // 补全题：含空位的例句
  factText?: string // 知识卡：小知识正文
}

export interface LevelResult {
  wordId: string
  correct: boolean
}
