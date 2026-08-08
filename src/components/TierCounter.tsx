import { kindFields, parseAmount, targetForInput, targetForStore } from '../lib/quantities';
import type { Tier, TierInput, TierKind } from '../lib/types';

/**
 * Comment ce palier se compte.
 *
 * Les 36 modèles arrivent déjà annotés : ce panneau ne sert qu'aux paliers
 * écrits à la main, et aux corrections. Il est donc replié par défaut — un
 * palier reste un jalon coché à la main tant qu'on ne vient pas ici, ce qui
 * est le comportement de toujours et le bon défaut.
 *
 * Le vocabulaire évite « cumul » et « performance » comme intitulés
 * principaux : on nomme le geste (« total accumulé », « meilleure séance »),
 * le mot technique reste dans l'explication.
 */
const KINDS: { id: TierKind; label: string; hint: string }[] = [
  {
    id: 'jalon',
    label: 'À cocher',
    hint: 'un palier qu’on valide à la main, quand il est fait. « Passer le permis ».',
  },
  {
    id: 'compte',
    label: 'Jours',
    hint: 'le nombre de jours où l’action a été faite — pas forcément d’affilée. « 30 jours sans écran ».',
  },
  {
    id: 'cumul',
    label: 'Total',
    hint: 'la somme des quantités enregistrées. « 100 km courus », « 500 € épargnés ».',
  },
  {
    id: 'serie',
    label: 'Série',
    hint: 'des jours consécutifs : un jour manqué remet le compteur à zéro (le record, lui, reste). Réservé aux arrêts — tabac, alcool.',
  },
  {
    id: 'performance',
    label: 'Meilleure séance',
    hint: 'la meilleure valeur d’une seule fois, jamais une somme. « Courir 10 km d’une traite ».',
  },
  {
    id: 'mesure',
    label: 'Mesure',
    hint: 'un relevé qu’on suit dans le temps : poids, tour de taille. Le point de départ est ta première pesée.',
  },
];

export function TierCounter({
  tier,
  onUpdate,
}: {
  tier: Tier;
  onUpdate: (patch: Partial<TierInput>) => Promise<void>;
}) {
  const kind = tier.kind;
  const hint = KINDS.find((k) => k.id === kind)?.hint;
  const isMeasure = kind === 'mesure';
  const hasDirection = isMeasure || kind === 'performance';

  return (
    <div className="tier-counter">
      <div className="tier-counter-kinds" role="group" aria-label="Façon de compter ce palier">
        {KINDS.map((k) => (
          <button
            key={k.id}
            className={`btn btn-sm${kind === k.id ? ' btn-primary' : ''}`}
            aria-pressed={kind === k.id}
            onClick={() => {
              if (kind !== k.id) void onUpdate(kindFields(k.id, tier));
            }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <p className="tier-counter-hint">{hint}</p>

      {kind !== 'jalon' && (
        <div className="tier-counter-fields">
          <label>
            <span>
              {isMeasure && tier.mode === 'delta'
                ? tier.direction === 'baisse'
                  ? 'Perdre'
                  : 'Gagner'
                : 'Cible'}
            </span>
            <input
              inputMode="decimal"
              defaultValue={targetForInput(tier) ?? ''}
              onBlur={(e) => {
                const raw = parseAmount(e.target.value);
                const next = raw === null ? null : targetForStore(raw, tier);
                if (next !== null && next !== tier.target) void onUpdate({ target: next });
                else e.target.value = String(targetForInput(tier) ?? '');
              }}
              aria-label={`Cible de ${tier.title}`}
            />
          </label>

          <label>
            <span>Unité</span>
            <input
              defaultValue={tier.unit}
              maxLength={12}
              placeholder="jours"
              onBlur={(e) => {
                const unit = e.target.value.trim();
                if (unit && unit !== tier.unit) void onUpdate({ unit });
                else e.target.value = tier.unit;
              }}
              aria-label={`Unité de ${tier.title}`}
            />
          </label>

          {hasDirection && (
            <label>
              <span>Sens</span>
              <select
                value={tier.direction}
                onChange={(e) => {
                  const direction = e.target.value as Tier['direction'];
                  // La cible garde sa valeur, mais change de signe : « perdre
                  // 5 kg » devenu « gagner 5 kg » reste un écart de 5.
                  void onUpdate({
                    direction,
                    target:
                      tier.target === null
                        ? null
                        : targetForStore(tier.target, { ...tier, direction }),
                  });
                }}
                aria-label={`Sens de ${tier.title}`}
              >
                <option value="hausse">{isMeasure ? 'Monter' : 'Atteindre au moins'}</option>
                <option value="baisse">{isMeasure ? 'Descendre' : 'Rester en dessous'}</option>
              </select>
            </label>
          )}

          {isMeasure && (
            <label>
              <span>Cible exprimée en</span>
              <select
                value={tier.mode}
                onChange={(e) => {
                  const mode = e.target.value as Tier['mode'];
                  void onUpdate({
                    mode,
                    target:
                      tier.target === null
                        ? null
                        : targetForStore(tier.target, { ...tier, mode }),
                  });
                }}
                aria-label={`Mode de cible de ${tier.title}`}
              >
                <option value="delta">écart depuis le départ</option>
                <option value="absolu">valeur à atteindre</option>
              </select>
            </label>
          )}
        </div>
      )}

      {kind !== 'jalon' && (
        <p className="tier-counter-foot">
          Alimenté par toutes les actions de cet objectif. Le palier se validera tout seul en
          atteignant sa cible — et restera validé même si le compteur redescend.
        </p>
      )}
    </div>
  );
}
