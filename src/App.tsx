import { Component, type ReactNode } from 'react'
import { Routes, Route } from 'react-router'
import { GameProvider, useGame } from '@/lib/store'
import Home, { NameDialog } from '@/pages/Home'
import Lesson from '@/pages/Lesson'
import WordBank from '@/pages/WordBank'
import Review from '@/pages/Review'

/** 全局错误边界：真机上任何渲染崩溃都显示可读信息，方便截图诊断 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f7f9fb', fontFamily: 'system-ui', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>🦉</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#334155', marginBottom: 8 }}>页面开小差了</h2>
          <p style={{ color: '#64748b', fontWeight: 700, marginBottom: 16 }}>请把下面这行字截图发给爸爸</p>
          <p style={{ fontSize: 12, color: '#94a3b8', wordBreak: 'break-all', marginBottom: 24, maxWidth: 360 }}>{String(this.state.error.message || this.state.error)}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#58cc02', color: '#fff', border: 'none', borderRadius: 14, padding: '14px 40px', fontSize: 18, fontWeight: 900 }}
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function Shell() {
  const { state, setName } = useGame()
  return (
    <>
      {!state.name && <NameDialog onDone={setName} />}
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lesson/:unitIndex/:levelIndex" element={<Lesson />} />
          <Route path="/words" element={<WordBank />} />
          <Route path="/review" element={<Review />} />
        </Routes>
      </ErrorBoundary>
    </>
  )
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  )
}
