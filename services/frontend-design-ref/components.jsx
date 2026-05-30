/* ============================================================================
   components.jsx — presentation layer (React, no JSX build step).
   Pure render components driven by engine snapshots passed as props.
   Exported to window at the bottom for use by app.jsx.
   ========================================================================== */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- tiny inline icons ---------- */
const Icon = {
  rocket: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 6 9 17 4 12"/></svg>),
  x: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  info: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>),
  coins: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>),
  shield: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>),
  logout: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
  users: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>),
  clock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>),
};

/* ---------- helpers ---------- */
const fmt = (n) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pillClass = (m) => (m < 2 ? "low" : m < 5 ? "mid" : m < 20 ? "high" : "epic");
const initials = (name) => name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();

/* ====================== GRAPH ====================== */
function CrashGraph({ phase, multiplier, crashPoint, growth, lastCrash, cashFlash }) {
  // Build the curve purely from the current multiplier + known growth model.
  const W = 1000, H = 562; // viewBox (16:9-ish)
  const padB = 8, padT = 40;

  const { path, area, tip, yMax } = useMemo(() => {
    const M = Math.max(1.0001, multiplier);
    const g = growth;
    const elapsed = Math.log(M) / g;               // ms
    const win = Math.max(elapsed / 0.8, 2600);     // sliding window, tip ~80%
    const yM = Math.max(1.9, M * 1.28);
    const N = 64;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = (elapsed * i) / N;
      const mult = Math.exp(g * t);
      const x = (t / win) * W;
      const y = H - padB - ((mult - 1) / (yM - 1)) * (H - padB - padT);
      pts.push([x, y]);
    }
    const last = pts[pts.length - 1];
    const d = pts.map((p, i) => (i === 0 ? `M ${p[0].toFixed(1)} ${p[1].toFixed(1)}` : `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)).join(" ");
    const a = `${d} L ${last[0].toFixed(1)} ${H} L 0 ${H} Z`;
    return { path: d, area: a, tip: last, yMax: yM };
  }, [multiplier, growth]);

  const running = phase === "RUNNING";
  const crashed = phase === "CRASHED";
  const betting = phase === "BETTING";

  return (
    <svg className="curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="curveStroke" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent-2)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        <linearGradient id="curveArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(var(--accent-rgb),0.28)" />
          <stop offset="100%" stopColor="rgba(var(--accent-rgb),0)" />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* horizontal gridlines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} className="grid-line" x1="0" y1={H * f} x2={W} y2={H * f} />
      ))}

      {(running || crashed) && (
        <>
          <path d={area} fill="url(#curveArea)" style={{ transition: "none" }} />
          <path d={path} fill="none" stroke={crashed ? "var(--danger)" : "url(#curveStroke)"} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" style={{ transition: "none" }} />
          {running && (
            <g>
              <circle cx={tip[0]} cy={tip[1]} r="11" fill="var(--accent)" opacity="0.25" filter="url(#glow)" />
              <circle cx={tip[0]} cy={tip[1]} r="6" fill="var(--accent)" filter="url(#glow)" />
            </g>
          )}
          {crashed && (<circle cx={tip[0]} cy={tip[1]} r="8" fill="var(--danger)" filter="url(#glow)" />)}
        </>
      )}
    </svg>
  );
}

/* ====================== STAGE (graph + overlays) ====================== */
function Stage({ snap, onOpenFair, cashFlash }) {
  const { phase, multiplier, crashPoint, cfg } = snap;
  const [shakeKey, setShakeKey] = useState(0);
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (phase === "CRASHED" && prevPhase.current === "RUNNING") setShakeKey((k) => k + 1);
    prevPhase.current = phase;
  }, [phase]);

  const running = phase === "RUNNING";
  const crashed = phase === "CRASHED";
  const betting = phase === "BETTING";
  const hash = snap.current?.hash || snap.next?.hash || "";

  return (
    <div className={`stage ${crashed ? "is-crashed flash-crash" : ""}`} key={shakeKey}>
      <div className="fair-badge" onClick={onOpenFair} title="Provably fair — verificar">
        <span className="dot" />
        <span className="txt"><Icon.shield style={{ width: 11, height: 11, verticalAlign: -1, marginRight: 4 }} />SEED <span className="hash">{hash.slice(0, 10)}…</span></span>
      </div>
      <div className="live-badge">
        <span className={`pulse ${betting ? "betting" : ""}`} />
        <span className="txt">{betting ? "Apostas" : running ? "Ao vivo" : "Rodada #" + snap.roundId}</span>
      </div>

      <CrashGraph phase={phase} multiplier={multiplier} crashPoint={crashPoint} growth={cfg.growth} />

      {betting ? (
        <CountdownOverlay endsAt={snap.phaseEndsAt} total={cfg.bettingMs} />
      ) : (
        <div className="mult-readout">
          <div className={`mult-value ${running ? "running" : ""} ${crashed ? "crashed" : ""}`}>
            {multiplier.toFixed(2)}<span style={{ fontSize: "0.5em" }}>×</span>
          </div>
          <div className={`mult-caption ${crashed ? "crashed" : ""}`}>
            {crashed ? "Crash!" : "Subindo"}
          </div>
          {cashFlash > 0 && running && (
            <div className="cashout-flash">+ {fmt(cashFlash)} sacado!</div>
          )}
        </div>
      )}
    </div>
  );
}

function CountdownOverlay({ endsAt, total }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let raf;
    const tick = () => { setNow(Date.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const remain = Math.max(0, endsAt - now);
  const frac = Math.max(0, Math.min(1, remain / total));
  const R = 58, C = 2 * Math.PI * R;
  return (
    <div className="betting-overlay">
      <div className="count-ring">
        <svg viewBox="0 0 132 132">
          <circle className="track" cx="66" cy="66" r={R} />
          <circle className="prog" cx="66" cy="66" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
        </svg>
        <div className="count-num">{(remain / 1000).toFixed(1)}</div>
      </div>
      <div className="betting-label">Faça sua aposta</div>
    </div>
  );
}

/* ====================== HISTORY RAIL ====================== */
function HistoryRail({ history }) {
  return (
    <div className="card card-pad">
      <div className="history-rail">
        <span className="lbl">Últimos</span>
        <div className="history-pills">
          {history.length === 0 && [...Array(10)].map((_, i) => <div key={i} className="skel" style={{ width: 52, height: 28, borderRadius: 100 }} />)}
          {history.map((h) => (
            <span key={h.roundId} className={`pill ${pillClass(h.crashPoint)}`}>{h.crashPoint.toFixed(2)}×</span>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Icon, fmt, pillClass, initials, CrashGraph, Stage, CountdownOverlay, HistoryRail });
