const CRESCIMENTO_PADRAO = 0.00006
const LARGURA_SVG        = 1000
const ALTURA_SVG         = 562
const PAD_INFERIOR       = 8
const PAD_SUPERIOR       = 40
const NUM_PONTOS         = 64

export interface ResultadoCurva {
  path:   string
  area:   string
  tip:    [number, number]
  angulo: number
}

export function computarCurva(
  multiplicador: number,
  crescimento = CRESCIMENTO_PADRAO,
): ResultadoCurva {
  const M       = Math.max(1.0001, multiplicador)
  const elapsed = Math.log(M) / crescimento
  const janela  = Math.max(elapsed / 0.8, 2600)
  const yMax    = Math.max(1.9, M * 1.28)
  const pontos: [number, number][] = []

  for (let i = 0; i <= NUM_PONTOS; i++) {
    const t    = (elapsed * i) / NUM_PONTOS
    const mult = Math.exp(crescimento * t)
    const x    = (t / janela) * LARGURA_SVG
    const y    = ALTURA_SVG - PAD_INFERIOR - ((mult - 1) / (yMax - 1)) * (ALTURA_SVG - PAD_INFERIOR - PAD_SUPERIOR)
    pontos.push([x, y])
  }

  const ultimo   = pontos[pontos.length - 1]
  const anterior = pontos[pontos.length - 2] ?? ([0, ALTURA_SVG] as [number, number])

  const d = pontos
    .map((p, i) => (i === 0 ? `M ${p[0].toFixed(1)} ${p[1].toFixed(1)}` : `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`))
    .join(' ')
  const area   = `${d} L ${ultimo[0].toFixed(1)} ${ALTURA_SVG} L 0 ${ALTURA_SVG} Z`
  const angulo = (Math.atan2(ultimo[1] - anterior[1], ultimo[0] - anterior[0]) * 180) / Math.PI

  return { path: d, area, tip: ultimo, angulo }
}
