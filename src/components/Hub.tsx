import { useState } from 'react';
import { goalProgress, history, ppForRank, relativeDate, todayPP, weekStats } from '../lib/progress';
import { getRank } from '../lib/ranks';
import { computeStreak, dayString } from '../lib/streak';
import type { Action, Checkin, Goal, Tier } from '../lib/types';
import { DailyRing } from './DailyRing';
import { ProfileHeader } from './ProfileHeader';
import { RankBadge } from './RankBadge';

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
  onValidateTier,
  onGoToGoals,
}: {
  goals: Goal[];
  actions: Action[];
  checkins: Checkin[];
  dailyGoal: number;
  onLogAction: (goal: Goal, action: Action) => void;
  onUnlogAction: (checkin: Checkin) => void;
  onSaveNote: (checkin: Checkin, note: string) => void;
  onValidateTier: (goal: Goal, tier: Tier) => void;
  onGoToGoals: () => void;
}) {
  const active = goals.filter((g) => !g.archived);
  const today = dayString();
  const todayLogs = checkins.filter((c) => c.day === today);
  const logByAction = new Map(
    todayLogs.filter((c) => c.actionId).map((c) => [c.actionId as string, c]),
  );

  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  /** Actions dont le « +PP » est en train de s'envoler (retiré après l'anim). */
  const [flying, setFlying] = useState<Set<string>>(new Set());
  const noteCheckin = noteFor ? todayLogs.find((c) => c.id === noteFor) : undefined;

  function openNote(checkin: Checkin) {
    setNoteFor(checkin.id);
    setNoteDraft(checkin.note ?? '');
  }

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

  const recent = history(goals).slice(0, 4);
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

      {/* ---------- actions du jour ---------- */}
      {active.length > 0 && (
        <section className="hub-section">
          <div className="hub-section-head">
            <h2>Aujourd'hui</h2>
            <span className="hub-section-hint">
              coche ce que tu as fait — chaque action nourrit son objectif
            </span>
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
                    return (
                      <button
                        key={action.id}
                        className={`checkin-chip${log ? ' done' : ''}`}
                        aria-pressed={Boolean(log)}
                        title={
                          log
                            ? log.note
                              ? `« ${log.note} » — fait aujourd'hui · re-cliquer annule`
                              : "Fait aujourd'hui · re-cliquer annule"
                            : `${action.title} · +${action.pp} PP`
                        }
                        onClick={() => {
                          if (log) {
                            onUnlogAction(log);
                            if (noteFor === log.id) setNoteFor(null);
                          } else {
                            onLogAction(goal, action);
                            // Le « +PP » s'envole une fois, puis disparaît.
                            setFlying((prev) => new Set(prev).add(action.id));
                            window.setTimeout(
                              () =>
                                setFlying((prev) => {
                                  const next = new Set(prev);
                                  next.delete(action.id);
                                  return next;
                                }),
                              900,
                            );
                          }
                        }}
                      >
                        {flying.has(action.id) && (
                          <span className="pp-fly" aria-hidden="true">
                            +{action.pp}
                          </span>
                        )}
                        <span className="checkin-title">{action.title}</span>
                        {/* Une coche qui n'existe pas encore côté serveur
                            (envoi en cours, ou en attente de réseau) n'a pas
                            d'identifiant sur lequel accrocher une note. */}
                        {log && !log.id.startsWith('optimiste-') && !log.id.startsWith('attente-') && (
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
                    </span>
                    <RankBadge rank={rank} />
                    <button
                      className="btn btn-sm next-validate"
                      onClick={() => onValidateTier(goal, tier)}
                      title={`Valider « ${tier.title} » (+${ppForRank(rank)} PP)`}
                    >
                      Valider · +{ppForRank(rank)} PP
                    </button>
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
            {recent.length === 0 ? (
              <div className="hub-empty">
                <p>Tes validations de paliers apparaîtront ici.</p>
              </div>
            ) : (
              <ul className="activity-list">
                {recent.map(({ tier, goal, date }) => {
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
