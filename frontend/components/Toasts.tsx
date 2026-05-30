'use client'
import type { Toast } from '@/store/game'

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
)
const IconCoins = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
  </svg>
)

interface Props {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

export function Toasts({ toasts, onDismiss }: Props) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind} ${t.out ? 'out' : ''}`} onClick={() => onDismiss(t.id)}>
          <div className="ic">
            {t.kind === 'error' && <IconX />}
            {t.kind === 'gold' && <IconCoins />}
            {t.kind === 'info' && <IconInfo />}
            {t.kind === 'success' && <IconCheck />}
          </div>
          <div className="body">
            <div className="t">{t.title}</div>
            {t.desc && <div className="d">{t.desc}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
