/* ============================================================================
   app.jsx — application wiring: auth, engine subscription, balance, toasts,
   session stats, dynamic theme tweaks. Mounts the full game screen.
   ========================================================================== */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- dynamic theme presets (the "tema dinâmico") ---------- */
const THEMES = {
  "#2bf5b0": { a2: "#16c8e8", a2rgb: "22,200,232", rgb: "43,245,176", ink: "#04130d" },   // Mint (default)
  "#3e7fe9": { a2: "#64a0ff", a2rgb: "100,160,255", rgb: "62,127,233", ink: "#020912" },   // Electric Blue (design system)
  "#c6f135": { a2: "#7cf53e", a2rgb: "124,245,62", rgb: "198,241,53", ink: "#141a02" },     // Lime
  "#ff4dd2": { a2: "#a36bff", a2rgb: "163,107,255", rgb: "255,77,210", ink: "#16021a" },     // Magenta
  "#ffb020": { a2: "#ff7a2e", a2rgb: "255,122,46", rgb: "255,176,32", ink: "#1a1200" },       // Gold
};
function applyTheme(hex) {
  const t = THEMES[hex] || THEMES["#2bf5b0"];
  const r = document.documentElement.style;
  r.setProperty("--accent", hex);
  r.setProperty("--accent-rgb", t.rgb);
  r.setProperty("--accent-2", t.a2);
  r.setProperty("--accent-2-rgb", t.a2rgb);
  r.setProperty("--accent-ink", t.ink);
}

/* ---------- tiny sound engine (optional, off by default) ---------- */
const Sound = {
  ctx: null, on: false,
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (this.ctx && this.ctx.state === "suspended") { this.ctx.resume().catch(() => {}); }
  },
  blip(freq, dur, type = "sine", vol = 0.06) {
    if (!this.on || !this.ctx) return;
    if (this.ctx.state === "suspended") { this.ctx.resume().catch(() => {}); }
    try {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq; o.connect(g); g.connect(this.ctx.destination);
      const t = this.ctx.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  },
  cashout() { this.blip(660, 0.12, "triangle", 0.08); setTimeout(() => this.blip(990, 0.16, "triangle", 0.08), 90); },
  crash() { this.blip(140, 0.4, "sawtooth", 0.07); },
  bet() { this.blip(440, 0.08, "sine", 0.05); },
};

/* ---------- auth ---------- */
function readAuth() {
  try { return JSON.parse(localStorage.getItem("crash_auth") || "null"); } catch (e) { return null; }
}
function decodeUser(token) {
  try { const p = JSON.parse(atob(token.split(".")[1])); return p.preferred_username || p.name || "jogador"; }
  catch (e) { return "jogador"; }
}

/* ====================== APP ====================== */
function App() {
  const auth = useMemo(readAuth, []);
  useEffect(() => { if (!auth) window.location.replace("login.html"); }, [auth]);

  const username = auth ? decodeUser(auth.token) : "jogador";

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  useEffect(() => { applyTheme(t.themeAccent); }, [t.themeAccent]);
  useEffect(() => {
    Sound.on = !!t.sound;
    if (t.sound) { Sound.ensure(); Sound.blip(880, 0.1, "sine", 0.06); } // confirmation chime
  }, [t.sound]);
  // unlock WebAudio on the first user gesture (browsers require it)
  useEffect(() => {
    const unlock = () => { if (Sound.on) Sound.ensure(); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

  const engineRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [balance, setBalance] = useState(() => {
    const a = readAuth(); return a && typeof a.balance === "number" ? a.balance : 1000;
  });
  const balRef = useRef(balance);
  balRef.current = balance;
  const [toasts, setToasts] = useState([]);
  const [cashFlash, setCashFlash] = useState(0);
  const [showFair, setShowFair] = useState(false);
  const [auto, setAuto] = useState(false);
  const [autoTarget, setAutoTarget] = useState(2.0);
  const autoRef = useRef({ auto, autoTarget });
  autoRef.current = { auto, autoTarget };

  const [stats, setStats] = useState({ pnl: 0, rounds: 0, best: 0, wagered: 0 });

  /* auto-bet config + runtime */
  const [ab, setAb] = useState({ on: false, base: 10, target: 2.0, strategy: "fixed", onLoss: 2.0, rounds: 0, stopLoss: 0, stopWin: 0 });
  const abRun = useRef({ active: false, nextStake: 10, pnl: 0, roundsLeft: Infinity });
  const [abTick, setAbTick] = useState(0); // force re-render of runtime line
  const abRef = useRef(ab); abRef.current = ab;

  /* persist balance */
  useEffect(() => {
    const a = readAuth() || {}; a.balance = balance; localStorage.setItem("crash_auth", JSON.stringify(a));
  }, [balance]);

  /* toasts */
  const pushToast = useCallback((kind, title, desc) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, kind, title, desc }]);
    setTimeout(() => dismiss(id), 4200);
  }, []);
  const dismiss = useCallback((id) => {
    setToasts((ts) => ts.map((x) => (x.id === id ? { ...x, out: true } : x)));
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 320);
  }, []);

  /* engine setup */
  useEffect(() => {
    const eng = new CrashEngine({ bettingMs: (TWEAK_DEFAULTS.bettingSeconds || 10) * 1000 });
    engineRef.current = eng;
    const unsub = eng.subscribe((evt) => {
      setSnap(evt.state);
      // auto-place bet when a new betting phase opens (auto-bet)
      if (evt.type === "betting_start" && abRun.current.active) {
        const stake = +abRun.current.nextStake.toFixed(2);
        if (stake > balRef.current) {
          stopAutoBet("Saldo insuficiente para a próxima aposta.");
        } else if (!eng.getPlayerBet()) {
          handleBet(stake, true);
        }
      }
      // auto-cashout (manual toggle OR auto-bet uses the configured target)
      if (evt.type === "tick") {
        const useAuto = autoRef.current.auto || abRun.current.active;
        const tgt = abRun.current.active ? abRef.current.target : autoRef.current.autoTarget;
        const pb = eng.getPlayerBet();
        if (useAuto && pb && pb.status === "placed" && eng.multiplier >= tgt) {
          handleCashOut(true);
        }
      }
      if (evt.type === "crash") {
        const pb = eng.getPlayerBet();
        if (pb) {
          setStats((s) => ({ ...s, rounds: s.rounds + 1 }));
          if (pb.status === "lost") {
            Sound.crash();
            pushToast("error", `Crash em ${evt.crashPoint.toFixed(2)}×`, `Você perdeu R$ ${fmt(pb.amount)} nesta rodada.`);
          }
          // resolve auto-bet strategy for next round
          if (abRun.current.active) resolveAutoBet(pb);
        }
      }
    });
    eng.start();
    return () => { unsub(); eng.stop(); };
  }, []);

  /* apply tweak changes to engine config */
  useEffect(() => { engineRef.current && engineRef.current.setConfig({ bettingMs: t.bettingSeconds * 1000 }); }, [t.bettingSeconds]);

  const playerBet = snap ? snap.bets.find((b) => b.isPlayer) || null : null;
  const potential = playerBet && snap ? playerBet.amount * snap.multiplier : 0;

  /* actions */
  const handleBet = useCallback((amount, quiet) => {
    const eng = engineRef.current;
    if (amount > balRef.current) { if (!quiet) pushToast("error", "Saldo insuficiente", `Você tem R$ ${fmt(balRef.current)} disponível.`); return; }
    const res = eng.placeBet(username, amount);
    if (!res.ok) { if (!quiet) pushToast("error", "Aposta rejeitada", res.error); return; }
    setBalance((b) => b - amount);
    setStats((s) => ({ ...s, pnl: s.pnl - amount, wagered: s.wagered + amount }));
    Sound.bet();
    if (!quiet) pushToast("success", "Aposta confirmada", `R$ ${fmt(amount)} na rodada #${eng.roundId}.`);
  }, [username]);

  const handleCancel = useCallback(() => {
    const eng = engineRef.current;
    const pb = eng.getPlayerBet();
    const res = eng.cancelBet();
    if (res.ok && pb) {
      setBalance((b) => b + pb.amount);
      setStats((s) => ({ ...s, pnl: s.pnl + pb.amount, wagered: Math.max(0, s.wagered - pb.amount) }));
      pushToast("info", "Aposta cancelada", `R$ ${fmt(pb.amount)} devolvido.`);
    }
  }, []);

  const handleCashOut = useCallback((isAuto) => {
    const eng = engineRef.current;
    const res = eng.cashOut();
    if (!res.ok) { if (!isAuto) pushToast("error", "Não foi possível sacar", res.error); return; }
    const b = res.bet;
    setBalance((bal) => bal + b.payout);
    setStats((s) => ({ ...s, pnl: s.pnl + b.payout, best: Math.max(s.best, b.cashoutAt) }));
    setCashFlash(b.payout);
    setTimeout(() => setCashFlash(0), 1600);
    Sound.cashout();
    pushToast("gold", `Sacou em ${b.cashoutAt.toFixed(2)}×${isAuto ? " (auto)" : ""}`, `+ R$ ${fmt(b.payout)} creditado.`);
  }, []);

  /* ---------- auto-bet controller ---------- */
  const startAutoBet = useCallback(() => {
    const c = abRef.current;
    abRun.current = { active: true, nextStake: c.base, pnl: 0, roundsLeft: c.rounds > 0 ? c.rounds : Infinity };
    setAb((p) => ({ ...p, on: true }));
    setAbTick((x) => x + 1);
    pushToast("info", "Auto-bet iniciado", `${c.strategy === "martingale" ? "Martingale" : "Valor fixo"} · base R$ ${fmt(c.base)} @ ${c.target.toFixed(2)}×`);
  }, []);

  const stopAutoBet = useCallback((reason) => {
    if (!abRun.current.active) return;
    const pnl = abRun.current.pnl;
    abRun.current.active = false;
    setAb((p) => ({ ...p, on: false }));
    setAbTick((x) => x + 1);
    pushToast(reason ? "error" : "info", "Auto-bet encerrado", `${reason ? reason + " " : ""}Resultado: ${pnl >= 0 ? "+" : "−"} R$ ${fmt(Math.abs(pnl))}.`);
  }, []);

  const resolveAutoBet = useCallback((pb) => {
    const c = abRef.current;
    const r = abRun.current;
    const won = pb.status === "won";
    const roundPnl = won ? pb.payout - pb.amount : -pb.amount;
    r.pnl += roundPnl;
    // next stake
    if (won) r.nextStake = c.base;
    else r.nextStake = c.strategy === "martingale" ? +(pb.amount * c.onLoss).toFixed(2) : c.base;
    r.roundsLeft = r.roundsLeft === Infinity ? Infinity : r.roundsLeft - 1;
    setAbTick((x) => x + 1);
    // stop conditions
    if (r.roundsLeft <= 0) return stopAutoBet("Rodadas concluídas.");
    if (c.stopWin > 0 && r.pnl >= c.stopWin) return stopAutoBet("Stop-win atingido. 🎉");
    if (c.stopLoss > 0 && r.pnl <= -c.stopLoss) return stopAutoBet("Stop-loss atingido.");
    if (r.nextStake > balRef.current) return stopAutoBet("Saldo insuficiente.");
  }, []);

  const toggleAutoBet = useCallback(() => {
    if (abRun.current.active) stopAutoBet();
    else startAutoBet();
  }, []);

  if (!snap) return <BootScreen />;

  return (
    <div className="app">
      <div className="bg-ambient" />
      <Topbar username={username} balance={balance} onLogout={() => { localStorage.removeItem("crash_auth"); window.location.replace("login.html"); }} />

      <div className="layout">
        <div className="stage-col">
          <HistoryRail history={snap.history} />
          <Stage snap={snap} onOpenFair={() => setShowFair(true)} cashFlash={cashFlash} />
        </div>

        <div className="controls-col">
          <BetControls
            snap={snap} balance={balance} playerBet={playerBet} potential={potential}
            onBet={handleBet} onCancel={handleCancel} onCashOut={() => handleCashOut(false)}
            auto={auto} setAuto={setAuto} autoTarget={autoTarget} setAutoTarget={setAutoTarget}
          />
          {t.showAutoBet && (
            <div style={{ marginTop: 16 }}>
              <AutoBetPanel cfg={ab} setCfg={setAb} running={abRun.current.active} runtime={abRun.current}
                onToggle={toggleAutoBet} balance={balance} minBet={snap.cfg.minBet} maxBet={snap.cfg.maxBet} />
            </div>
          )}
        </div>

        <div className="side-col">
          {t.showStats && <SessionStats stats={stats} />}
          {t.showLeaderboard && <Leaderboard username={username} sessionPnl={stats.pnl} />}
          <BetsList bets={snap.bets} phase={snap.phase} />
        </div>
      </div>

      <Toasts toasts={toasts} dismiss={dismiss} />
      {showFair && <FairModal snap={snap} onClose={() => setShowFair(false)} />}

      <TweaksPanel>
        <TweakSection label="Tema dinâmico" />
        <TweakColor label="Cor de acento" value={t.themeAccent}
          options={["#2bf5b0", "#3e7fe9", "#c6f135", "#ff4dd2", "#ffb020"]}
          onChange={(v) => setTweak("themeAccent", v)} />
        <TweakSection label="Rodada" />
        <TweakSlider label="Janela de apostas" value={t.bettingSeconds} min={5} max={20} step={1} unit="s"
          onChange={(v) => setTweak("bettingSeconds", v)} />
        <TweakToggle label="Painel de sessão" value={t.showStats} onChange={(v) => setTweak("showStats", v)} />
        <TweakToggle label="Auto-bet (Martingale)" value={t.showAutoBet} onChange={(v) => setTweak("showAutoBet", v)} />
        <TweakToggle label="Leaderboard" value={t.showLeaderboard} onChange={(v) => setTweak("showLeaderboard", v)} />
        <TweakToggle label="Efeitos sonoros" value={t.sound} onChange={(v) => setTweak("sound", v)} />
      </TweaksPanel>
    </div>
  );
}

/* ====================== TOPBAR ====================== */
function Topbar({ username, balance, onLogout }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo"><Icon.rocket style={{ color: "var(--accent-ink)" }} /></span>
        <span>NOVA<span className="x">X</span></span>
      </div>
      <div className="topbar-right">
        <div className="balance-chip">
          <div>
            <div className="bal-label">Saldo</div>
            <div className="bal-val"><span className="cur">R$</span>{fmt(balance)}</div>
          </div>
          <div className="avatar">{initials(username)}</div>
          <div className="user-meta">
            <span className="uname">{username}</span>
            <span className="ulabel">via JWT</span>
          </div>
        </div>
        <button className="logout-btn" title="Sair" onClick={onLogout}><Icon.logout style={{ width: 17, height: 17 }} /></button>
      </div>
    </header>
  );
}

/* ====================== BOOT / LOADING ====================== */
function BootScreen() {
  return (
    <div className="app">
      <div className="bg-ambient" />
      <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="skel" style={{ width: 240, height: 240, borderRadius: 24, margin: "0 auto 20px" }} />
          <div className="mono" style={{ color: "var(--fg-3)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 12 }}>Conectando ao servidor de jogo…</div>
        </div>
      </div>
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "themeAccent": "#2bf5b0",
  "bettingSeconds": 10,
  "showStats": true,
  "showAutoBet": true,
  "showLeaderboard": true,
  "sound": false
}/*EDITMODE-END*/;

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
