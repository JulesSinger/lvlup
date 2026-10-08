import { useMemo, useState } from 'react';
import { formatDuration, formatKm, formatPace, formatTime } from '../lib/format';
import { paceOf } from '../lib/pace';
import {
  PERIOD_LABELS,
  PERIODS,
  buckets,
  easyShare,
  paceChange,
  paceTrend,
  predictionTrend,
  previousTotals,
  recordHistory,
  totals,
  volumes,
  zone2Trend,
  zoneTime,
  type Bucket,
  type PacePoint,
  type Period,
} from '../lib/progress';
import { HALF_MARATHON_M, MARATHON_M, type Run, type RunKind, type SportSettings } from '../lib/types';
import { KIND_LABELS } from '../lib/kinds';
import { ZONE_LABELS, hrZones } from '../lib/zones';
import { shortDay } from './Journal';
import { TrendChart, type TrendPoint } from './TrendChart';

const PERIOD_KEY = 'sport.progress.v1';
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DISTANCE_LABELS: Record<number, string> = { 1000: '1 km', 5000: '5 km', 10_000: '10 km', [HALF_MARATHON_M]: 'Semi', [MARATHON_M]: 'Marathon' };
/** La période d'avant, de même longueur. « Tout » n'a rien avant : `previousTotals` rend null. */
const BEFORE_LABELS: Record<Period, string> = {
  '3m': 'Les trois mois d’avant',
  '6m': 'Les six mois d’avant',
  '1a': 'L’année d’avant',
  tout: 'Avant',
};
const PACE_KINDS: readonly RunKind[] = ['footing', 'longue', 'seuil', 'fractionne'];

function savedPeriod(): Period {
  try {
    const v = localStorage.getItem(PERIOD_KEY);
    if ((PERIODS as readonly string[]).includes(v ?? '')) return v as Period;
  } catch {
    // Stockage indisponible (navigation privée) : la période par défaut.
  }
  return '3m';
}

/** « 13 juil. » pour une semaine ; « nov. », ou « nov. 25 » hors de l'année en cours, pour un mois. */
function bucketLabel(b: Bucket, today: string): string {
  if (b.unit === 'semaine') return shortDay(b.start);
  const [y, m] = b.start.split('-');
  return y === today.slice(0, 4) ? MONTHS[Number(m) - 1] : `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

function bucketTitle(b: Bucket, today: string): string {
  if (b.unit === 'semaine') return `Semaine du ${shortDay(b.start)}`;
  const [y, m] = b.start.split('-');
  const month = MONTHS[Number(m) - 1];
  return y === today.slice(0, 4) ? month : `${month} ${y}`;
}

const signedPace = (s: number) => `${s < 0 ? '−' : '+'}${formatPace(Math.abs(s)).replace(' /km', '')} /km`;

/** « 12 s/km plus rapide » : ce que la courbe dit, en une phrase. */
function ChangeLine({ points, what }: { points: PacePoint[]; what: string }) {
  const change = paceChange(points);
  if (!change) return <p className="sport-hint">Encore quelques semaines de sorties pour dire une tendance.</p>;
  const { fromS, toS, deltaS } = change;
  const word = deltaS < -2 ? 'plus rapide' : deltaS > 2 ? 'plus lent' : 'stable';
  return (
    <p className="sport-progress-change">
      {what} : <b>{formatPace(fromS)}</b> → <b>{formatPace(toS)}</b>
      {word === 'stable' ? ', stable.' : ` (${signedPace(deltaS)}, ${word}).`}
    </p>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return <span className="sport-progress-delta">{pct === 0 ? '=' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`}</span>;
}

/**
 * La progression (docs/etude-sport.md §5, §12, §17) : le volume, l'allure
 * d'une sorte de sortie, l'endurance en zone 2, le temps par zone, la
 * prédiction au marathon, et l'histoire des records. Tout se recalcule depuis
 * les sorties.
 */
export function Progress({ runs, settings, today, targetS, onOpen }: {
  runs: Run[];
  settings: SportSettings;
  today: string;
  /** Le temps espéré du plan en cours, s'il y en a un. */
  targetS: number | null;
  onOpen: (run: Run) => void;
}) {
  const [period, setPeriodState] = useState<Period>(savedPeriod);
  const [paceKind, setPaceKind] = useState<RunKind>('footing');
  const zones = hrZones(settings);

  function setPeriod(p: Period) {
    setPeriodState(p);
    try {
      localStorage.setItem(PERIOD_KEY, p);
    } catch {
      // Sans stockage, la période vaut pour cette visite.
    }
  }

  const list = useMemo(() => buckets(period, today, runs), [period, today, runs]);
  const from = list[0].start;
  const to = list[list.length - 1].end;
  const sum = totals(runs, from, to);
  const before = previousTotals(runs, list);
  const vol = volumes(runs, list);
  const maxVol = Math.max(...vol.map((v) => v.distanceM), 1);
  const pace = paceTrend(runs, list, [paceKind]);
  const z2 = zone2Trend(runs, list, zones);
  const zt = zoneTime(runs, list, zones);
  const easy = easyShare(zt);
  const maxZone = Math.max(...zt.map((p) => p.byZone.reduce((a, v) => a + v, 0) + p.unknownS), 1);
  const prediction = predictionTrend(runs, list, today);
  const history = recordHistory(runs);
  const byId = new Map(runs.map((r) => [r.id, r]));
  const asPoints = (values: (number | null)[]): TrendPoint[] =>
    list.map((b, i) => ({ label: bucketLabel(b, today), title: bucketTitle(b, today), value: values[i] }));
  const unit = list[0].unit === 'semaine' ? 'semaine' : 'mois';
  const lastPrediction = [...prediction].reverse().find((p) => p.timeS !== null)?.timeS ?? null;

  return (
    <div className="sport-progress">
      <div className="sport-choice sport-progress-periods" role="group" aria-label="Période">
        {PERIODS.map((p) => (
          <button key={p} type="button" className={`sport-choice-item${period === p ? ' on' : ''}`} aria-pressed={period === p} onClick={() => setPeriod(p)}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="sport-dash">
        <section className="sport-panel sport-progress-volume">
          <h2 className="sport-panel-title">Volume, par {unit}</h2>
          <div className="sport-stats">
            <div className="sport-stat">
              <span className="sport-stat-value">{formatKm(sum.distanceM)}</span>
              <span className="sport-stat-label">
                courus {before && <Delta now={sum.distanceM} before={before.distanceM} />}
              </span>
            </div>
            <div className="sport-stat">
              <span className="sport-stat-value">{sum.runs}</span>
              <span className="sport-stat-label">sortie{sum.runs > 1 ? 's' : ''}</span>
            </div>
            <div className="sport-stat">
              <span className="sport-stat-value">{formatDuration(sum.durationS)}</span>
              <span className="sport-stat-label">en tout</span>
            </div>
            <div className="sport-stat">
              <span className="sport-stat-value">{Math.round(sum.elevationM)} m</span>
              <span className="sport-stat-label">de D+</span>
            </div>
          </div>
          {before && (
            <p className="sport-hint">
              {BEFORE_LABELS[period]} : {formatKm(before.distanceM)} en {before.runs} sortie{before.runs > 1 ? 's' : ''}.
            </p>
          )}
          <div className="sport-weeks sport-progress-bars" role="img" aria-label={`Kilomètres par ${unit} : ${vol.map((v) => Math.round(v.distanceM / 1000)).join(', ')}`}>
            {vol.map((v) => (
              <span key={v.start} className="sport-weeks-col" title={`${bucketTitle(v, today)} : ${formatKm(v.distanceM)}, ${v.runs} sortie${v.runs > 1 ? 's' : ''}`}>
                {vol.length <= 13 && <span className="sport-weeks-km">{v.distanceM > 0 ? Math.round(v.distanceM / 1000) : ''}</span>}
                <span className="sport-weeks-bar" style={{ height: v.distanceM > 0 ? `${Math.max(4, (v.distanceM / maxVol) * 100)}%` : '2px' }} />
              </span>
            ))}
          </div>
          <div className="sport-weeks-axis" aria-hidden="true">
            <span>{bucketLabel(list[0], today)}</span>
            <span>{bucketLabel(list[list.length - 1], today)}</span>
          </div>
        </section>

        <section className="sport-panel">
          <h2 className="sport-panel-title">Allure</h2>
          <div className="sport-choice sport-progress-kinds" role="group" aria-label="Sorte de sortie">
            {PACE_KINDS.map((k) => (
              <button key={k} type="button" className={`sport-choice-item${paceKind === k ? ' on' : ''}`} aria-pressed={paceKind === k} onClick={() => setPaceKind(k)}>
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
          {pace.some((p) => p.paceS !== null) ? (
            <>
              <TrendChart points={asPoints(pace.map((p) => p.paceS))} format={formatPace} lowerIsBetter label={`Allure — ${KIND_LABELS[paceKind]}`} />
              <ChangeLine points={pace} what={KIND_LABELS[paceKind]} />
            </>
          ) : (
            <p className="sport-hint">Aucune sortie de cette sorte sur la période.</p>
          )}
        </section>

        <section className="sport-panel">
          <h2 className="sport-panel-title">Endurance — allure en zone 2</h2>
          {!zones ? (
            <p className="sport-hint">Règle ta FC maximale sur le tableau de bord : l’allure des footings courus en zone 2 dira si tu cours plus vite au même cœur.</p>
          ) : z2.some((p) => p.paceS !== null) ? (
            <>
              <TrendChart points={asPoints(z2.map((p) => p.paceS))} format={formatPace} lowerIsBetter label="Allure en zone 2" />
              <ChangeLine points={z2} what="En zone 2" />
              <p className="sport-hint">Footings et sorties longues dont la FC moyenne est en zone 2. Plus vite au même cœur : l’endurance progresse.</p>
            </>
          ) : (
            <p className="sport-hint">Aucun footing en zone 2 sur la période (il faut la FC moyenne de la sortie).</p>
          )}
        </section>

        <section className="sport-panel">
          <h2 className="sport-panel-title">Temps par zone</h2>
          {!zones ? (
            <p className="sport-hint">Les zones apparaîtront une fois ta FC maximale réglée sur le tableau de bord.</p>
          ) : (
            <>
              <div className="sport-weeks sport-zone-bars" role="img" aria-label={`Temps par zone et par ${unit}`}>
                {zt.map((p) => (
                  <span key={p.start} className="sport-weeks-col" title={`${bucketTitle(p, today)} : ${p.byZone.map((s, i) => `Z${i + 1} ${formatDuration(s)}`).join(', ')}`}>
                    <span className="sport-zone-stack" style={{ height: `${((p.byZone.reduce((a, v) => a + v, 0) + p.unknownS) / maxZone) * 100}%` }}>
                      {p.byZone
                        .map((s, i) => ({ s, z: i + 1 }))
                        .reverse()
                        .map(({ s, z }) => (s > 0 ? <span key={z} className={`sport-zone-seg sport-zone-seg-${z}`} style={{ flexGrow: s }} /> : null))}
                      {p.unknownS > 0 && <span className="sport-zone-seg sport-zone-seg-0" style={{ flexGrow: p.unknownS }} />}
                    </span>
                  </span>
                ))}
              </div>
              <div className="sport-weeks-axis" aria-hidden="true">
                <span>{bucketLabel(list[0], today)}</span>
                <span>{bucketLabel(list[list.length - 1], today)}</span>
              </div>
              <ul className="sport-zone-legend">
                {ZONE_LABELS.map((l, i) => (
                  <li key={l}>
                    <span className={`sport-zone-dot sport-zone-seg-${i + 1}`} aria-hidden="true" />Z{i + 1} {l}
                  </li>
                ))}
                <li>
                  <span className="sport-zone-dot sport-zone-seg-0" aria-hidden="true" />
                  sans FC
                </li>
              </ul>
              {easy !== null && (
                <p className="sport-progress-change">
                  <b>{Math.round(easy * 100)} %</b> du temps en zones 1 et 2. Les plans marathon visent souvent autour de 80 % de temps facile.
                </p>
              )}
              <p className="sport-hint">Chaque sortie compte dans la zone de sa FC moyenne : une approximation, le détail demanderait le fichier de la sortie.</p>
            </>
          )}
        </section>

        <section className="sport-panel">
          <h2 className="sport-panel-title">Prédiction au marathon</h2>
          {lastPrediction === null ? (
            <p className="sport-hint">Elle viendra d’un 5 km, d’un 10 km ou d’un semi couru dans les 90 jours.</p>
          ) : (
            <>
              <TrendChart points={asPoints(prediction.map((p) => p.timeS))} format={formatTime} lowerIsBetter label="Prédiction au marathon" />
              <p className="sport-progress-change">
                Aujourd’hui : <b>≈ {formatTime(lastPrediction)}</b>
                {targetS ? (
                  <>
                    {' '}
                    — temps espéré du plan : <b>{formatTime(targetS)}</b>
                  </>
                ) : null}
                .
              </p>
              <p className="sport-hint">À la fin de chaque {unit}, d’après le meilleur effort des 90 jours d’avant (formule de Riegel) : une estimation, souvent optimiste sur marathon.</p>
            </>
          )}
        </section>

        <section className="sport-panel">
          <h2 className="sport-panel-title">Records, et leur histoire</h2>
          {history.size === 0 ? (
            <p className="sport-hint">Ils apparaîtront avec tes sorties.</p>
          ) : (
            <ul className="sport-record-history">
              {[...history].map(([d, list]) => {
                const current = list[list.length - 1];
                return (
                  <li key={d}>
                    <details>
                      <summary>
                        <span className="sport-record-name">{DISTANCE_LABELS[d]}</span>
                        <span className="sport-record-time">{formatTime(current.timeS)}</span>
                        <span className="sport-record-day">
                          {shortDay(current.day)}
                          {list.length > 1 ? ` · ${list.length - 1} amélioration${list.length > 2 ? 's' : ''}` : ''}
                        </span>
                      </summary>
                      <ol className="sport-record-steps">
                        {[...list].reverse().map((e, i, all) => {
                          const run = byId.get(e.runId);
                          const prev = all[i + 1];
                          return (
                            <li key={`${e.runId}-${e.timeS}`}>
                              <button type="button" className="sport-link" disabled={!run} onClick={() => run && onOpen(run)}>
                                {shortDay(e.day)} {e.day.slice(0, 4)}
                              </button>{' '}
                              <b>{formatTime(e.timeS)}</b> · {formatPace(paceOf(e.distanceM, e.timeS) ?? 0)}
                              {e.within ? ' · dans une sortie' : ''}
                              {prev ? <span className="sport-progress-delta"> −{formatTime(prev.timeS - e.timeS)}</span> : null}
                            </li>
                          );
                        })}
                      </ol>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
