let _riseEl: HTMLAudioElement | null = null
let _boomEl: HTMLAudioElement | null = null

function _carregarClipes() {
  if (typeof Audio === 'undefined') return
  if (!_riseEl) { _riseEl = new Audio('/sounds/rise.mp3'); _riseEl.loop = true; _riseEl.volume = 0.45 }
  if (!_boomEl) { _boomEl = new Audio('/sounds/boom.mp3'); _boomEl.volume = 0.8 }
}

export const Sound = {
  ctx: null as AudioContext | null,
  on: false,

  ensure() {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch {}
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {})
  },

  init() {
    if (typeof window === 'undefined') return
    const unlock = () => { if (this.on) this.ensure() }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
  },

  blip(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.06) {
    if (!this.on || !this.ctx) return
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    try {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.type = type
      o.frequency.value = freq
      o.connect(g)
      g.connect(this.ctx.destination)
      const t = this.ctx.currentTime
      g.gain.setValueAtTime(vol, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.start(t)
      o.stop(t + dur)
    } catch {}
  },

  bet() {
    this.blip(440, 0.08, 'sine', 0.05)
  },

  cashout() {
    this.blip(660, 0.12, 'triangle', 0.08)
    setTimeout(() => this.blip(990, 0.16, 'triangle', 0.08), 90)
  },

  crash() {
    this.blip(140, 0.4, 'sawtooth', 0.07)
  },

  iniciarSubida() {
    _carregarClipes()
    if (!_riseEl) return
    try { _riseEl.currentTime = 0; _riseEl.play().catch(() => {}) } catch {}
  },

  pararSubida() {
    if (_riseEl) { try { _riseEl.pause(); _riseEl.currentTime = 0 } catch {} }
  },

  tocarExplosao() {
    this.pararSubida()
    _carregarClipes()
    if (!_boomEl) return
    try { _boomEl.currentTime = 0; _boomEl.play().catch(() => {}) } catch {}
  },
}
