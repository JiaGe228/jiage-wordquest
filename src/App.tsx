import { Routes, Route } from 'react-router'
import { GameProvider, useGame } from '@/lib/store'
import Home, { NameDialog } from '@/pages/Home'
import Lesson from '@/pages/Lesson'
import WordBank from '@/pages/WordBank'
import Review from '@/pages/Review'

function Shell() {
  const { state, setName } = useGame()
  return (
    <>
      {!state.name && <NameDialog onDone={setName} />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lesson/:unitIndex/:levelIndex" element={<Lesson />} />
        <Route path="/words" element={<WordBank />} />
        <Route path="/review" element={<Review />} />
      </Routes>
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
