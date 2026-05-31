/* ============================================================================
   bonus.jsx — bonus frontend features:
     • AutoBetPanel  — automated betting (fixed / Martingale) + stop-loss/win
     • Leaderboard   — top players by profit (24h / week)
   Exported to window for use by app.jsx.
   ========================================================================== */
const { useState: uSb, useMemo: uMb } = React;

/* ====================== AUTO-BET PANEL ====================== */
function AutoBetPanel({ cfg, setCfg, running, runtime, onToggle, balance, minBet, maxBet }) {
  const set = (k, v) => setCfg({ ...cfg, [k]: v });
  const num = (v, fb) => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? fb : n; };

  const baseErr = cfg.base < minBet ? `mín ${fmt(minBet)}` : cfg.base > maxBet ? `máx ${fmt(maxBet)}` : cfg.base > balance ? "sem saldo" : "";

  return (
    <div className="card card-pad">
      <div className="card-title">
        <h3><Icon.rocket style={{ width: 14, height: 14, color: "var(--accent)" }} /> Auto-bet</h3>
        <span className="hint">{running ? `rodando · ${runtime.roundsLeft === Infinity ? "∞" : runtime.roundsLeft}` : "estratégia"}</span>
      </div>

      {/* strategy segmented */}
      <div className="seg" style={{ marginBottom: 14 }}>
        {[["fixed", "Valor fixo"], ["martingale", "Martingale"]].map(([k, l]) => (
          <button key={k} className={`seg-btn ${cfg.strategy === k ? "on" : ""}`} disabled={running} onClick={() => set("strategy", k)}>{l}</button>
        ))}
      </div>

      <div className="ab-grid">
        <div className="ab-field">
          <label>Aposta base</label>
          <div className={`mini-input ${baseErr ? "invalid" : ""}`}>
            <span className="cur">R$</span>
            <input inputMode="decimal" disabled={running} value={fmt(cfg.base)}
              onChange={(e) => set("base", num(e.target.value, cfg.base))} />
          </div>
          {baseErr && <div className="ab-hint err">{baseErr}</div>}
        </div>

        <div className="ab-field">
          <label>Cash out alvo</label>
          <div className="mini-input">
            <input inputMode="decimal" disabled={running} value={cfg.target.toFixed(2)}
              onChange={(e) => set("target", Math.max(1.01, num(e.target.value, cfg.target)))} />
            <span className="cur" style={{ paddingLeft: 0, paddingRight: 10 }}>×</span>
          </div>
        </div>

        {cfg.strategy === "martingale" && (
          <div className="ab-field">
            <label>Multipl. na perda</label>
            <div className="mini-input">
              <input inputMode="decimal" disabled={running} value={cfg.onLoss.toFixed(2)}
                onChange={(e) => set("onLoss", Math.max(1, num(e.target.value, cfg.onLoss)))} />
              <span className="cur" style={{ paddingLeft: 0, paddingRight: 10 }}>×</span>
            </div>
          </div>
        )}

        <div className="ab-field">
          <label>Rodadas {cfg.rounds === 0 ? "(∞)" : ""}</label>
          <div className="mini-input">
            <input inputMode="numeric" disabled={running} value={cfg.rounds}
              onChange={(e) => set("rounds", Math.max(0, Math.floor(num(e.target.value, 0))))} />
          </div>
        </div>

        <div className="ab-field">
          <label>Stop-loss</label>
          <div className="mini-input">
            <span className="cur">R$</span>
            <input inputMode="decimal" disabled={running} value={fmt(cfg.stopLoss)}
              onChange={(e) => set("stopLoss", Math.max(0, num(e.target.value, 0)))} />
          </div>
        </div>

        <div className="ab-field">
          <label>Stop-win</label>
          <div className="mini-input">
            <span className="cur">R$</span>
            <input inputMode="decimal" disabled={running} value={fmt(cfg.stopWin)}
              onChange={(e) => set("stopWin", Math.max(0, num(e.target.value, 0)))} />
          </div>
        </div>
      </div>

      {running && (
        <div className="ab-runline">
          <span>Sessão</span>
          <span className={`mono ${runtime.pnl >= 0 ? "pos" : "neg"}`}>{runtime.pnl >= 0 ? "+" : "−"} R$ {fmt(Math.abs(runtime.pnl))}</span>
          <span className="mono" style={{ color: "var(--fg-4)" }}>próx. R$ {fmt(runtime.nextStake)}</span>
        </div>
      )}

      <button className={`ab-toggle ${running ? "stop" : "start"}`} disabled={!running && !!baseErr}
        onClick={onToggle}>
        {running ? "Parar auto-bet" : "Iniciar auto-bet"}
      </button>
      <div className="ab-note">{cfg.strategy === "martingale"
        ? "Martingale dobra a aposta após cada perda e reseta ao ganhar. Alto risco."
        : "Aposta o mesmo valor a cada rodada com saque automático no alvo."}</div>
    </div>
  );
}

/* ====================== LEADERBOARD ====================== */
const LB_NAMES = ["pixelwolf", "CryptoKai", "vipera", "MaverickBR", "luma_neon", "node_runner", "ghost_br", "Renata_S", "thalles99", "Kobra"];
function seededProfits(period) {
  // deterministic-ish per period so it doesn't jump every render
  const mult = period === "week" ? 4.2 : 1;
  return LB_NAMES.map((n, i) => ({
    name: n,
    profit: Math.round((9000 / (i + 1.4)) * mult + (i * 137 % 90)),
    rounds: Math.round((40 / (i + 1) + 12) * (period === "week" ? 6 : 1)),
  })).sort((a, b) => b.profit - a.profit);
}
function Leaderboard({ username, sessionPnl }) {
  const [period, setPeriod] = uSb("24h");
  const rows = uMb(() => {
    const base = seededProfits(period);
    // inject the player with their session pnl so it feels live
    const me = { name: username, profit: Math.round(sessionPnl), rounds: 0, me: true };
    const all = [...base, me].sort((a, b) => b.profit - a.profit);
    return all.slice(0, 8);
  }, [period, username, Math.round(sessionPnl / 25)]);

  return (
    <div className="card card-pad">
      <div className="card-title">
        <h3><Icon.coins style={{ width: 14, height: 14, color: "var(--accent)" }} /> Leaderboard</h3>
        <div className="seg seg-sm">
          {[["24h", "24h"], ["week", "Semana"]].map(([k, l]) => (
            <button key={k} className={`seg-btn ${period === k ? "on" : ""}`} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="lb-list">
        {rows.map((r, i) => (
          <div key={r.name + i} className={`lb-row ${r.me ? "me" : ""}`}>
            <span className={`lb-rank r${i + 1}`}>{i + 1}</span>
            <span className="lb-ava">{initials(r.name)}</span>
            <span className="lb-name">{r.name}{r.me && <span className="me-tag">VOCÊ</span>}</span>
            <span className={`lb-profit ${r.profit >= 0 ? "pos" : "neg"}`}>{r.profit >= 0 ? "+" : "−"}R$ {fmt(Math.abs(r.profit))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { AutoBetPanel, Leaderboard });
