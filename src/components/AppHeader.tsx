export function AppHeader({ onOpenProfile }: { onOpenProfile: () => void }) {
  return (
    <header className="app-header">
      <div className="app-brand">
        <span className="app-logo" aria-hidden="true">🚶</span>
        <span className="app-name">Análise de Marcha</span>
      </div>
      <button className="profile-button" onClick={onOpenProfile}>⚙️ Perfil</button>
    </header>
  )
}
