import { useMemo } from 'react';
import { BUDGET_CATEGORY_KINDS, CATEGORY_KIND_LABELS, type BudgetCategory, type BudgetCategoryKind } from '../lib/types';

/**
 * Le menu des catégories, groupé par nature — commun à la fenêtre d'une
 * écriture, des règles et du classement par lot. Une sous-catégorie
 * s'affiche juste après la sienne, en retrait (« ↳ ») : un `<optgroup>` HTML
 * ne peut pas s'imbriquer, ce préfixe en tient lieu.
 */
export function CategorySelect({
  id,
  value,
  onChange,
  categories,
  emptyLabel = 'À classer',
  ariaLabel,
  kindOrder = BUDGET_CATEGORY_KINDS,
}: {
  id?: string;
  /** `''` : aucune catégorie */
  value: string;
  onChange: (categoryId: string) => void;
  categories: readonly BudgetCategory[];
  emptyLabel?: string;
  ariaLabel?: string;
  /** L'ordre des groupes : la fenêtre d'une écriture met d'abord ce qui va avec son sens. */
  kindOrder?: readonly BudgetCategoryKind[];
}) {
  const groups = useMemo(
    () =>
      kindOrder.map((kind) => {
        const items: { category: BudgetCategory; indent: boolean }[] = [];
        for (const category of categories.filter((c) => c.kind === kind && c.parentId === null).sort((a, b) => a.position - b.position)) {
          items.push({ category, indent: false });
          for (const child of categories.filter((c) => c.parentId === category.id).sort((a, b) => a.position - b.position)) {
            items.push({ category: child, indent: true });
          }
        }
        return { kind, label: CATEGORY_KIND_LABELS[kind], items };
      }).filter((group) => group.items.length > 0),
    [categories, kindOrder],
  );

  return (
    <select id={id} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {groups.map((group) => (
        <optgroup key={group.kind} label={group.label}>
          {group.items.map(({ category: c, indent }) => (
            <option key={c.id} value={c.id}>
              {indent ? '↳ ' : ''}
              {c.emoji} {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
