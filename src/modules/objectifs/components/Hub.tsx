import { useEffect, useState } from 'react';
import { catchupDays, catchupLabel, ignoreDay, shiftDay } from '../lib/catchup';
import { formatAmount } from '../lib/counters';
import { agoLabel } from '../lib/chartTime';
import { ladderKind, needsInput, parseAmount, tapValue } from '../lib/quantities';
import { dayString } from '../lib/streak';
import { lastReading, dayComplete } from '../lib/today';
import { ONE_OFF_PP } from '../lib/types';
import type { Action, Checkin, FreezePurchase, Goal, Tier } from '../lib/types';
import { DayBand } from './DayBand';
import { TodayGoal } from './TodayGoal';

/**
 * Écran d'accueil — le hub. Refait le 07/10/2026 à la demande de Jules : ce
 * qui compte, ce sont les actions à cocher, les paliers qu'elles font monter
 * et le streak. Le bandeau du jour (streak, PP du jour, gel), puis une carte
 * par objectif, dans l'ordre choisi sur la page Objectifs, qui réunit le
 * palier visé et ce qu'on coche pour s'en approcher. Le profil est passé sur
 * Trophées ; « Cette semaine » et « Paliers récents », qui répétaient
 * l'Historique, ont été retirés.
 */
export function Hub({
  goals,
  actions,
  checkins,
  dailyGoal,
  onLogAction,
  onLogOneOff,
  onUnlogAction,
  onSaveNote,
  onSaveValue,
  onValidateTier,
  onOpenGoal,
  freezePurchases,
  onBuyFreeze,
}: {
  goals: Goal[];
  actions: Action[];
  checkins: Checkin[];
  dailyGoal: number;
  onLogAction: (goal: Goal, action: Action, day?: string, value?: number | null) => void;
  onLogOneOff: (goal: Goal, title: string, day?: string, value?: number | null) => void;
  onUnlogAction: (checkin: Checkin) => void;
  onSaveNote: (checkin: Checkin, note: string) => void;
  onSaveValue: (checkin: Checkin, value: number) => void;
  onValidateTier: (goal: Goal, tier: Tier) => void;
  /** Ouvre la fiche d'un objectif, sur la page Objectifs. */
  onOpenGoal: (goalId: string) => void;
  /** Journal des gels achetés : la réserve s'en déduit. */
  freezePurchases: FreezePurchase[];
  onBuyFreeze: () => void;
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

  /** Objectif pour lequel on est en train d'écrire un geste ponctuel. */
  const [oneOffFor, setOneOffFor] = useState<Goal | null>(null);
  const [oneOffDraft, setOneOffDraft] = useState('');
  /** Quantité optionnelle du geste — seulement quand l'objectif suit une unité. */
  const [oneOffValueDraft, setOneOffValueDraft] = useState('');

  function submitOneOff() {
    if (!oneOffFor) return;
    const title = oneOffDraft.trim();
    if (!title) return;
    onLogOneOff(oneOffFor, title, viewDay, parseAmount(oneOffValueDraft));
    setOneOffFor(null);
    setOneOffDraft('');
    setOneOffValueDraft('');
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

  /**
   * Objectifs entièrement cochés qu'on garde dépliés : ceux qu'on vient de
   * toucher (la dernière coche ne doit pas faire disparaître la pastille
   * qu'on voudrait défaire) et ceux qu'on a rouverts à la main.
   */
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const keepOpen = (id: string) => setOpened((set) => (set.has(id) ? set : new Set(set).add(id)));

  // Changer de jour ferme les saisies : elles portent sur une journée précise,
  // et les laisser ouvertes ferait enregistrer sur le mauvais jour.
  useEffect(() => {
    setValueFor(null);
    setOneOffFor(null);
    setOpened(new Set());
  }, [viewDay]);

  function saveNote(close: boolean) {
    if (noteCheckin && noteDraft.trim() !== (noteCheckin.note ?? '')) {
      onSaveNote(noteCheckin, noteDraft.trim());
    }
    if (close) setNoteFor(null);
  }

  return (
    <div className="hub">
      <DayBand
        goals={goals}
        checkins={checkins}
        freezePurchases={freezePurchases}
        dailyGoal={dailyGoal}
        onBuyFreeze={onBuyFreeze}
      />

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
            // Une unité connue permet de saisir une quantité sur le geste
            // ponctuel — sinon, le champ n'aurait rien à demander.
            const ladder = ladderKind(goal.tiers);
            const collapsed = dayComplete(goal, actions, checkins, viewDay) && !opened.has(goal.id);
            // Le dernier relevé d'une mesure pas encore notée ce jour-là : le
            // chiffre qu'on a en tête en se pesant.
            const readings = goalActions
              .filter((action) => action.isMeasure && !logByAction.has(action.id))
              .map((action) => ({ action, reading: lastReading(action, checkins, viewDay) }))
              .filter((r) => r.reading !== null);
            return (
              <TodayGoal
                key={goal.id}
                goal={goal}
                actions={actions}
                checkins={checkins}
                today={today}
                onToday={onToday}
                collapsed={collapsed}
                onExpand={() => keepOpen(goal.id)}
                onOpenGoal={() => onOpenGoal(goal.id)}
                onValidateTier={onValidateTier}
              >
                <div className="checkin-chips" onClickCapture={() => keepOpen(goal.id)}>
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

                  {/* Les gestes ponctuels du jour, s'il y en a. Ce sont des
                      réalisations comme les autres : elles appartiennent à
                      cette journée-là et disparaîtront d'elles-mêmes demain,
                      sans jamais devenir une case à cocher. Re-cliquer annule,
                      ce qui donne l'annulation d'une faute de frappe. */}
                  {dayLogs
                    .filter((c) => c.goalId === goal.id && c.title !== null)
                    .map((log) => (
                      <button
                        key={log.id}
                        className="checkin-chip done oneoff"
                        title="Geste ponctuel · re-cliquer annule"
                        onClick={() => onUnlogAction(log)}
                      >
                        <span className="checkin-title">{log.title}</span>
                        {typeof log.value === 'number' && (
                          <span className="checkin-amount">{formatAmount(log.value, ladder?.unit)}</span>
                        )}
                        {/* « noté », pas « fait » : rien n'a été coché ici, et
                            un ✓ laisserait croire à une case de plus. */}
                        <span className="checkin-mark">noté</span>
                      </button>
                    ))}

                  {/* Un pas ponctuel vers l'objectif — regarder un tuto,
                      ouvrir le compte d'épargne. Un « + », pas une case :
                      rien de nouveau à cocher tous les soirs. */}
                  <button
                    className="checkin-chip add-oneoff"
                    title={`Noter un geste ponctuel pour « ${goal.title} »`}
                    aria-label={`Noter un geste ponctuel pour ${goal.title}`}
                    onClick={() => {
                      setValueFor(null);
                      setNoteFor(null);
                      setOneOffFor((g) => (g?.id === goal.id ? null : goal));
                      setOneOffDraft('');
                      setOneOffValueDraft('');
                    }}
                  >
                    <span aria-hidden="true">+</span>
                    <span className="checkin-title">Autre chose</span>
                  </button>
                </div>

                {readings.map(({ action, reading }) => (
                  <p className="today-goal-reading" key={action.id}>
                    {action.title} · dernier <b>{formatAmount(reading!.value, action.unit)}</b>,{' '}
                    {agoLabel(reading!.day, viewDay)}
                  </p>
                ))}

                {oneOffFor?.id === goal.id && (
                  <div className="checkin-note oneoff-bar">
                    <span className="checkin-note-label" aria-hidden="true">
                      ✦
                    </span>
                    <input
                      autoFocus
                      ref={(el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                      value={oneOffDraft}
                      onChange={(e) => setOneOffDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submitOneOff();
                        }
                        if (e.key === 'Escape') setOneOffFor(null);
                      }}
                      maxLength={80}
                      placeholder="Ce que tu as fait une fois : « tuto sur la gestion de budget »"
                      aria-label={`Geste ponctuel pour ${goal.title}`}
                    />
                    {ladder?.unit && (
                      <input
                        className="oneoff-value"
                        inputMode="decimal"
                        value={oneOffValueDraft}
                        onChange={(e) => setOneOffValueDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitOneOff();
                          }
                          if (e.key === 'Escape') setOneOffFor(null);
                        }}
                        placeholder={ladder.unit}
                        aria-label={`Quantité en ${ladder.unit} pour ce geste`}
                      />
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={submitOneOff}
                      disabled={!oneOffDraft.trim()}
                    >
                      Noter · +{ONE_OFF_PP} PP
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setOneOffFor(null)}>
                      Annuler
                    </button>
                  </div>
                )}
              </TodayGoal>
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

    </div>
  );
}
