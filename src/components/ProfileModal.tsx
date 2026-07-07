import { useState } from 'react'
import { loadKey, saveKey, clearKey, loadModel, saveModel } from '../lib/apiKeyStore'
import { listModels } from '../lib/gemini'
import type { ConnectionTestResult, ModelChoice } from '../types'

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey'

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stored = loadKey()
  const [key, setKey] = useState(stored?.key ?? '')
  const [remember, setRemember] = useState(stored?.remembered ?? true)
  const [show, setShow] = useState(false)
  const [model, setModel] = useState<ModelChoice>(loadModel())
  const [test, setTest] = useState<ConnectionTestResult | null>(null)
  const [testing, setTesting] = useState(false)

  if (!open) return null

  const onSave = () => {
    saveKey(key, remember)
    saveModel(model)
    onClose()
  }
  const onClear = () => {
    clearKey()
    setKey('')
    setTest(null)
  }
  const onTest = async () => {
    setTesting(true)
    setTest(await listModels(key))
    setTesting(false)
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Perfil">
      <div className="modal">
        <h2>Perfil — chave Gemini</h2>
        <p>
          Obtenha uma chave gratuita no{' '}
          <a href={AI_STUDIO_URL} target="_blank" rel="noreferrer">Google AI Studio</a>. O
          nível gratuito chega para uso pedagógico.
        </p>

        <label>
          Chave de API
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <button onClick={() => setShow((s) => !s)}>{show ? 'Ocultar' : 'Mostrar'}</button>

        <label>
          Modelo
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="auto">Automático (fallback)</option>
            <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
            <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite</option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          </select>
        </label>

        <button onClick={onTest} disabled={testing || !key}>
          {testing ? 'A testar…' : 'Testar ligação'}
        </button>
        {test && (
          <div className="test-result">
            <p>{test.message}</p>
            <ul>
              {test.models.map((m) => (
                <li key={m.model}>{m.available ? '✓' : '✗'} {m.model}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Lembrar chave neste dispositivo
        </label>

        <p className="modal-security">
          A chave fica guardada neste navegador. Use a sua própria chave e apague-a em
          computadores partilhados.
        </p>

        <div className="modal-actions">
          <button onClick={onSave}>Guardar</button>
          <button onClick={onClear}>Apagar chave</button>
          <button onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
