import type { ReactNode } from 'react'
import { Volume2 } from 'lucide-react'
import { speak } from '@/lib/speech'
import { sfx } from '@/lib/sfx'

/** 发音按钮 */
export function SpeakerButton({
  text,
  size = 'md',
  className = '',
}: {
  text: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dims = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const icon = size === 'lg' ? 26 : size === 'sm' ? 14 : 18
  return (
    <button
      type="button"
      aria-label={`播放发音 ${text}`}
      onClick={(e) => {
        e.stopPropagation()
        sfx.click()
        speak(text)
      }}
      className={`${dims} inline-flex items-center justify-center rounded-full bg-[#1cb0f6] text-white shadow-[0_3px_0_#1899d6] transition hover:brightness-110 active:translate-y-[2px] active:shadow-none ${className}`}
    >
      <Volume2 size={icon} fill="currentColor" />
    </button>
  )
}

/** 掌握度圆点（0-4） */
export function MasteryDots({ mastery, due = false }: { mastery: number; due?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-4 rounded-full ${i < mastery ? 'bg-[#58cc02]' : 'bg-slate-200'} ${due && i >= mastery ? 'bg-amber-300' : ''}`}
        />
      ))}
    </div>
  )
}

/** 顶部统计胶囊 */
export function StatPill({ icon, value, color }: { icon: ReactNode; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5">
      <span style={{ color }}>{icon}</span>
      <span className="text-sm font-extrabold tabular-nums text-slate-700">{value}</span>
    </div>
  )
}

/** 完成庆祝彩带（CSS 实现，无需图片） */
export function Confetti() {
  const pieces = Array.from({ length: 40 })
  const colors = ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#ce82ff', '#ff9600']
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((_, i) => {
        const left = (i * 2.5 + (i % 7)) % 100
        const delay = (i % 10) * 0.15
        const dur = 2.4 + (i % 5) * 0.4
        const color = colors[i % colors.length]
        const size = 8 + (i % 4) * 3
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${left}%`,
              width: size,
              height: size * 0.6,
              background: color,
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
            }}
          />
        )
      })}
    </div>
  )
}

/** 猫头鹰吉祥物提示气泡（outfit 为已穿装扮 emoji，空为无） */
export function MascotHint({ text, outfit = '' }: { text: string; outfit?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-[#e5e5e5] bg-white p-3 shadow-sm">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fff4d6] text-3xl">
        🦉
        {outfit && (
          <span className="absolute -right-2 -top-2 text-xl" aria-label="当前装扮">
            {outfit}
          </span>
        )}
      </div>
      <p className="text-sm font-bold text-slate-600">{text}</p>
    </div>
  )
}
