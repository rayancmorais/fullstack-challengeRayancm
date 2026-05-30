'use client'
import { pillClass } from '@/lib/utils'
import type { HistoryEntry } from '@/store/game'

interface Props {
  historico: HistoryEntry[]
}

export function HistoryRail({ historico }: Props) {
  return (
    <div className="card card-pad">
      <div className="history-rail">
        <span className="lbl">Últimos</span>
        <div className="history-pills">
          {historico.length === 0
            ? [...Array(10)].map((_, i) => (
                <div key={i} className="skel" style={{ width: 52, height: 28, borderRadius: 100 }} />
              ))
            : historico.map((h, i) => (
                <span key={`${h.rodadaId}-${i}`} className={`pill ${pillClass(h.pontoCrash)}`}>
                  {h.pontoCrash.toFixed(2)}×
                </span>
              ))}
        </div>
      </div>
    </div>
  )
}
