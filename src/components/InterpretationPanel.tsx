import { useEffect, useState } from 'react'
import { loadKey, loadModel } from '../lib/apiKeyStore'
import { generateInterpretation } from '../lib/gemini'
import { buildPrompt, type GaitSummary } from '../lib/gaitSummary'

export function InterpretationPanel({ summary }: { summary: GaitSummary | null }) {
  const [text, setText] = useState<string | null>(null)
  const [modelUsed, setModelUsed] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const stored = loadKey()
  const hasKey = !!stored?.key

  // Se a análise mudar, limpa o texto anterior para não enganar.
  useEffect(() => {
    setText(null)
    setModelUsed(null)
    setError(null)
  }, [summary])

  const generate = async () => {
    if (!summary || !stored) return
    setLoading(true)
    setError(null)
    try {
      const res = await generateInterpretation(stored.key, loadModel(), buildPrompt(summary))
      setText(res.text)
      setModelUsed(res.modelUsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
      setText(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="interpretation">
      <h3>Interpretação (IA)</h3>
      <p className="privacy-note">
        Ao gerar, é enviado para o Google (Gemini) um resumo numérico anónimo da marcha —
        nunca o vídeo nem imagens.
      </p>
      <button onClick={generate} disabled={!hasKey || !summary || loading}>
        {loading ? 'A interpretar…' : text ? 'Regenerar' : 'Gerar interpretação'}
      </button>
      {!hasKey && <p className="interpretation-hint">Configure a chave no Perfil.</p>}
      {error && <p className="error">{error}</p>}
      {text && (
        <div className="interpretation-text">
          <p>{text}</p>
          {modelUsed && <p className="model-used">gerado com {modelUsed}</p>}
        </div>
      )}
    </div>
  )
}
