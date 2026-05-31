import { describe, it, expect } from 'bun:test'
import { fmt, centavosParaReais, pillClass, initials, parseBrazilian } from '../lib/utils'

describe('fmt', () => {
  it('formata inteiro com duas casas decimais', () => {
    expect(fmt(10)).toBe('10,00')
  })
  it('formata valor com centavos', () => {
    expect(fmt(1.5)).toBe('1,50')
  })
  it('formata zero', () => {
    expect(fmt(0)).toBe('0,00')
  })
  it('formata valores grandes com separador de milhar', () => {
    expect(fmt(1000)).toBe('1.000,00')
  })
})

describe('centavosParaReais', () => {
  it('converte 100 centavos em 1 real', () => {
    expect(centavosParaReais(100)).toBe('1,00')
  })
  it('converte 1_000_000 centavos em R$ 10.000,00', () => {
    expect(centavosParaReais(1_000_000)).toBe('10.000,00')
  })
  it('converte 0 centavos', () => {
    expect(centavosParaReais(0)).toBe('0,00')
  })
  it('converte 150 centavos em 1,50', () => {
    expect(centavosParaReais(150)).toBe('1,50')
  })
})

describe('pillClass', () => {
  it('retorna low para multiplicador < 2', () => {
    expect(pillClass(1.5)).toBe('low')
    expect(pillClass(1.0)).toBe('low')
  })
  it('retorna mid para 2 ≤ m < 5', () => {
    expect(pillClass(2)).toBe('mid')
    expect(pillClass(4.99)).toBe('mid')
  })
  it('retorna high para 5 ≤ m < 20', () => {
    expect(pillClass(5)).toBe('high')
    expect(pillClass(19.9)).toBe('high')
  })
  it('retorna epic para m ≥ 20', () => {
    expect(pillClass(20)).toBe('epic')
    expect(pillClass(100)).toBe('epic')
  })
})

describe('initials', () => {
  it('extrai iniciais de um nome simples', () => {
    expect(initials('player')).toBe('PL')
  })
  it('remove caracteres especiais', () => {
    expect(initials('user.123')).toBe('US')
  })
  it('retorna no máximo 2 caracteres em maiúsculo', () => {
    expect(initials('abcdef')).toBe('AB')
  })
  it('lida com string curta', () => {
    expect(initials('a')).toBe('A')
  })
})

describe('parseBrazilian', () => {
  it('converte formato brasileiro para número', () => {
    expect(parseBrazilian('10,00')).toBe(10)
  })
  it('lida com separador de milhar', () => {
    expect(parseBrazilian('1.000,50')).toBe(1000.5)
  })
  it('retorna 0 para string inválida', () => {
    expect(parseBrazilian('abc')).toBe(0)
  })
  it('lida com número sem vírgula', () => {
    expect(parseBrazilian('25')).toBe(25)
  })
})
