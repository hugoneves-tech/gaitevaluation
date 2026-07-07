import type { ModelChoice, StoredKey } from '../types'

const KEY = 'gait-gemini-key'
const MODEL = 'gait-gemini-model'

/** Guarda a chave em localStorage (lembrar) ou sessionStorage (só a sessão). */
export function saveKey(key: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(KEY, key)
    sessionStorage.removeItem(KEY)
  } else {
    sessionStorage.setItem(KEY, key)
    localStorage.removeItem(KEY)
  }
}

/** Lê a chave (localStorage tem prioridade); null se não existir. */
export function loadKey(): StoredKey | null {
  const local = localStorage.getItem(KEY)
  if (local !== null) return { key: local, remembered: true }
  const session = sessionStorage.getItem(KEY)
  if (session !== null) return { key: session, remembered: false }
  return null
}

/** Remove a chave dos dois armazenamentos. */
export function clearKey(): void {
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(KEY)
}

/** Guarda a escolha de modelo (persistente). */
export function saveModel(choice: ModelChoice): void {
  localStorage.setItem(MODEL, choice)
}

/** Lê a escolha de modelo; 'auto' por omissão. */
export function loadModel(): ModelChoice {
  return localStorage.getItem(MODEL) ?? 'auto'
}
