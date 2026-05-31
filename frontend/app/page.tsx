import { GamePage } from '@/components/GamePage'
import { GuardaAuth } from '@/components/GuardaAuth'

export default function Home() {
  return (
    <GuardaAuth>
      <GamePage />
    </GuardaAuth>
  )
}
