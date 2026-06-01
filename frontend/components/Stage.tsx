'use client'
import { useState, useRef, useEffect } from 'react'
import AnimacaoAsteroide from './AnimacaoAsteroide'
import { CountdownOverlay } from './CountdownOverlay'
import { fmt } from '@/lib/utils'
import { useGameStore } from '@/store/game'
import type { GamePhase } from '@/store/game'

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11, verticalAlign: -1, marginRight: 4 }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

interface Campeao {
  mult:      number
  nome:      string
  pagamento: number   // centavos
  eu:        boolean  // true se o viewer é o campeão
}

interface Props {
  phase: GamePhase | null
  multiplier: number
  hashSeedServidor: string | null
  encerraEm: Date | null
  rodadaId: string | null
  cashFlash: number
  pagamentoCentavos: number
  apostaPerda: number
  campeaoDaRodada: Campeao | null
  onOpenFair: () => void
}

export function Stage({
  phase, multiplier, hashSeedServidor, encerraEm, rodadaId,
  cashFlash, pagamentoCentavos, apostaPerda, campeaoDaRodada, onOpenFair,
}: Props) {
  const [shakeKey, setShakeKey] = useState(0)
  const prevPhase               = useRef(phase)
  const sacadoEm                = useGameStore(s => s.sacadoEm)
  const pontoCrash              = useGameStore(s => s.pontoCrash) ?? 0

  useEffect(() => {
    if (phase === 'CRASHADO' && prevPhase.current === 'RODANDO') setShakeKey(k => k + 1)
    prevPhase.current = phase
  }, [phase])

  const running = phase === 'RODANDO'
  const crashed = phase === 'CRASHADO'
  const betting = phase === 'APOSTAS_ABERTAS'

  const justSacou  = running && sacadoEm != null
  const sobreviveu = crashed && sacadoEm != null
  const perdeu     = crashed && apostaPerda > 0
  const big        = (justSacou || sobreviveu) && (sacadoEm ?? 0) >= 5

  // campeão da rodada — mostra para TODOS após o crash (inclui espectadores e perdedores)
  const mostraCampeao = !!campeaoDaRodada && !justSacou && !sobreviveu

  const stageClass = [
    'stage',
    crashed                       ? 'is-crashed flash-crash' : '',
    justSacou || sobreviveu       ? 'is-saved'               : '',
    perdeu && !campeaoDaRodada    ? 'is-lost'                : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={stageClass} key={shakeKey}>
      <button className="fair-badge" onClick={onOpenFair} title="Provably fair — verificar">
        <span className="dot" />
        <span className="txt">
          <IconShield />
          SEED <span className="hash">{hashSeedServidor ? hashSeedServidor.slice(0, 10) + '…' : '——'}</span>
        </span>
      </button>

      <div className="live-badge">
        <span className={`pulse ${betting ? 'betting' : ''}`} />
        <span className="txt">
          {betting ? 'Apostas' : running ? 'Ao vivo' : rodadaId ? 'Rodada' : '—'}
        </span>
      </div>

      <AnimacaoAsteroide />

      {betting ? (
        /* ── Fase de apostas ── */
        <CountdownOverlay encerraEm={encerraEm} />

      ) : justSacou ? (
        /* ── Jogador sacou — rodada ainda viva ── */
        <div className={`prize-card ${big ? 'big' : ''}`}>
          <div className="pc-spark">{big ? '★ MEGA PRÊMIO ★' : '✦ Prêmio garantido ✦'}</div>
          <div className="pc-mult">{sacadoEm!.toFixed(2)}<span>×</span></div>
          <div className="pc-pay">+ R$ {fmt(pagamentoCentavos / 100)}</div>
          <div className="pc-live">o planeta resistiu · rodada em {multiplier.toFixed(2)}×</div>
        </div>

      ) : sobreviveu ? (
        /* ── Jogador sacou — crash confirmou ── */
        <div className={`prize-card ${big ? 'big' : ''} ${campeaoDaRodada?.eu ? 'campeao' : ''}`}>
          {campeaoDaRodada?.eu && <div className="confetes" aria-hidden />}
          <div className="pc-spark">
            {campeaoDaRodada?.eu ? '👑 MELHOR SAQUE DA RODADA! 👑' : big ? '★ ESCAPOU COM FORTUNA ★' : '✦ Escapou antes do crash ✦'}
          </div>
          <div className="pc-mult">{sacadoEm!.toFixed(2)}<span>×</span></div>
          <div className="pc-pay">+ R$ {fmt(pagamentoCentavos / 100)}</div>
          <div className="pc-live">crash em {pontoCrash.toFixed(2)}× · planeta sobreviveu</div>
        </div>

      ) : mostraCampeao ? (
        /* ── Campeão da rodada — visível para TODOS (espectador, perdedor, não apostou) ── */
        <div className={`prize-card big campeao`}>
          <div className="confetes" aria-hidden />
          <div className="pc-spark">👑 MELHOR SAQUE DA RODADA 👑</div>
          <div className="pc-mult">{campeaoDaRodada!.mult.toFixed(2)}<span>×</span></div>
          {campeaoDaRodada!.pagamento > 0 && (
            <div className="pc-pay">+ R$ {fmt(campeaoDaRodada!.pagamento / 100)}</div>
          )}
          <div className="pc-live" style={{ color: 'var(--gold)', fontSize: 13 }}>
            {campeaoDaRodada!.nome} · crash em {pontoCrash.toFixed(2)}×
          </div>
          {perdeu && (
            <div className="pc-live" style={{ color: 'var(--danger)', marginTop: 6 }}>
              você perdeu R$ {fmt(apostaPerda / 100)} nesta rodada
            </div>
          )}
        </div>

      ) : perdeu ? (
        /* ── Jogador perdeu — sem campeão ── */
        <div className="perda-card">
          <div className="pd-label">💥 EXPLODIU!</div>
          <div className="pd-valor">− R$ {fmt(apostaPerda / 100)}</div>
          <div className="pd-sub">crash em {pontoCrash.toFixed(2)}× · não sacou a tempo</div>
        </div>

      ) : crashed && pontoCrash >= 5 ? (
        /* ── Rodada épica — espectador sem saque na rodada ── */
        <div className="epico-card">
          <div className="ep-label">🚀 RODADA ÉPICA</div>
          <div className="ep-mult">{pontoCrash.toFixed(2)}<span>×</span></div>
          <div className="ep-sub">crash em {pontoCrash.toFixed(2)}×</div>
        </div>

      ) : (
        /* ── Padrão ── */
        <div className="mult-readout">
          <div className={`mult-value ${running ? 'running' : ''} ${crashed ? 'crashed' : ''}`}>
            {multiplier.toFixed(2)}<span style={{ fontSize: '0.5em' }}>×</span>
          </div>
          <div className={`mult-caption ${crashed ? 'crashed' : ''}`}>
            {crashed ? 'Crash!' : running ? 'Subindo' : '—'}
          </div>
          {cashFlash > 0 && running && (
            <div className="cashout-flash">+ R$ {fmt(cashFlash / 100)} sacado!</div>
          )}
        </div>
      )}
    </div>
  )
}
