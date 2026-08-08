import { useEffect, useState } from 'react';
import { catchupDays, catchupLabel, ignoreDay, shiftDay } from '../lib/catchup';
import { formatAmount, isCountable } from '../lib/counters';
import { needsInput, parseAmount, tapValue } from '../lib/quantities';
import { goalProgress, history, ppForRank, relativeDate, todayPP, weekStats } from '../lib/progress';
import { getRank } from '../lib/ranks';
import { computeStreak, dayString } from '../lib/streak';
import type { Action, Checkin, Goal, Tier } from '../lib/types';
import { DailyRing } from './DailyRing';
import { ProfileHeader } from './ProfileHeader';
import { RankBadge } from './RankBadge';
import { TierMeter } from './TierMeter';

/**
 * Écran d'accueil — le hub. L'anneau du jour au premier plan (le quotidien),
 * ce qu'il construit juste en dessous (les paliers). La route et les cols.
 */
export function Hub({
  goals,
  actions,
  checkins,
  dailyGoal,
  onLogAction,
  onUnlogAction,
  onSaveNote,
  onSaveValue,
  onValidateTier,
  onGoToGoals,
}: {
  goals: Goal[];
  actions: Action[];
  checkins: Checkin[];
  dailyGoal: number;
  onLogAction: (goal: Goal, action: Action, day?: string, value?: number | null) => void;
  onUnlogAction: (checkin: Checkin) => void;
  onSaveNote: (checkin: Checkin, note: string) => void;
  onSaveValue: (checkin: Checkin, value: number) => void;
  onValidateTier: (goal: Goal, tier: Tier) => void;
  onGoToGoals: () => void;
}) {
  const active = goals.filter((g) => !g.archived);
  const today = dayString();

  /**
   * Jour affiché par la section « Aujourd'hui ».
   *
   * Seule cette section est datée. L'anneau, la flamme, le rang et les stats
   * décrivent le présent et n'auraient aucun sens rapportés à mercredi
   * dernier : faire basculer tout le hub obligerait soit à afficher six blocs
   * qui mentent, soit à faire de l'archéologie sur un streak passé.
   */
  const [viewDay, setViewDay] = useState(today);
  const onToday = viewDay === today;

  /** Jours écartés à la main pendant cette session (réponse immédiate au clic). */
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const past = catchupDays(goals, actions, checkins, today);
  /** Le plus ancien jour encore modifiable ; `today` s'il n'y en a aucun. */
  const oldest = past.length > 0 ? past[past.length - 1].day : today;
  /** Le jour resté vide sur lequel l'app prend la parole, s'il y en a un. */
  const forgotten = past.find((d) => d.asks && !dismissed.has(d.day));

  // Garde-fou du parcours daté : passer minuit ou revenir au premier plan
  // ramène toujours sur aujourd'hui. Sans ça, on coche le mauvais jour des
  // heures plus tard sans s'en apercevoir.
  useEffect(() => setViewDay(today), [today]);
  useEffect(() => {
    function backToToday() {
      if (document.visibilityState === 'visible') setViewDay(dayString());
    }
    document.addEventListener('visibilitychange', backToToday);
    return () => document.removeEventListener('visibilitychange', backToToday);
  }, []);

  const dayLogs = checkins.filter((c) => c.day === viewDay);
  const logByAction = new Map(
    dayLogs.filter((c) => c.actionId).map((c) => [c.actionId as string, c]),
  );

  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  /** Actions dont le « +PP » est en train de s'envoler (retiré après l'anim). */
  const [flying, setFlying] = useState<Set<string>>(new Set());
  const noteCheckin = noteFor ? dayLogs.find((c) => c.id === noteFor) : undefined;

  /**
   * Saisie d'une quantité, en cours.
   *
   * Deux cas seulement, et jamais sur le chemin de l'appui ordinaire :
   *  · un relevé (se peser), où la saisie *est* le geste ;
   *  · une correction, quand la sortie du jour n'a pas fait les 8 km habituels.
   */
  const [valueFor, setValueFor] = useState<{
    goal: Goal;
    action: Action;
    checkinId: string | null;
  } | null>(null);
  const [valueDraft, setValueDraft] = useState('');

  function openNote(checkin: Checkin) {
    setNoteFor(checkin.id);
    setNoteDraft(checkin.note ?? '');
  }

  function openValue(goal: Goal, action: Action, checkin: Checkin | null) {
    setNoteFor(null);
    setValueFor({ goal, action, checkinId: checkin?.id ?? null });
    setValueDraft(
      checkin?.value !== null && checkin?.value !== undefined
        ? String(checkin.value).replace('.', ',')
        : action.isMeasure
          ? ''
          : String(action.defaultValue ?? '').replace('.', ','),
    );
  }

  function submitValue() {
    if (!valueFor) return;
    const value = parseAmount(valueDraft);
    if (value === null) return;
    const existing = valueFor.checkinId
      ? dayLogs.find((c) => c.id === valueFor.checkinId)
      : undefined;
    if (existing) onSaveValue(existing, value);
    else onLogAction(valueFor.goal, valueFor.action, viewDay, value);
    setValueFor(null);
  }

  // Changer de jour ferme la saisie : elle porte sur une journée précise, et
  // la laisser ouverte ferait enregistrer la valeur sur le mauvais jour.
  useEffect(() => setValueFor(null), [viewDay]);

  function saveNote(close: boolean) {
    if (noteCheckin && noteDraft.trim() !== (noteCheckin.note ?? '')) {
      onSaveNote(noteCheckin, noteDraft.trim());
    }
    if (close) setNoteFor(null);
  }

  const earned = todayPP(goals, checkins);
  const streak = computeStreak(goals, checkins);
  const remaining = Math.max(0, dailyGoal - earned);
  const dayDone = earned >= dailyGoal;

  const nextTiers = active
    .map((goal) => ({ goal, progress: goalProgress(goal) }))
    .filter(({ progress }) => progress.next)
    .map(({ goal, progress }) => ({ goal, tier: progress.next as Tier }))
    .sort((a, b) => getRank(a.tier.rank).value - getRank(b.tier.rank).value);

  const recentTiers = history(goals).slice(0, 4);
  const week = weekStats(goals, checkins, 0);
  const lastWeek = weekStats(goals, checkins, -1);

  return (
    <div className="hub">
      {streak.atRisk && streak.current > 0 && (
        <div className="notice streak-banner" role="status">
          🔥 <strong>
            Streak de {streak.current} jour{streak.current > 1 ? 's' : ''} en jeu
          </strong>{' '}
          — fais une action avant minuit pour le prolonger
          {streak.freezes > 0 ? ` (sinon un gel ❄ sur ${streak.freezes} sera consommé).` : '.'}
        </div>
      )}

      {/* ---------- héros : anneau + flamme ---------- */}
      <section className="daily-hero">
        <DailyRing value={earned} goal={dailyGoal} />

        <div className="daily-side">
          <h2 className="daily-title">
            {dayDone
              ? 'Journée bouclée'
              : earned === 0
                ? 'La journée commence'
                : `Plus que ${remaining} PP`}
          </h2>
          <p className="daily-sub">
            {dayDone
              ? `${earned - dailyGoal > 0 ? `+${earned - dailyGoal} PP au-delà de l'objectif. ` : ''}Le streak est assuré.`
              : streak.current > 0
                ? 'Une action et ton streak continue.'
                : 'Fais une action pour lancer ton streak.'}
          </p>

          <div className="flame-row">
            <span className={`flame${streak.activeToday ? ' lit' : ''}`} aria-hidden="true">
              🔥
            </span>
            <div>
              <div className="flame-count">{streak.current}</div>
              <div className="flame-label">
                jour{streak.current > 1 ? 's' : ''} d'affilée
                {streak.freezes > 0 && (
                  <>
                    {' · '}
                    <span
                      className="freeze"
                      title={`${streak.freezes} gel(s) : un jour manqué en consomme un au lieu de casser le streak`}
                    >
                      ❄×{streak.freezes}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- une seule ligne, et seulement s'il y a eu un oubli ----------
          L'app ne prend la parole que quand une journée récente est restée
          entièrement vide : c'est le seul cas où elle sait quelque chose que
          l'utilisateur a probablement oublié. Le reste du temps, revenir en
          arrière se fait par les flèches de la section, sans rien occuper. */}
      {forgotten && onToday && (
        <div className="forgotten" role="status">
          <span className="forgotten-text">
            <b>{catchupLabel(forgotten.day, today)}</b> — rien de coché. Un oubli ?
          </span>
          <button className="btn btn-sm" onClick={() => setViewDay(forgotten.day)}>
            Compléter
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              ignoreDay(forgotten.day, today);
              setDismissed((set) => new Set(set).add(forgotten.day));
            }}
          >
            Rien fait
          </button>
        </div>
      )}

      {/* ---------- actions du jour ---------- */}
      {active.length > 0 && (
        <section className={`hub-section${onToday ? '' : ' past-day'}`}>
          <div className="hub-section-head">
            <div className="day-nav">
              <button
                className="day-arrow"
                onClick={() => setViewDay(shiftDay(viewDay, -1))}
                disabled={viewDay <= oldest}
                aria-label="Jour précédent"
                title="Jour précédent"
              >
                ◂
              </button>
              <h2>{onToday ? "Aujourd'hui" : catchupLabel(viewDay, today)}</h2>
              <button
                className="day-arrow"
                onClick={() => setViewDay(shiftDay(viewDay, 1))}
                disabled={onToday}
                aria-label="Jour suivant"
                title="Jour suivant"
              >
                ▸
              </button>
            </div>
            {onToday ? (
              <span className="hub-section-hint">
                coche ce que tu as fait — chaque action nourrit son objectif
              </span>
            ) : (
              <button className="btn btn-sm day-back" onClick={() => setViewDay(today)}>
                Revenir à aujourd'hui
              </button>
            )}
          </div>

          {active.map((goal) => {
            const goalActions = actions.filter((a) => a.goalId === goal.id);
            if (goalActions.length === 0) return null;
            return (
              <div className="today-goal" key={goal.id}>
                <div className="today-goal-name">
                  <span aria-hidden="true">{goal.emoji}</span> {goal.title}
                </div>
                <div className="checkin-chips">
                  {goalActions.map((action) => {
                    const log = logByAction.get(action.id);
                    const quantified = action.unit.trim() !== '';
                    /** Une coche pas encore confirmée par le serveur n'a pas d'id à éditer. */
                    const settled =
                      log && !log.id.startsWith('optimiste-') && !log.id.startsWith('attente-');
                    // Ce que l'appui va enregistrer, ou ce qu'il a enregistré.
                    const amount = log
                      ? typeof log.value === 'number'
                        ? formatAmount(log.value, action.unit)
                        : null
                      : action.isMeasure
                        ? null
                        : typeof action.defaultValue === 'number'
                          ? formatAmount(action.defaultValue, action.unit)
                          : null;
                    return (
                      <button
                        key={action.id}
                        className={`checkin-chip${log ? ' done' : ''}`}
                        aria-pressed={Boolean(log)}
                        title={
                          log
                            ? log.note
                              ? `« ${log.note} » — fait · re-cliquer annule`
                              : 'Fait · re-cliquer annule'
                            : action.isMeasure
                              ? `${action.title} · noter la valeur du jour`
                              : amount
                                ? `${action.title} · ${amount} · +${action.pp} PP`
                                : `${action.title} · +${action.pp} PP`
                        }
                        onClick={() => {
                          if (log) {
                            onUnlogAction(log);
                            if (noteFor === log.id) setNoteFor(null);
                            if (valueFor?.checkinId === log.id) setValueFor(null);
                            return;
                          }
                          // Un relevé n'a pas de valeur habituelle qui ait du
                          // sens : la saisie est le geste, on l'ouvre au lieu
                          // d'enregistrer un zéro qui ne veut rien dire.
                          if (needsInput(action)) {
                            openValue(goal, action, null);
                            return;
                          }
                          onLogAction(goal, action, viewDay, tapValue(action));
                          // Le « +PP » s'envole une fois, puis disparaît. La
                          // clé porte le jour : la même action peut être
                          // cochée sur deux journées différentes.
                          const key = `${viewDay}-${action.id}`;
                          setFlying((prev) => new Set(prev).add(key));
                          window.setTimeout(
                            () =>
                              setFlying((prev) => {
                                const next = new Set(prev);
                                next.delete(key);
                                return next;
                              }),
                            900,
                          );
                        }}
                      >
                        {flying.has(`${viewDay}-${action.id}`) && (
                          <span className="pp-fly" aria-hidden="true">
                            +{action.pp}
                          </span>
                        )}
                        <span className="checkin-title">{action.title}</span>

                        {/* La quantité que l'appui enregistre, annoncée avant
                            le clic : c'est ce qui permet de ne jamais ouvrir
                            de clavier pour une sortie ordinaire. */}
                        {amount && <span className="checkin-amount">{amount}</span>}

                        {/* Ajuster : une correction, jamais un passage obligé. */}
                        {settled && quantified && log && (
                          <span
                            className="checkin-note-btn"
                            role="button"
                            tabIndex={0}
                            title={`Ajuster la quantité (${action.unit})`}
                            aria-label={`Ajuster la quantité de ${action.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openValue(goal, action, log);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                openValue(goal, action, log);
                              }
                            }}
                          >
                            #
                          </span>
                        )}

                        {/* Une coche qui n'existe pas encore côté serveur
                            (envoi en cours, ou en attente de réseau) n'a pas
                            d'identifiant sur lequel accrocher une note. */}
                        {settled && log && (
                          <span
                            className="checkin-note-btn"
                            role="button"
                            tabIndex={0}
                            title={log.note ? 'Modifier la note' : 'Ajouter une note'}
                            aria-label={`${log.note ? 'Modifier' : 'Ajouter'} la note de ${action.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openNote(log);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                openNote(log);
                              }
                            }}
                          >
                            {log.note ? '📝' : '✎'}
                          </span>
                        )}
                        <span className="checkin-mark">
                          {log ? (
                            <>
                              <span aria-hidden="true">✓</span> fait
                            </>
                          ) : (
                            `+${action.pp}`
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {valueFor && (
            <div className="checkin-note checkin-value">
              <span className="checkin-note-label" aria-hidden="true">
                #
              </span>
              <input
                autoFocus
                inputMode="decimal"
                ref={(el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                value={valueDraft}
                onChange={(e) => setValueDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitValue();
                  }
                  if (e.key === 'Escape') setValueFor(null);
                }}
                placeholder={valueFor.action.isMeasure ? '78,4' : '8'}
                aria-label={`Quantité pour ${valueFor.action.title}, en ${valueFor.action.unit}`}
              />
              <span className="checkin-value-unit">{valueFor.action.unit}</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={submitValue}
                disabled={parseAmount(valueDraft) === null}
              >
                Enregistrer
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setValueFor(null)}>
                Annuler
              </button>
            </div>
          )}

          {noteCheckin && (
            <div className="checkin-note">
              <span className="checkin-note-label" aria-hidden="true">
                📝
              </span>
              <input
                autoFocus
                ref={(el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={() => saveNote(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveNote(true);
                  if (e.key === 'Escape') setNoteFor(null);
                }}
                maxLength={200}
                placeholder="Raconte (optionnel) : « 8 km ce matin, dur mais fait »"
                aria-label="Note du jour"
              />
            </div>
          )}
        </section>
      )}

      {/* ---------- la carrière : le rang que tout ça construit ---------- */}
      <ProfileHeader goals={goals} checkins={checkins} />

      {/* ---------- ce que ça construit ---------- */}
      <div className="hub-columns">
        <section className="hub-section">
          <div className="hub-section-head">
            <h2>Ce que ça construit</h2>
            <span className="hub-section-hint">le prochain palier de chaque objectif</span>
          </div>
          {nextTiers.length === 0 ? (
            <div className="hub-empty">
              {active.length === 0 ? (
                <>
                  <p>Aucun objectif pour l'instant — c'est le moment d'ouvrir la saison.</p>
                  <button className="btn btn-primary btn-sm" onClick={onGoToGoals}>
                    Créer mon premier objectif
                  </button>
                </>
              ) : (
                <p>Tous tes paliers sont validés. Ajoute une suite à tes objectifs !</p>
              )}
            </div>
          ) : (
            <ul className="next-list">
              {nextTiers.map(({ goal, tier }) => {
                const rank = getRank(tier.rank);
                return (
                  <li key={tier.id} className="next-tier">
                    <span className="next-emoji" aria-hidden="true">
                      {goal.emoji}
                    </span>
                    <span className="next-body">
                      <span className="next-title">{tier.title}</span>
                      <span className="next-goal">{goal.title}</span>
                      {/* Le lien entre le geste du soir et la marche qu'il
                          fait monter. Rien ne s'affiche pour un jalon. */}
                      <TierMeter tier={tier} actions={actions} checkins={checkins} compact />
                    </span>
                    <RankBadge rank={rank} />
                    {/* Un palier comptable se valide tout seul en atteignant
                        sa cible : proposer le bouton reviendrait à proposer de
                        tricher. */}
                    {!isCountable(tier) && (
                      <button
                        className="btn btn-sm next-validate"
                        onClick={() => onValidateTier(goal, tier)}
                        title={`Valider « ${tier.title} » (+${ppForRank(rank)} PP)`}
                      >
                        Valider · +{ppForRank(rank)} PP
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="hub-side">
          <section className="hub-section week-section">
            <div className="hub-section-head">
              <h2>Cette semaine</h2>
              <span className="hub-section-hint">
                {lastWeek.pp > 0 ? `vs ${lastWeek.pp} PP la semaine dernière` : 'lundi → dimanche'}
              </span>
            </div>
            <div className="week-stats">
              <div>
                <div className="week-value week-pp">
                  {week.pp}
                  {lastWeek.pp > 0 && (
                    <span
                      className={`week-delta${week.pp >= lastWeek.pp ? ' up' : ' down'}`}
                      title="Par rapport à la semaine dernière"
                    >
                      {week.pp >= lastWeek.pp ? '▲' : '▼'}
                    </span>
                  )}
                </div>
                <div className="week-label">PP gagnés</div>
              </div>
              <div>
                <div className="week-value">{week.checkins}</div>
                <div className="week-label">Actions</div>
              </div>
              <div>
                <div className="week-value">{week.tiersValidated}</div>
                <div className="week-label">Paliers</div>
              </div>
            </div>
          </section>

          <section className="hub-section">
            <div className="hub-section-head">
              <h2>Paliers récents</h2>
            </div>
            {recentTiers.length === 0 ? (
              <div className="hub-empty">
                <p>Tes validations de paliers apparaîtront ici.</p>
              </div>
            ) : (
              <ul className="activity-list">
                {recentTiers.map(({ tier, goal, date }) => {
                  const rank = getRank(tier.rank);
                  return (
                    <li key={tier.id} className="activity-item">
                      <span
                        className="activity-dot"
                        style={{
                          background: `linear-gradient(150deg, ${rank.color2}, ${rank.color})`,
                        }}
                        aria-hidden="true"
                      />
                      <span className="activity-body">
                        <span className="activity-title">{tier.title}</span>
                        <span className="activity-meta">
                          {goal.emoji} {goal.title} · {relativeDate(date)}
                        </span>
                      </span>
                      <span className="activity-pp">+{ppForRank(rank)} PP</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
