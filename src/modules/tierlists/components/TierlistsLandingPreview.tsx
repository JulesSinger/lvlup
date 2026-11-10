/** L'aperçu de la page d'accueil publique : une tier list en miniature, sans données. */
const ROWS: { label: string; color: string; items: string[] }[] = [
  { label: 'S', color: 'red', items: ['Ahri', 'Jinx'] },
  { label: 'A', color: 'orange', items: ['Lux', 'Ezreal', 'Thresh'] },
  { label: 'B', color: 'yellow', items: ['Garen'] },
  { label: 'C', color: 'green', items: [] },
];

export function TierlistsLandingPreview() {
  return (
    <div className="tierlists-preview" aria-hidden="true">
      {ROWS.map((r) => (
        <div key={r.label} className="tierlists-preview-row" style={{ ['--tierlists-color' as string]: `var(--${r.color})` }}>
          <span className="tierlists-preview-label">{r.label}</span>
          {r.items.map((i) => (
            <span key={i} className="tierlists-preview-chip">
              {i}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
