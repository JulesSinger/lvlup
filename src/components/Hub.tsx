import { useState } from 'react';
import { CHECKIN_PP, goalProgress, history, ppForRank, relativeDate, weekStats } from '../lib/progress';
import { getRank } from '../lib/ranks';
import { dayString } from '../lib/streak';
import type { Checkin, Goal, Tier } from '../lib/types';
import { ProfileHeader } from './ProfileHeader';
import { RankBadge } from './RankBadge';

/**
 * Écran d'accueil — le « hub » : ton rang en héros, le check-in du jour,
 * les prochains paliers à aller chercher, l'activité récente et le bilan
 * de la semaine.
 */
export function Hub({
  goals,
  checkins,
  onCheckin,
  onUncheckin,
  onSaveNote,
  onValidateTier,
  onGoToGoals,
}: {
  goals: Goal[];
  checkins: Checkin[];
  onCheckin: (goal: Goal) => void;
  onUncheckin: (checkin: Checkin) => void;
  onSaveNote: (checkin: Checkin, note: string) => void;
  onValidateTier: (goal: Goal, tier: Tier) => void;
  onGoToGoals: () => void;
}) {
  const active = goals.filter((g) => !g.archived);
  const today = dayString();
  const todayByGoal = new Map(
    checkins.filter((c) => c.day === today).map((c) => [c.goalId, c]),
  );

  // Éditeur de note : ouvert automatiquement après un check-in, rouvrable
  // via le crayon d'un chip déjà validé.
  const [noteGoalId, setNoteGoalId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const noteCheckin = noteGoalId ? todayByGoal.get(noteGoalId) : undefined;
  const noteGoal = noteGoalId ? active.find((g) => g.id === noteGoalId) : undefined;

  function openNote(goal: Goal, existing: string) {
    setNoteGoalId(goal.id);
    setNoteDraft(existing);
  }

  /**
   * `close` : Entrée ferme l'éditeur, mais un simple blur (clic ailleurs,
   * cérémonie qui passe au premier plan…) enregistre sans fermer.
   */
  function saveNote(close: boolean) {
    if (noteCheckin && noteDraft.trim() !== (noteCheckin.note ?? '')) {
      onSaveNote(noteCheckin, noteDraft.trim());
    }
    if (close) setNoteGoalId(null);
  }

  const nextTiers = active
    .map((goal) => ({ goal, progress: goalProgress(goal) }))
    .filter(({ progress }) => progress.next)
    .map(({ goal, progress }) => ({ goal, tier: progress.next as Tier }))
    .sort((a, b) => getRank(a.tier.rank).value - getRank(b.tier.rank).value);

  const recent = history(goals).slice(0, 5);
  const week = weekStats(goals, checkins, 0);
  const lastWeek = weekStats(goals, checkins, -1);

  return (
    <div className="hub">
      <ProfileHeader goals={goals} checkins={checkins} />

      {active.length > 0 && (
        <section className="hub-section checkin-section">
          <div className="hub-section-head">
            <h2>Check-in du jour</h2>
            <span className="hub-section-hint">
              Qu'as-tu fait avancer aujourd'hui ? +{CHECKIN_PP} PP par objectif, et le streak
              continue.
            </span>
          </div>
          <div className="checkin-chips">
            {active.map((goal) => {
              const done = todayByGoal.get(goal.id);
              return (
                <button
                  key={goal.id}
                  className={`checkin-chip${done ? ' done' : ''}`}
                  onClick={() => {
                    if (done) {
                      onUncheckin(done);
                      if (noteGoalId === goal.id) setNoteGoalId(null);
                    } else {
                      onCheckin(goal);
                      openNote(goal, '');
                    }
                  }}
                  aria-pressed={Boolean(done)}
                  title={
                    done
                      ? done.note
                        ? `« ${done.note} » — re-cliquer annule le check-in`
                        : 'Annuler le check-in du jour'
                      : `J'ai fait avancer « ${goal.title} » aujourd'hui (+${CHECKIN_PP} PP)`
                  }
                >
                  <span className="checkin-emoji" aria-hidden="true">
                    {goal.emoji}
                  </span>
                  <span className="checkin-title">{goal.title}</span>
                  {done && (
                    <span
                      className="checkin-note-btn"
                      role="button"
                      tabIndex={0}
                      title={done.note ? 'Modifier la note' : 'Ajouter une note'}
                      aria-label={`${done.note ? 'Modifier' : 'Ajouter'} la note de « ${goal.title} »`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openNote(goal, done.note ?? '');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          openNote(goal, done.note ?? '');
                        }
                      }}
                    >
                      {done.note ? '📝' : '✎'}
                    </span>
                  )}
                  <span className="checkin-mark" aria-hidden="true">
                    {done ? '✓' : `+${CHECKIN_PP}`}
                  </span>
                </button>
              );
            })}
          </div>

          {noteGoal && noteCheckin && (
            <div className="checkin-note">
              <span className="checkin-note-label" aria-hidden="true">
                {noteGoal.emoji}
              </span>
              <input
                autoFocus
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={() => saveNote(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveNote(true);
                  if (e.key === 'Escape') setNoteGoalId(null);
                }}
                maxLength={200}
                placeholder="Raconte (optionnel) : « 8 km ce matin, dur mais fait »"
                aria-label={`Note du jour pour « ${noteGoal.title} »`}
              />
            </div>
          )}
        </section>
      )}

      <div className="hub-columns">
        <section className="hub-section">
          <div className="hub-section-head">
            <h2>À aller chercher</h2>
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
                <div className="week-label">Check-ins</div>
              </div>
              <div>
                <div className="week-value">{week.tiersValidated}</div>
                <div className="week-label">Paliers</div>
              </div>
            </div>
          </section>

          <section className="hub-section">
            <div className="hub-section-head">
              <h2>Activité récente</h2>
            </div>
            {recent.length === 0 ? (
              <div className="hub-empty">
                <p>Tes validations apparaîtront ici, avec leur date.</p>
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
