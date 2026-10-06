import { useState } from 'react';
import { clearNeedsDraft, readNeedsDraft, writeNeedsDraft } from '../data/needsDraft';
import { NEEDS_SECTIONS, needsProgress, normalizeNeeds, sameNeeds, setAnswer, toggleAsk, toggleChoice } from '../lib/needs';
import type { ProjectNeeds } from '../lib/types';
import { useSaving } from './useSaving';

interface Props {
  projectId: string;
  saved: ProjectNeeds;
  onSave: (needs: ProjectNeeds) => Promise<void>;
}

/**
 * Le questionnaire de besoins (§3.4), rempli pendant le rendez-vous. Chaque
 * frappe est gardée en brouillon sur l'appareil ; « Enregistrer » l'envoie.
 * Une question marquée « à demander » remonte dans « En attente du client »
 * tant qu'elle n'a pas de réponse.
 */
export function NeedsForm({ projectId, saved, onSave }: Props) {
  const [draftFound] = useState(() => {
    const draft = readNeedsDraft(projectId);
    return draft !== null && !sameNeeds(draft, saved) ? draft : null;
  });
  const [needs, setNeeds] = useState<Required<ProjectNeeds>>(() => normalizeNeeds(draftFound ?? saved));
  const { saving, error, run } = useSaving();
  const dirty = !sameNeeds(needs, saved);
  const { answered, total } = needsProgress(needs);

  function change(next: Required<ProjectNeeds>) {
    setNeeds(next);
    writeNeedsDraft(projectId, next);
  }

  function save() {
    void run(async () => {
      await onSave(needs);
      clearNeedsDraft(projectId);
    });
  }

  return (
    <div className="projets-needs">
      <div className="projets-needs-bar" role="status">
        <span>
          {answered} / {total} réponses
          {needs.ask.length > 0 && ` · ${needs.ask.length} à demander au client`}
        </span>
        {dirty && <span className="projets-needs-dirty">Modifications non enregistrées{draftFound ? ' (brouillon repris sur cet appareil)' : ''}</span>}
        <span className="projets-spacer" />
        {dirty && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              clearNeedsDraft(projectId);
              setNeeds(normalizeNeeds(saved));
            }}
          >
            Annuler
          </button>
        )}
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
          Enregistrer
        </button>
      </div>
      {error && <div className="notice error">{error}</div>}

      {NEEDS_SECTIONS.map((section) => (
        <section key={section.title} className="projets-needs-section" aria-label={section.title}>
          <h2 className="projets-section-title">{section.title}</h2>
          {section.questions.map((q) => {
            const value = needs.answers[q.key];
            const asked = needs.ask.includes(q.key);
            return (
              <div key={q.key} className={`projets-question${asked ? ' asked' : ''}`}>
                <div className="projets-question-head">
                  <label htmlFor={`projets-need-${q.key}`}>{q.label}</label>
                  <button
                    type="button"
                    className={`projets-ask${asked ? ' on' : ''}`}
                    aria-pressed={asked}
                    aria-label={`À demander au client : ${q.label}`}
                    onClick={() => change(toggleAsk(needs, q.key))}
                  >
                    ⏳ à demander
                  </button>
                </div>
                {q.kind === 'text' ? (
                  <textarea
                    id={`projets-need-${q.key}`}
                    rows={2}
                    value={typeof value === 'string' ? value : ''}
                    placeholder={q.placeholder}
                    onChange={(e) => change(setAnswer(needs, q.key, e.target.value))}
                  />
                ) : (
                  <div className="projets-choices" id={`projets-need-${q.key}`} role="group" aria-label={q.label}>
                    {q.choices?.map((choice) => {
                      const on = Array.isArray(value) && value.includes(choice);
                      return (
                        <button key={choice} type="button" className={`projets-choice${on ? ' on' : ''}`} aria-pressed={on} onClick={() => change(toggleChoice(needs, q, choice))}>
                          {choice}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
