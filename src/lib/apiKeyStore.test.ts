import { describe, it, expect, beforeEach } from 'vitest'
import { saveKey, loadKey, clearKey, saveModel, loadModel } from './apiKeyStore'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('apiKeyStore', () => {
  it('guarda em localStorage quando "lembrar" é true', () => {
    saveKey('abc', true)
    expect(loadKey()).toEqual({ key: 'abc', remembered: true })
    expect(localStorage.getItem('gait-gemini-key')).toBe('abc')
    expect(sessionStorage.getItem('gait-gemini-key')).toBeNull()
  })

  it('guarda em sessionStorage quando "lembrar" é false', () => {
    saveKey('xyz', false)
    expect(loadKey()).toEqual({ key: 'xyz', remembered: false })
    expect(sessionStorage.getItem('gait-gemini-key')).toBe('xyz')
    expect(localStorage.getItem('gait-gemini-key')).toBeNull()
  })

  it('loadKey devolve null quando não há chave', () => {
    expect(loadKey()).toBeNull()
  })

  it('clearKey remove dos dois armazenamentos', () => {
    saveKey('abc', true)
    clearKey()
    expect(loadKey()).toBeNull()
  })

  it('guarda e lê a escolha de modelo (default auto)', () => {
    expect(loadModel()).toBe('auto')
    saveModel('gemini-2.5-flash')
    expect(loadModel()).toBe('gemini-2.5-flash')
  })
})
