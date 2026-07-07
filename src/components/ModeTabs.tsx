export type Mode = 'live' | 'review'

const TABS: { key: Mode; label: string }[] = [
  { key: 'live', label: 'Ao Vivo' },
  { key: 'review', label: 'Rever' },
]

export function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <nav className="mode-tabs" aria-label="Modo">
      {TABS.map(({ key, label }) => (
        <button key={key} aria-pressed={mode === key} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </nav>
  )
}
