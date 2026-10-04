// 宝石商店目录与定价
export interface Outfit {
  id: string
  emoji: string
  name: string
  price: number
}

export const OUTFITS: Outfit[] = [
  { id: 'bow', emoji: '🎀', name: '蝴蝶结', price: 30 },
  { id: 'hat', emoji: '🎩', name: '绅士礼帽', price: 30 },
  { id: 'scarf', emoji: '🧣', name: '暖暖围巾', price: 30 },
  { id: 'glasses', emoji: '🕶️', name: '酷酷墨镜', price: 40 },
  { id: 'icecream', emoji: '🍦', name: '冰淇淋帽', price: 45 },
  { id: 'star', emoji: '⭐', name: '星星发夹', price: 50 },
  { id: 'cape', emoji: '🦸', name: '超人披风', price: 60 },
  { id: 'crown', emoji: '👑', name: '黄金皇冠', price: 80 },
]

export const HINT_FIFTY_PRICE = 10
export const HINT_LETTER_PRICE = 10
export const HEART_REFILL_PRICE = 20
