import { useEffect, useState } from 'react';
import type { SportSettings } from '../lib/types';
import { validateSettings } from '../lib/validation';
import { hrZones, ZONE_LABELS } from '../lib/zones';

/**
 * La fréquence cardiaque du compte (docs/etude-sport.md §12) : FC maximale et
 * de repos, d'où les zones. La FC maximale vue dans les sorties est proposée,
 * jamais imposée. Des chiffres et des zones, pas un conseil de santé.
 */
export function HeartRateCard({ settings, suggestedMax, onSave }: {
  settings: SportSettings;
  suggestedMax: number | null;
  onSave: (patch: Pick<SportSettings, 'hrMax' | 'hrRest'>) => Promise<void>;
}) {
  const [max, setMax] = useState(settings.hrMax?.toString() ?? '');
  const [rest, setRest] = useState(settings.hrRest?.toString() ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setMax(settings.hrMax?.toString() ?? '');
    setRest(settings.hrRest?.toString() ?? '');
  }, [settings.hrMax, settings.hrRest]);

  const zones = hrZones(settings);
  const toNumber = (s: string) => (s.trim() ? Number(s) : null);

  async function save() {
    const patch = { hrMax: toNumber(max), hrRest: toNumber(rest) };
    if ([patch.hrMax, patch.hrRest].some((v) => v !== null && !Number.isInteger(v))) return setError('Des nombres entiers, en battements par minute.');
    const problem = validateSettings(patch);
    if (problem) return setError(problem);
    setError('');
    try {
      await onSave(patch);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  return (
    <section className="sport-panel sport-hr">
      <h2 className="sport-panel-title">Fréquence cardiaque</h2>
      <div className="sport-hr-fields">
        <label className="sport-hr-field">
          <span>FC max</span>
          <input inputMode="numeric" value={max} placeholder={suggestedMax ? String(suggestedMax) : '190'} onChange={(e) => (setMax(e.target.value), setSaved(false))} aria-label="FC maximale" />
        </label>
        <label className="sport-hr-field">
          <span>FC de repos</span>
          <input inputMode="numeric" value={rest} placeholder="55" onChange={(e) => (setRest(e.target.value), setSaved(false))} aria-label="FC de repos" />
        </label>
        <button className="btn btn-sm" onClick={() => void save()}>
          Enregistrer
        </button>
      </div>
      {suggestedMax !== null && settings.hrMax === null && (
        <p className="sport-hint">
          La plus haute vue dans tes sorties : <b>{suggestedMax}</b>.{' '}
          <button className="sport-link" onClick={() => (setMax(String(suggestedMax)), setSaved(false))}>
            La reprendre
          </button>
        </p>
      )}
      {error && <p className="sport-error" role="alert">{error}</p>}
      {saved && !error && <p className="sport-hint">Enregistré.</p>}
      {zones ? (
        <ol className="sport-zones">
          {zones.map((z) => (
            <li key={z.zone} className={`sport-zone sport-zone-${z.zone}`}>
              <span className="sport-zone-name">
                Z{z.zone} · {ZONE_LABELS[z.zone - 1]}
              </span>
              <span className="sport-zone-range">
                {z.min}–{z.max}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="sport-hint">Donne ta FC maximale pour voir tes zones. Avec ta FC de repos, elles tiennent compte de ton cœur (méthode de Karvonen).</p>
      )}
    </section>
  );
}
