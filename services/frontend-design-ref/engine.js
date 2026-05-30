/* ============================================================================
   CrashEngine — domain + application logic for the crash game.
   Pure JS, framework-agnostic. The React layer only subscribes & renders.

   Responsibilities:
     - Round lifecycle / phases (BETTING -> RUNNING -> CRASHED -> ...)
     - Multiplier curve (continuous growth from 1.00x)
     - Provably-fair seed/hash generation + crash-point derivation
     - Simulated "other players" (bots) placing bets and cashing out
     - Bet validation rules (min/max, balance, one bet per round, phase gates)
   ========================================================================== */

(function () {
  "use strict";

  // ---- Config (defaults; can be overridden via constructor) ----------------
  const DEFAULTS = {
    bettingMs: 10000,     // betting window
    crashedMs: 3500,      // result display before next round
    growth: 0.000098,     // multiplier = e^(growth * elapsedMs)
    tickMs: 50,           // bot cashout resolution
    minBet: 1,
    maxBet: 1000,
    houseEdge: 0.01,
  };

  const PHASE = { BETTING: "BETTING", RUNNING: "RUNNING", CRASHED: "CRASHED" };

  // ---- Provably-fair helpers ------------------------------------------------
  function randomHex(bytes) {
    const a = new Uint8Array(bytes);
    crypto.getRandomValues(a);
    return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function sha256Hex(message) {
    const data = new TextEncoder().encode(message);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Derive a crash point from a hash. Standard "instant-crash + heavy tail" model.
  // ~ (1 - houseEdge) expected, with a small chance of an instant 1.00x bust.
  function crashFromHash(hashHex, houseEdge) {
    // 3% instant crash
    const intForBust = parseInt(hashHex.slice(0, 8), 16);
    if (intForBust % 33 === 0) return 1.0;
    const h = parseInt(hashHex.slice(0, 13), 16);
    const e = Math.pow(2, 52);
    let result = Math.floor(((100 - houseEdge * 100) * e - h) / (e - h)) / 100;
    return Math.max(1.0, result);
  }

  // ---- Bot name pool --------------------------------------------------------
  const BOT_NAMES = [
    "luan_fps", "marina.07", "zé_droid", "CryptoKai", "bianca_m", "rogerinho",
    "NovaStrike", "duda.exe", "thalles99", "vipera", "joaopedro", "mell_rocha",
    "Kobra", "ane.lima", "ghost_br", "tiagoo", "Renata_S", "pixelwolf",
    "carol.dev", "Bruno_TT", "isaqueX", "luma_neon", "felipe_z", "drika88",
    "MaverickBR", "samuca", "yasmin.r", "node_runner", "guh_silva", "Vitoria_L",
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ---- Engine ---------------------------------------------------------------
  class CrashEngine {
    constructor(config = {}) {
      this.cfg = { ...DEFAULTS, ...config };
      this.listeners = new Set();
      this.history = [];          // past crash points (newest first)
      this.roundId = 0;
      this.phase = PHASE.CRASHED;
      this.multiplier = 1.0;
      this.crashPoint = 1.0;
      this.bets = [];             // current round bets (players + bots)
      this.next = null;           // precomputed { serverSeed, hash, clientSeed, nonce }
      this.current = null;        // revealed fairness of running/last round
      this.phaseEndsAt = 0;
      this._raf = null;
      this._timers = [];
      this._running = false;
    }

    // -- pub/sub --
    subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    _emit(type, payload) {
      const snap = this.snapshot();
      this.listeners.forEach((fn) => fn({ type, ...payload, state: snap }));
    }
    snapshot() {
      return {
        roundId: this.roundId,
        phase: this.phase,
        multiplier: this.multiplier,
        crashPoint: this.crashPoint,
        bets: [...this.bets],
        history: [...this.history],
        phaseEndsAt: this.phaseEndsAt,
        next: this.next ? { hash: this.next.hash } : null,
        current: this.current,
        cfg: this.cfg,
      };
    }

    setConfig(patch) { this.cfg = { ...this.cfg, ...patch }; }

    // -- lifecycle --
    async start() {
      if (this._running) return;
      this._running = true;
      await this._prepareNext();
      this._beginBetting();
    }
    stop() {
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._timers.forEach(clearTimeout);
      this._timers = [];
    }
    _later(fn, ms) { const t = setTimeout(fn, ms); this._timers.push(t); return t; }

    async _prepareNext() {
      const serverSeed = randomHex(32);
      const clientSeed = randomHex(8);
      const nonce = this.roundId + 1;
      const hash = await sha256Hex(`${serverSeed}:${clientSeed}:${nonce}`);
      this.next = { serverSeed, clientSeed, nonce, hash };
    }

    _beginBetting() {
      this.roundId += 1;
      this.phase = PHASE.BETTING;
      this.multiplier = 1.0;
      this.bets = [];
      this.current = { hash: this.next.hash, revealed: false };
      this.phaseEndsAt = Date.now() + this.cfg.bettingMs;
      // crash point is locked in NOW (committed), revealed after crash
      this._pendingSeed = this.next;
      this.crashPoint = crashFromHash(this.next.hash, this.cfg.houseEdge);
      this._emit("betting_start", {});

      // stream bots placing bets across the window
      this._scheduleBotBets();

      this._later(() => this._beginRound(), this.cfg.bettingMs);
    }

    _scheduleBotBets() {
      const n = 4 + Math.floor(Math.random() * 9); // 4..12 bots
      for (let i = 0; i < n; i++) {
        const delay = Math.random() * (this.cfg.bettingMs - 800);
        this._later(() => {
          if (this.phase !== PHASE.BETTING) return;
          const amount = +(this.cfg.minBet + Math.random() * 120).toFixed(2);
          // bot's hidden auto-cashout target (skewed toward low multipliers)
          const target = +(1.15 + Math.pow(Math.random(), 2.2) * 12).toFixed(2);
          this.bets.push({
            id: "bot-" + this.roundId + "-" + i,
            user: pick(BOT_NAMES),
            amount,
            isPlayer: false,
            _target: target,
            status: "placed",     // placed -> won | lost
            cashoutAt: null,
            payout: 0,
          });
          this._emit("bet_placed", {});
        }, delay);
      }
    }

    _beginRound() {
      this.phase = PHASE.RUNNING;
      this.startedAt = performance.now();
      this.phaseEndsAt = 0;
      this._emit("round_start", {});
      const loop = () => {
        if (this.phase !== PHASE.RUNNING) return;
        const elapsed = performance.now() - this.startedAt;
        const m = Math.exp(this.cfg.growth * elapsed);
        if (m >= this.crashPoint) {
          this.multiplier = this.crashPoint;
          this._crash();
          return;
        }
        this.multiplier = m;
        // resolve bot auto-cashouts
        for (const b of this.bets) {
          if (!b.isPlayer && b.status === "placed" && this.multiplier >= b._target) {
            b.status = "won";
            b.cashoutAt = b._target;
            b.payout = +(b.amount * b._target).toFixed(2);
            this._emit("cashout", { bet: b });
          }
        }
        this._emit("tick", {});
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    _crash() {
      this.phase = PHASE.CRASHED;
      if (this._raf) cancelAnimationFrame(this._raf);
      // anyone still "placed" loses
      for (const b of this.bets) {
        if (b.status === "placed") { b.status = "lost"; b.payout = 0; }
      }
      // reveal fairness
      const seed = this._pendingSeed;
      this.current = {
        hash: seed.hash,
        revealed: true,
        serverSeed: seed.serverSeed,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
        crashPoint: this.crashPoint,
      };
      this.history.unshift({ roundId: this.roundId, crashPoint: this.crashPoint });
      if (this.history.length > 40) this.history.pop();
      this.phaseEndsAt = Date.now() + this.cfg.crashedMs;
      this._emit("crash", { crashPoint: this.crashPoint });

      // prepare next round's seed, then loop
      this._prepareNext().then(() => {
        if (!this._running) return;
        this._later(() => this._beginBetting(), this.cfg.crashedMs);
      });
    }

    // -- player actions (return {ok, error}) --
    placeBet(user, amount) {
      if (this.phase !== PHASE.BETTING)
        return { ok: false, code: "PHASE", error: "Apostas fechadas — aguarde a próxima rodada." };
      if (this.bets.some((b) => b.isPlayer))
        return { ok: false, code: "DUP", error: "Você já apostou nesta rodada." };
      if (!(amount >= this.cfg.minBet))
        return { ok: false, code: "MIN", error: `Aposta mínima é ${this.cfg.minBet.toFixed(2)}.` };
      if (amount > this.cfg.maxBet)
        return { ok: false, code: "MAX", error: `Aposta máxima é ${this.cfg.maxBet.toFixed(2)}.` };
      const bet = {
        id: "you-" + this.roundId,
        user, amount: +amount.toFixed(2),
        isPlayer: true, status: "placed",
        cashoutAt: null, payout: 0, autoTarget: null,
      };
      this.bets.push(bet);
      this._emit("bet_placed", { bet });
      return { ok: true, bet };
    }

    cancelBet() {
      if (this.phase !== PHASE.BETTING)
        return { ok: false, code: "PHASE", error: "Só é possível cancelar durante as apostas." };
      const i = this.bets.findIndex((x) => x.isPlayer);
      if (i < 0) return { ok: false, code: "NOBET", error: "Sem aposta para cancelar." };
      const [removed] = this.bets.splice(i, 1);
      this._emit("bet_cancelled", { bet: removed });
      return { ok: true, bet: removed };
    }

    setAutoCashout(target) {
      const b = this.bets.find((x) => x.isPlayer && x.status === "placed");
      if (b) b.autoTarget = target;
    }

    cashOut() {
      if (this.phase !== PHASE.RUNNING)
        return { ok: false, code: "PHASE", error: "Cash out só durante a rodada ativa." };
      const b = this.bets.find((x) => x.isPlayer && x.status === "placed");
      if (!b) return { ok: false, code: "NOBET", error: "Sem aposta ativa para sacar." };
      b.status = "won";
      b.cashoutAt = +this.multiplier.toFixed(2);
      b.payout = +(b.amount * b.cashoutAt).toFixed(2);
      this._emit("cashout", { bet: b, isPlayer: true });
      return { ok: true, bet: b };
    }

    getPlayerBet() { return this.bets.find((x) => x.isPlayer) || null; }
  }

  window.CrashEngine = CrashEngine;
  window.CRASH_PHASE = PHASE;
})();
