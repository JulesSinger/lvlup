import { useEffect, useMemo, useRef, useState } from 'react';
import { formatAmount } from '../lib/counters';
import { HEATMAP_WEEKS, HEATMAP_YEAR_WEEKS, goalHeatmap, goalStreak } from '../lib/heatmap';
import { shiftDay } from '../lib/catchup';
import { dayString } from '../lib/streak';
import type { Action, Checkin, Goal } from '../lib/types';
import type { Rank } from '../lib/ranks';

/**
 * La grille des jours — la mémoire d'un objectif.
 *
 * Trois décisions de dessin, chacune contre un travers connu des traqueurs
 * d'habitudes :
 *  · rien avant la création de l'objectif, pour qu'une grille neuve ne soit
 *    pas un mur de reproches le premier jour ;
 *  · une case vide est neutre, jamais rouge — on éclaire ce qui a été fait, on
 *    ne surligne pas ce qui manque ;
 *  · un seul repère orange, sur hier, et seulement quand hier est vide et
 *    qu'aujourd'hui ne l'est pas encore. Jamais deux jours de suite.
 *
 * Et une décision de lecture : **une case se clique.** La grille dit « je m'y
 * suis mis », ce qui suffit pour une habitude — un objectif, un geste. Mais un
 * objectif de course a trois actions, et « sortie longue » n'est pas « sortie
 * de 15 min » : sans le détail, la case ment par omission. Le clic ouvre une
 * ligne qui nomme ce qui a été fait ce jour-là, sans changer d'écran.
 */

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function Heatmap({
  goal,
  actions,
  checkins,
  rank,
}: {
  goal: Goal;
  actions: Action[];
  checkins: Checkin[];
  rank: Rank | null;
}) {
  const today = dayString();
  const [picked, setPicked] = useState<string | null>(null);
  /** Action isolée dans la grille. `null` = toutes. */
  const [focus, setFocus] = useState<string | null>(null);
  /** Trimestre par défaut ; l'année se demande. */
  const [year, setYear] = useState(false);
  const weeks = year ? HEATMAP_YEAR_WEEKS : HEATMAP_WEEKS;
  const scrollRef = useRef<HTMLDivElement>(null);

  const mine = useMemo(() => actions.filter((a) => a.goalId === goal.id), [actions, goal.id]);
  const map = useMemo(
    () => goalHeatmap(goal, checkins, { weeks, today, actionId: focus }),
    [goal, checkins, weeks, today, focus],
  );
  const streak = useMemo(
    () => goalStreak(goal, checkins, today, focus),
    [goal, checkins, today, focus],
  );

  // Une année ne tient pas toujours dans une carte : on ouvre sur la fin,
  // parce que la colonne qu'on vient regarder est celle d'aujourd'hui.
  //
  // Le décalage se mesure sur la GRILLE, pas sur `scrollWidth` du conteneur :
  // la dernière étiquette de mois déborde de sa colonne de quelques pixels, et
  // s'aligner dessus faisait glisser toute la vue vers la gauche — au point de
  // rogner le premier mois, qui s'affichait « ût ».
  useEffect(() => {
    const el = scrollRef.current;
    const grid = el?.querySelector('.heat-grid');
    if (!el || !grid) return;
    el.scrollLeft = Math.max(0, grid.scrollWidth - el.clientWidth);
  }, [weeks]);

  // Aucune case allumée : la grille ne dirait rien qu'un « 0 » ne dise déjà,
  // et ferait passer un objectif tout neuf pour un échec. Sous filtre en
  // revanche, une grille vide est une information — « celle-là, je ne la fais
  // jamais » — et c'est exactement pour ça qu'on filtre.
  if (map.active === 0 && focus === null) return null;

  const color = rank?.color2 ?? '#6a748c';
  const monthByColumn = new Map(map.months.map((m) => [m.column, m.label]));
  const first = map.cells.find((c) => c.inRange)?.day ?? today;

  /** Ce qui a été fait un jour donné, nommé. */
  function detailOf(day: string): string {
    const done = checkins.filter(
      (c) => c.goalId === goal.id && c.day === day && (focus === null || c.actionId === focus),
    );
    if (done.length === 0) return 'rien ce jour-là';
    return done
      .map((c) => {
        // L'action a pu être supprimée depuis : le check-in survit, son nom non.
        const action = actions.find((a) => a.id === c.actionId);
        const name = action?.title ?? 'action supprimée';
        const unit = action?.unit ?? '';
        return typeof c.value === 'number' && unit
          ? `${name} (${formatAmount(c.value, unit)})`
          : name;
      })
      .join(' · ');
  }

  function move(offset: number) {
    const from = picked ?? today;
    const next = shiftDay(from, offset);
    if (next > today || next < first) return;
    setPicked(next);
  }

  return (
    <div className={`heat${year ? ' year' : ''}`} style={{ ['--heat' as string]: color }}>
      {/* Le filtre n'existe que là où il répond à une question : avec une
          seule action, la grille de l'objectif *est* celle de l'action, et
          proposer un choix entre une seule option serait du bruit. */}
      {mine.length > 1 && (
        <div className="heat-filter" role="group" aria-label="Filtrer la grille par action">
          <button
            className={`heat-chip${focus === null ? ' on' : ''}`}
            aria-pressed={focus === null}
            onClick={() => {
              setFocus(null);
              setPicked(null);
            }}
          >
            Tout
          </button>
          {mine.map((a) => (
            <button
              key={a.id}
              className={`heat-chip${focus === a.id ? ' on' : ''}`}
              aria-pressed={focus === a.id}
              title={`Ne montrer que « ${a.title} »`}
              onClick={() => {
                setFocus((f) => (f === a.id ? null : a.id));
                setPicked(null);
              }}
            >
              {a.title}
            </button>
          ))}
        </div>
      )}

      <div className="heat-body">
        <div className="heat-dow" aria-hidden="true">
          {DOW.map((letter, i) => (
            <span key={i}>{i % 2 === 0 ? letter : ''}</span>
          ))}
        </div>

        <div className="heat-scroll" ref={scrollRef}>
          <div className="heat-months" aria-hidden="true">
            {Array.from({ length: map.columns }, (_, col) => (
              <span key={col}>{monthByColumn.get(col) ?? ''}</span>
            ))}
          </div>
          {/* Un seul arrêt de tabulation pour douze semaines : quatre-vingt-
              quatre boutons dans l'ordre du clavier rendraient la page
              intraversable. Les flèches déplacent la sélection, la ligne de
              détail est un `status` — donc annoncée à chaque déplacement. */}
          <div
            className="heat-grid"
            role="img"
            tabIndex={0}
            aria-label={`${focus ? mine.find((a) => a.id === focus)?.title + ' : ' : ''}${map.active} jour${map.active > 1 ? 's' : ''} d'activité sur les ${weeks} dernières semaines. Flèches pour parcourir les jours.`}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(1);
              else if (e.key === 'ArrowLeft') move(-1);
              else if (e.key === 'ArrowDown') move(7);
              else if (e.key === 'ArrowUp') move(-7);
              else if (e.key === 'Escape') setPicked(null);
              else return;
              e.preventDefault();
            }}
          >
            {map.cells.map((cell) => (
              <span
                key={cell.day}
                className={
                  'heat-cell' +
                  (cell.inRange ? '' : ' ghost') +
                  (cell.day === today ? ' today' : '') +
                  (cell.day === map.warnDay ? ' warn' : '') +
                  (cell.day === picked ? ' picked' : '')
                }
                data-level={cell.level}
                onClick={
                  cell.inRange
                    ? () => setPicked((p) => (p === cell.day ? null : cell.day))
                    : undefined
                }
                title={
                  cell.inRange
                    ? `${formatDay(cell.day)}${cell.count > 0 ? ` · ${detailOf(cell.day)}` : ' · rien'}`
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </div>

      <div className="heat-foot">
        {/* Toujours présente, pour que le clic ne fasse pas sauter la carte. */}
        <p className="heat-detail" role="status">
          {picked ? (
            <>
              <b>{formatDay(picked)}</b> — {detailOf(picked)}
            </>
          ) : focus !== null && map.active === 0 ? (
            <span className="heat-hint">Jamais fait sur cette période.</span>
          ) : (
            <span className="heat-hint">
              {/* Le chiffre qui manquait. La flamme de Zénith est globale ;
                  celle-ci ne parle que de cet objectif. Rien à zéro : « 0 jour
                  d'affilée » n'est pas une information, c'est un reproche. */}
              {streak > 0 && (
                <span className="heat-streak">
                  🔥 <b>{streak}</b> jour{streak > 1 ? 's' : ''} d'affilée{' · '}
                </span>
              )}
              {map.active} jour{map.active > 1 ? 's' : ''} sur {year ? '1 an' : '12 semaines'}
            </span>
          )}
        </p>

        <button
          className="heat-zoom"
          onClick={() => {
            setYear((v) => !v);
            setPicked(null);
          }}
          aria-label={year ? 'Revenir aux douze dernières semaines' : "Voir l'année entière"}
        >
          {year ? '12 semaines' : 'Année'}
        </button>
      </div>
    </div>
  );
}

function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
