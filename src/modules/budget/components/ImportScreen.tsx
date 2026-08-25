import { useRef, useState } from 'react';
import { budgetStore } from '../data';
import { formatCents } from '../lib/amount';
import { buildImportPreview, parseBoursobankCsv } from '../lib/boursobankImport';
import type { BoursobankParseError, ImportPreviewRow } from '../lib/boursobankImport';
import type { BudgetCategory } from '../lib/types';

interface Preview {
  fileName: string;
  nouvelles: ImportPreviewRow[];
  connuesCount: number;
  parseErrors: BoursobankParseError[];
}

interface Result {
  written: number;
  skipped: number;
  rulesCreated: number;
}

/**
 * L'écran d'import (étape 5, docs/etude-astra.md §5 et §7 : « l'usage
 * devient tenable dans la durée »). Dépôt du fichier, aperçu, validation —
 * « rien n'est écrit avant » (§4). Les lignes à classer remontent en tête
 * (§4 point 4) : un choix de catégorie et, si coché, une règle créée pour
 * que le mois suivant se range tout seul.
 */
export function ImportScreen({ categories, onError }: { categories: BudgetCategory[]; onError: (message: string) => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [categoryChoice, setCategoryChoice] = useState<Record<string, string>>({});
  const [createRule, setCreateRule] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setResult(null);
    setPreview(null);
    try {
      const text = await file.text();
      const { rows, errors } = parseBoursobankCsv(text);
      const [entries, rules] = await Promise.all([budgetStore.listEntries(), budgetStore.listRules()]);
      const existingKeys = new Set(entries.map((e) => e.importKey).filter((k): k is string => k !== null));
      const { nouvelles, connuesCount } = buildImportPreview(rows, existingKeys, categories, rules);

      const initialChoices: Record<string, string> = {};
      nouvelles.forEach((p) => {
        if (p.suggestedCategoryId) initialChoices[p.row.importKey] = p.suggestedCategoryId;
      });
      setCategoryChoice(initialChoices);
      setCreateRule({});
      setPreview({ fileName: file.name, nouvelles, connuesCount, parseErrors: errors });
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Fichier illisible.');
    }
  }

  function cancelPreview() {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function validate() {
    if (!preview) return;
    setSaving(true);
    let written = 0;
    let skipped = 0;
    let rulesCreated = 0;
    try {
      for (const { row } of preview.nouvelles) {
        const categoryId = categoryChoice[row.importKey] || null;
        try {
          await budgetStore.createEntry({
            day: row.day,
            label: row.displayLabel,
            amountCents: row.amountCents,
            categoryId,
            source: 'import',
            importKey: row.importKey,
          });
          written++;
        } catch (err) {
          // L'unicité (user_id, import_key) est le filet de sécurité final
          // (docs/astra-import-boursobank.md §4) : si une ligne s'avère
          // déjà connue malgré la vérification faite au dépôt du fichier
          // (un import concurrent, par exemple), elle est comptée comme
          // déjà importée plutôt que de faire échouer tout le lot.
          const message = err instanceof Error ? err.message : '';
          if (/unique|duplicate|import_key/i.test(message)) {
            skipped++;
          } else {
            throw err;
          }
        }
        if (createRule[row.importKey] && categoryId) {
          await budgetStore.createRule({ pattern: row.rawLabel, categoryId, priority: 10 });
          rulesCreated++;
        }
      }
      setResult({ written, skipped, rulesCreated });
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Import impossible.');
    } finally {
      setSaving(false);
    }
  }

  const aClasser = preview?.nouvelles.filter((p) => !categoryChoice[p.row.importKey]) ?? [];
  const preClassees = preview?.nouvelles.filter((p) => categoryChoice[p.row.importKey]) ?? [];

  return (
    <div className="budget-import">
      <div className="budget-import-drop">
        <p>Dépose ton relevé BoursoBank exporté en CSV.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
          aria-label="Choisir le fichier du relevé"
        />
      </div>

      {result && (
        <div className="notice budget-import-result">
          {result.written} écriture{result.written > 1 ? 's' : ''} importée{result.written > 1 ? 's' : ''}
          {result.skipped > 0 && `, ${result.skipped} déjà connue${result.skipped > 1 ? 's' : ''} ignorée${result.skipped > 1 ? 's' : ''}`}
          {result.rulesCreated > 0 && `, ${result.rulesCreated} règle${result.rulesCreated > 1 ? 's' : ''} créée${result.rulesCreated > 1 ? 's' : ''}`}
          .
        </div>
      )}

      {preview && (
        <div className="budget-import-preview">
          <p className="budget-import-summary">
            <strong>{preview.fileName}</strong> —{' '}
            <span data-count="nouvelles">{preview.nouvelles.length}</span> nouvelle{preview.nouvelles.length > 1 ? 's' : ''} opération
            {preview.nouvelles.length > 1 ? 's' : ''}, <span data-count="connues">{preview.connuesCount}</span> déjà connue
            {preview.connuesCount > 1 ? 's' : ''}, <span data-count="a-classer">{aClasser.length}</span> à classer
          </p>

          {preview.parseErrors.length > 0 && (
            <div className="notice error">
              {preview.parseErrors.length} ligne{preview.parseErrors.length > 1 ? 's' : ''} illisible
              {preview.parseErrors.length > 1 ? 's' : ''}, ignorée{preview.parseErrors.length > 1 ? 's' : ''} :{' '}
              {preview.parseErrors.map((e) => `ligne ${e.line} (${e.reason})`).join(', ')}
            </div>
          )}

          {preview.nouvelles.length === 0 ? (
            <p className="budget-import-empty">Rien de nouveau : ce relevé est déjà entièrement importé.</p>
          ) : (
            <>
              {aClasser.length > 0 && (
                <section className="budget-import-group">
                  <h3 className="budget-group-title">À classer</h3>
                  <ul className="budget-list budget-import-rows">
                    {aClasser.map(({ row }) => (
                      <ImportRow
                        key={row.importKey}
                        label={row.displayLabel}
                        day={row.day}
                        amountCents={row.amountCents}
                        categories={categories}
                        categoryId={categoryChoice[row.importKey] ?? ''}
                        onCategoryChange={(id) => setCategoryChoice((c) => ({ ...c, [row.importKey]: id }))}
                        ruleChecked={createRule[row.importKey] ?? false}
                        onRuleChange={(checked) => setCreateRule((c) => ({ ...c, [row.importKey]: checked }))}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {preClassees.length > 0 && (
                <section className="budget-import-group">
                  <h3 className="budget-group-title">Déjà classées automatiquement</h3>
                  <ul className="budget-list budget-import-rows">
                    {preClassees.map(({ row }) => (
                      <ImportRow
                        key={row.importKey}
                        label={row.displayLabel}
                        day={row.day}
                        amountCents={row.amountCents}
                        categories={categories}
                        categoryId={categoryChoice[row.importKey] ?? ''}
                        onCategoryChange={(id) => setCategoryChoice((c) => ({ ...c, [row.importKey]: id }))}
                        ruleChecked={createRule[row.importKey] ?? false}
                        onRuleChange={(checked) => setCreateRule((c) => ({ ...c, [row.importKey]: checked }))}
                      />
                    ))}
                  </ul>
                </section>
              )}

              <div className="budget-import-actions">
                <button className="btn" onClick={cancelPreview} disabled={saving}>
                  Annuler
                </button>
                <button className="btn btn-primary" onClick={() => void validate()} disabled={saving}>
                  {saving ? 'Import…' : "Valider l'import"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ImportRow({
  label,
  day,
  amountCents,
  categories,
  categoryId,
  onCategoryChange,
  ruleChecked,
  onRuleChange,
}: {
  label: string;
  day: string;
  amountCents: number;
  categories: BudgetCategory[];
  categoryId: string;
  onCategoryChange: (id: string) => void;
  ruleChecked: boolean;
  onRuleChange: (checked: boolean) => void;
}) {
  return (
    <li className="budget-row budget-import-row">
      <span className="budget-row-day">{day}</span>
      <span className="budget-row-name">{label}</span>
      <span className={`budget-row-amount${amountCents < 0 ? ' negative' : ' positive'}`}>{formatCents(amountCents)}</span>
      <select
        aria-label={`Catégorie pour ${label}`}
        value={categoryId}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="">À classer</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji} {c.name}
          </option>
        ))}
      </select>
      <label className="budget-import-rule-toggle">
        <input type="checkbox" checked={ruleChecked} onChange={(e) => onRuleChange(e.target.checked)} disabled={!categoryId} />
        Créer une règle
      </label>
    </li>
  );
}
