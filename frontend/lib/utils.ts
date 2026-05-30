export const fmt = (n: number) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const centavosParaReais = (centavos: number) => fmt(centavos / 100)

export const pillClass = (m: number) =>
  m < 2 ? 'low' : m < 5 ? 'mid' : m < 20 ? 'high' : 'epic'

export const initials = (name: string) =>
  name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase()

export const parseBrazilian = (s: string): number => {
  const cleaned = String(s).replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}
