import { useMemo, useState } from 'react';
import { describeRecurrence } from '../../../core/lib/recurrence';
import { dayLabel, shortDate, timeLabel } from '../lib/format';
import { parseQuickAdd, type QuickAdd, type TokenKind } from '../lib/quickAdd';
import type { TaskList } from '../lib/types';

interface Props {
  today: string;
  lists: readonly TaskList[];
  placeholder: string;
  /** Rejette en cas d'échec : le texte reste dans le champ. */
  onAdd: (parsed: QuickAdd) => Promise<void>;
}

const PRIORITY_TEXT = { normale: '', importante: 'Importante', urgente: 'Urgente' };

/**
 * L'ajout rapide, toujours en haut de la vue (étude §4) : « Appeler le
 * garage demain 9h » suffit. Ce qui a été compris s'affiche en pastilles
 * sous le champ **avant** d'enregistrer ; toucher une pastille l'annule, le
 * texte retourne dans le titre (`lib/quickAdd.ts`).
 */
export function QuickAddBar({ today, lists, placeholder, onAdd }: Props) {
  const [text, setText] = useState('');
  const [ignored, setIgnored] = useState<Set<TokenKind>>(new Set());
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseQuickAdd(text, today, lists, ignored), [text, today, lists, ignored]);

  function describe(kind: TokenKind): string {
    switch (kind) {
      case 'day':
        return `📅 ${dayLabel(parsed.plannedDay as string, today)}`;
      case 'time':
        return `⏰ ${timeLabel(parsed.plannedTime as string)}`;
      case 'due':
        return `⚑ avant le ${shortDate(parsed.dueDay as string, today)}`;
      case 'priority':
        return `! ${PRIORITY_TEXT[parsed.priority]}`;
      case 'list':
        return `# ${lists.find((l) => l.id === parsed.listId)?.name ?? ''}`;
      case 'repeat':
        return parsed.recurrence && parsed.plannedDay ? `↻ ${describeRecurrence(parsed.recurrence, parsed.plannedDay)}` : '↻';
    }
  }

  async function submit() {
    if (!parsed.title || busy) return;
    setBusy(true);
    try {
      await onAdd(parsed);
      setText('');
      setIgnored(new Set());
    } catch {
      // L'erreur est affichée par l'écran ; le texte reste pour réessayer.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="taches-quickadd">
      <div className="taches-quickadd-row">
        <span className="taches-quickadd-plus" aria-hidden="true">
          +
        </span>
        <input
          className="taches-quickadd-input"
          type="text"
          aria-label="Ajouter une tâche"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // Un nouveau texte peut ne plus contenir ce qu'on avait annulé : on repart de zéro.
            if (!e.target.value) setIgnored(new Set());
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
            if (e.key === 'Escape') setText('');
          }}
          disabled={busy}
        />
        {text.trim() && (
          <button className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={busy || !parsed.title}>
            Ajouter
          </button>
        )}
      </div>
      {parsed.tokens.length > 0 && (
        <div className="taches-quickadd-tokens" aria-label="Ce qui a été compris">
          {parsed.tokens.map((t) => (
            <button
              key={t.kind}
              type="button"
              className={`taches-token taches-token-${t.kind}`}
              title={`« ${t.text} » — toucher pour l’annuler`}
              onClick={() => setIgnored((prev) => new Set(prev).add(t.kind))}
            >
              {describe(t.kind)} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
