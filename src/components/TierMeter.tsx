import { formatAmount, tierProgress, todayContribution } from '../lib/counters';
import { getRank } from '../lib/ranks';
import type { Action, Checkin, Tier } from '../lib/types';

/**
 * La barre qui manquait.
 *
 * L'action était cochée tous les soirs et le palier « 30 jours » n'en savait
 * rien : deux systèmes qui ne se parlaient pas. Cette barre est le lien
 * visible entre le geste du jour et la marche qu'il fait monter — d'où le
 * « +1 ce soir », qui dit explicitement ce que la coche va rapporter.
 *
 * Rien ne s'affiche pour un jalon : il n'y a rien à compter, et une barre à
 * zéro serait un reproche permanent.
 */
export function TierMeter({
  tier,
  actions,
  checkins,
  compact = false,
}: {
  tier: Tier;
  actions: Action[];
  checkins: Checkin[];
  compact?: boolean;
}) {
  const progress = tierProgress(tier, actions, checkins);
  if (!progress) return null;

  const rank = getRank(tier.rank);
  const pending = tier.completedAt ? 0 : todayContribution(tier, actions, checkins);
  const done = tier.completedAt !== null || progress.reached;

  return (
    <div className={`meter${compact ? ' compact' : ''}`}>
      <div className="meter-bar">
        <span
          style={{
            width: `${Math.round(progress.percent * 100)}%`,
            background: `linear-gradient(90deg, ${rank.color}, ${rank.color2})`,
          }}
        />
      </div>
      <div className="meter-foot">
        <span className="meter-count">
          {tier.kind === 'mesure' ? (
            <>
              <b>{formatAmount(progress.current)}</b> / {formatAmount(progress.target, tier.unit)}
              {progress.latest !== null && (
                <span className="meter-latest">
                  {' · '}
                  {formatAmount(progress.latest, tier.unit)} aujourd'hui
                </span>
              )}
            </>
          ) : (
            <>
              <b>{formatAmount(progress.current)}</b> / {formatAmount(progress.target, tier.unit)}
              {/* « 10 / 30 pompes » se lit spontanément comme un total qui
                  monte. Sur une performance c'est faux, et c'est grave : la
                  barre montre la meilleure fois, et trois séries de dix ne
                  feront jamais trente. On le dit ici, au lieu d'espérer que
                  l'intitulé du palier suffise. */}
              {tier.kind === 'performance' && (
                <span className="meter-scope">{' · '}en une seule fois</span>
              )}
              {pending > 0 && !done && (
                <span className="meter-pending">
                  {' · '}+{formatAmount(pending)} ce soir
                </span>
              )}
            </>
          )}
        </span>

        {/* Sur une série, le record reste affiché même quand le compteur est
            retombé : ce qui a été tenu n'est jamais effacé. */}
        {tier.kind === 'serie' && progress.best !== null && progress.best > progress.current && (
          <span className="meter-best" title="Ta meilleure série sur ce palier">
            🔥 record {formatAmount(progress.best)}
          </span>
        )}
        {tier.kind === 'mesure' && progress.baseline !== null && (
          <span className="meter-best">départ {formatAmount(progress.baseline, tier.unit)}</span>
        )}
      </div>
    </div>
  );
}
