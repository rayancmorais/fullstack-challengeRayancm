/* ============================================================================
   components2.jsx — bet controls, live bets list, stats, toasts, fairness modal
   ========================================================================== */
const { useState: uS2, useEffect: uE2, useRef: uR2, useMemo: uM2 } = React;

/* ====================== BET CONTROLS ====================== */
function BetControls({ snap, balance, playerBet, potential, onBet, onCancel, onCashOut, auto, setAuto, autoTarget, setAutoTarget }) {
  const { phase, cfg } = snap;
  const [amount, setAmount] = uS2("10,00");

  const parsed = useMemo(() => {
    const n = parseFloat(String(amount).replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  }, [amount]);

  const err = useMemo(() => {
    if (phase !== "BETTING" || playerBet) return "";
    if (parsed < cfg.minBet) return `Mínimo ${fmt(cfg.minBet)}`;
    if (parsed > cfg.maxBet) return `Máximo ${fmt(cfg.maxBet)}`;
    if (parsed > balance) return "Saldo insuficiente";
    return "";
  }, [parsed, phase, playerBet, balance, cfg]);

  const setAmt = (n) => setAmount(fmt(Math.max(0, n)));
  const step = (d) => setAmt(Math.min(cfg.maxBet, Math.max(0, parsed + d)));

  const betting = phase === "BETTING";
  const running = phase === "RUNNING";
  const crashed = phase === "CRASHED";
  const canBet = betting && !playerBet && !err && parsed >= cfg.minBet;
  const hasActive = playerBet && playerBet.status === "placed";
  const cashed = playerBet && playerBet.status === "won";

  /* ----- main action button ----- */
  let actionBtn;
  if (running && hasActive) {
    actionBtn = (
      <button className="action-btn btn-cashout" onClick={onCashOut}>
        <span>Cash Out</span>
        <span className="sub">{fmt(potential)}  ·  {snap.multiplier.toFixed(2)}×</span>
      </button>
    );
  } else if (running && cashed) {
    actionBtn = (
      <button className="action-btn btn-placed" disabled>
        <span>Sacou em {playerBet.cashoutAt.toFixed(2)}×</span>
        <span className="sub">+ {fmt(playerBet.payout)}</span>
      </button>
    );
  } else if (running) {
    actionBtn = (<button className="action-btn btn-waiting" disabled><span>Rodada em andamento</span><span className="sub">aguarde para apostar</span></button>);
  } else if (crashed) {
    actionBtn = (<button className="action-btn btn-waiting" disabled><span>Próxima rodada</span><span className="sub">preparando…</span></button>);
  } else if (betting && playerBet) {
    actionBtn = (
      <button className="action-btn btn-placed" onClick={onCancel}>
        <span>Aposta confirmada · {fmt(playerBet.amount)}</span>
        <span className="sub">toque para cancelar</span>
      </button>
    );
  } else {
    actionBtn = (
      <button className="action-btn btn-bet" disabled={!canBet} onClick={() => onBet(parsed)}>
        <span>Apostar</span>
        <span className="sub">{fmt(parsed)} {auto ? `· auto ${autoTarget.toFixed(2)}×` : ""}</span>
      </button>
    );
  }

  const locked = !betting || !!playerBet;

  return (
    <div className="card card-pad bet-panel">
      <div className="bet-top">
        <div className="field">
          <label>Valor da aposta</label>
          <div className={`amount-input ${err ? "invalid" : ""}`}>
            <span className="cur">R$</span>
            <input
              inputMode="decimal" value={amount} disabled={locked}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
              onBlur={() => setAmt(parsed)}
            />
            <button className="step-btn" disabled={locked} onClick={() => step(-1)}>−</button>
            <button className="step-btn" disabled={locked} onClick={() => step(1)}>+</button>
          </div>
          <div className="quick-row">
            {[["½", () => setAmt(parsed / 2)], ["2×", () => setAmt(parsed * 2)], ["+10", () => setAmt(parsed + 10)], ["+50", () => setAmt(parsed + 50)], ["Máx", () => setAmt(Math.min(cfg.maxBet, balance))]].map(([l, fn]) => (
              <button key={l} className="quick-btn" disabled={locked} onClick={fn}>{l}</button>
            ))}
          </div>
        </div>

        <div className="field" style={{ flex: "0 1 160px" }}>
          <label>Auto cash out</label>
          <div className="auto-row" style={{ marginBottom: 10 }}>
            <button className={`switch ${auto ? "on" : ""}`} onClick={() => setAuto(!auto)}><span className="knob" /></button>
            <span className="mono" style={{ fontSize: 12, color: auto ? "var(--accent)" : "var(--fg-4)" }}>{auto ? "Ativo" : "Manual"}</span>
          </div>
          <div className={`amount-input ${!auto ? "" : ""}`} style={{ opacity: auto ? 1 : 0.5 }}>
            <input className="auto-input" inputMode="decimal" disabled={!auto || locked}
              value={autoTarget.toFixed(2)}
              onChange={(e) => { const v = parseFloat(e.target.value.replace(",", ".")); if (!isNaN(v)) setAutoTarget(Math.max(1.01, v)); }}
              style={{ fontSize: 18 }} />
            <span className="cur" style={{ paddingRight: 10, paddingLeft: 0 }}>×</span>
          </div>
        </div>
      </div>

      <div className="err-text">{err}</div>
      {actionBtn}

      <div className="bet-status">
        <span className="k">SALDO</span>
        <span className="v mono">R$ {fmt(balance)}</span>
      </div>
    </div>
  );
}

/* ====================== LIVE BETS LIST ====================== */
function BetsList({ bets, phase }) {
  const sorted = useMemo(() => {
    return [...bets].sort((a, b) => {
      if (a.isPlayer) return -1; if (b.isPlayer) return 1;
      const w = (x) => (x.status === "won" ? 2 : x.status === "placed" ? 1 : 0);
      if (w(b) !== w(a)) return w(b) - w(a);
      return b.amount - a.amount;
    });
  }, [bets]);
  const total = bets.reduce((s, b) => s + b.amount, 0);
  const wonCount = bets.filter((b) => b.status === "won").length;

  return (
    <div className="card card-pad">
      <div className="card-title">
        <h3><Icon.users style={{ width: 14, height: 14, color: "var(--accent)" }} /> Apostas da rodada</h3>
        <span className="hint">{bets.length} jogadores</span>
      </div>
      <div className="bets-summary" style={{ marginBottom: 12 }}>
        <span>Total apostado <b className="mono">R$ {fmt(total)}</b></span>
        <span>Sacaram <b className="mono">{wonCount}</b></span>
      </div>
      <div className="bets-list">
        {bets.length === 0 && [...Array(5)].map((_, i) => (
          <div key={i} className="bet-row" style={{ opacity: 0.5 }}>
            <div className="skel" style={{ width: 26, height: 26, borderRadius: 50 }} />
            <div className="skel" style={{ height: 12, width: "60%" }} />
            <div className="skel" style={{ height: 12, width: 44 }} />
            <div className="skel" style={{ height: 18, width: 48, borderRadius: 100 }} />
          </div>
        ))}
        {sorted.map((b) => (
          <div key={b.id} className={`bet-row ${b.isPlayer ? "you" : ""} ${b.status === "won" ? "won" : ""}`}>
            <div className="ava">{initials(b.user)}</div>
            <div className="nm">{b.user}{b.isPlayer && <span className="me">VOCÊ</span>}</div>
            <div className="amt">R$ {fmt(b.amount)}</div>
            {b.status === "won" ? (
              <div className="mult-tag won">{b.cashoutAt.toFixed(2)}× · +{fmt(b.payout)}</div>
            ) : b.status === "lost" ? (
              <div className="mult-tag lost">perdeu</div>
            ) : (
              <div className="mult-tag placed">{phase === "RUNNING" ? "em jogo" : "apostou"}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ====================== SESSION STATS ====================== */
function SessionStats({ stats }) {
  return (
    <div className="card card-pad">
      <div className="card-title"><h3><Icon.coins style={{ width: 14, height: 14, color: "var(--accent)" }} /> Sua sessão</h3></div>
      <div className="stat-grid">
        <div className="stat-box"><div className="k">Lucro / Prejuízo</div><div className={`v ${stats.pnl >= 0 ? "pos" : "neg"}`}>{stats.pnl >= 0 ? "+" : "−"}{fmt(Math.abs(stats.pnl))}</div></div>
        <div className="stat-box"><div className="k">Rodadas</div><div className="v">{stats.rounds}</div></div>
        <div className="stat-box"><div className="k">Melhor saque</div><div className="v pos">{stats.best ? stats.best.toFixed(2) + "×" : "—"}</div></div>
        <div className="stat-box"><div className="k">Total apostado</div><div className="v">{fmt(stats.wagered)}</div></div>
      </div>
    </div>
  );
}

/* ====================== TOASTS ====================== */
function Toasts({ toasts, dismiss }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind} ${t.out ? "out" : ""}`} onClick={() => dismiss(t.id)}>
          <div className="ic">{t.kind === "error" ? <Icon.x /> : t.kind === "gold" ? <Icon.coins /> : t.kind === "info" ? <Icon.info /> : <Icon.check />}</div>
          <div className="body"><div className="t">{t.title}</div>{t.desc && <div className="d">{t.desc}</div>}</div>
        </div>
      ))}
    </div>
  );
}

/* ====================== FAIRNESS MODAL ====================== */
function FairModal({ snap, onClose }) {
  const cur = snap.current || {};
  const revealed = cur.revealed;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3><Icon.shield style={{ width: 18, height: 18, verticalAlign: -3, marginRight: 6, color: "var(--accent)" }} />Provably Fair</h3>
        <p className="sub">O hash da seed é publicado <b>antes</b> da rodada. Após o crash, a seed é revelada — confira que <span className="mono" style={{ color: "var(--accent)" }}>SHA-256(server:client:nonce)</span> bate com o hash.</p>
        <div className="formula-box">
          <span className="cm">{"// curva do multiplicador no tempo"}</span><br/>
          m(t) = e<sup>k · t</sup>  <span className="cm">· k ≈ 0.000098 / ms</span><br/>
          <span className="cm">{"// crash point a partir do hash (house edge 1%)"}</span><br/>
          h = int(hash[0:13]) ; e = 2<sup>52</sup><br/>
          crash = ⌊(99·e − h) / (e − h)⌋ / 100
        </div>
        <div className="fair-field"><div className="k">Hash da seed (commit) — rodada #{snap.roundId}</div><div className="val accent">{cur.hash}</div></div>
        {revealed ? (
          <>
            <div className="fair-field"><div className="k">Server seed (revelada)</div><div className="val">{cur.serverSeed}</div></div>
            <div className="fair-field"><div className="k">Client seed</div><div className="val">{cur.clientSeed}</div></div>
            <div className="row" style={{ gap: 12 }}>
              <div className="fair-field grow"><div className="k">Nonce</div><div className="val">{cur.nonce}</div></div>
              <div className="fair-field grow"><div className="k">Crash point</div><div className="val accent">{cur.crashPoint?.toFixed(2)}×</div></div>
            </div>
          </>
        ) : (
          <div className="fair-field"><div className="k">Server seed</div><div className="val" style={{ color: "var(--fg-4)" }}>🔒 revelada após o crash desta rodada</div></div>
        )}
        <button className="modal-x" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

Object.assign(window, { BetControls, BetsList, SessionStats, Toasts, FairModal });
