'use client'

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, verticalAlign: -3, marginRight: 6, color: 'var(--accent)' }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

interface Props {
  rodadaId: string | null
  hashSeedServidor: string | null
  seedServidor: string | null
  pontoCrash: number | null
  onClose: () => void
}

export function FairModal({ rodadaId, hashSeedServidor, seedServidor, pontoCrash, onClose }: Props) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3><IconShield />Provably Fair</h3>
        <p className="sub">
          O hash da seed é publicado <b>antes</b> da rodada.
          Após o crash, a seed é revelada — confira que{' '}
          <span className="mono" style={{ color: 'var(--accent)' }}>SHA-256(serverSeed)</span>{' '}
          bate com o hash.
        </p>

        <div className="fair-field">
          <div className="k">Hash da seed (commit){rodadaId ? ` — rodada` : ''}</div>
          <div className="val accent">{hashSeedServidor || '—'}</div>
        </div>

        {seedServidor ? (
          <>
            <div className="fair-field">
              <div className="k">Server seed (revelada após o crash)</div>
              <div className="val">{seedServidor}</div>
            </div>
            <div className="fair-field">
              <div className="k">Crash point</div>
              <div className="val accent">{pontoCrash?.toFixed(2)}×</div>
            </div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', margin: '0 0 16px', lineHeight: 1.6 }}>
              Verifique: <code style={{ color: 'var(--accent)' }}>GET /games/rounds/{rodadaId}/verify</code>
            </p>
          </>
        ) : (
          <div className="fair-field">
            <div className="k">Server seed</div>
            <div className="val" style={{ color: 'var(--fg-4)' }}>🔒 revelada após o crash desta rodada</div>
          </div>
        )}

        <button className="modal-x" onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}
