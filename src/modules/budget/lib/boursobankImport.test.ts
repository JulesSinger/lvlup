import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildImportPreview, parseBoursobankCsv, suggestCategoryId } from './boursobankImport';
import type { BudgetCategory, BudgetRule } from './types';

/**
 * Le relevé de test — `docs/exemples/releve-exemple.csv` — est le seul CSV
 * bancaire que ce projet ait le droit de contenir (CLAUDE.md) : un export
 * synthétique, mais fidèle octet pour octet au format réel documenté dans
 * `docs/astra-import-boursobank.md` (BOM, guillemets, virgule décimale,
 * espace de milliers, doublon volontaire, remboursement, virements
 * internes des deux sens).
 */
const FIXTURE_PATH = fileURLToPath(new URL('../../../../docs/exemples/releve-exemple.csv', import.meta.url));
const FIXTURE_CSV = readFileSync(FIXTURE_PATH, 'utf-8');

function category(patch: Partial<BudgetCategory>): BudgetCategory {
  return {
    id: patch.id ?? patch.name ?? 'cat',
    name: 'Catégorie',
    emoji: '💶',
    color: '#000000',
    kind: 'variable',
    position: 0,
    ...patch,
  };
}

const STARTER_LIKE_CATEGORIES: BudgetCategory[] = [
  category({ id: 'c-courses', name: 'Courses' }),
  category({ id: 'c-restaurants', name: 'Restaurants & bars' }),
  category({ id: 'c-sorties', name: 'Sorties & loisirs' }),
  category({ id: 'c-sante', name: 'Santé' }),
  category({ id: 'c-abonnements', name: 'Abonnements', kind: 'fixe' }),
  category({ id: 'c-voyages', name: 'Voyages' }),
  category({ id: 'c-salaire', name: 'Salaire', kind: 'revenu' }),
  category({ id: 'c-virements-internes', name: 'Virements internes', kind: 'transfert' }),
];

describe('parseBoursobankCsv (sur le relevé d’exemple)', () => {
  const { rows, errors } = parseBoursobankCsv(FIXTURE_CSV);

  it('lit les treize lignes du relevé sans erreur', () => {
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(13);
  });

  it('retire le BOM et lit correctement la première colonne', () => {
    expect(rows[0].day).toBe('2026-03-31');
  });

  it('lit un montant avec espace de milliers, signé', () => {
    const virement = rows.find((r) => r.rawLabel === 'VIR SEPA EXEMPLE EMPLOYEUR');
    expect(virement?.amountCents).toBe(210000);
    const debit = rows.find((r) => r.rawLabel === 'VIR Virement depuis BoursoBank');
    expect(debit?.amountCents).toBe(-120000);
  });

  it('affiche le nom suggéré quand il existe, jamais le libellé brut seul', () => {
    const supermarche = rows.find((r) => r.rawLabel.includes('SUPERMARCHE'));
    expect(supermarche?.displayLabel).toBe('Supermarche');
  });

  it('distingue par un rang d’occurrence les deux lignes de concert strictement identiques (§4)', () => {
    const concerts = rows.filter((r) => r.rawLabel.includes('CONCERT EXEMPLE CB*0000') && r.amountCents === -4500);
    expect(concerts).toHaveLength(2);
    expect(concerts.map((r) => r.occurrence).sort()).toEqual([1, 2]);
    expect(concerts[0].importKey).not.toBe(concerts[1].importKey);
  });

  it('le remboursement (AVOIR) reste une ligne distincte, montant positif', () => {
    const avoir = rows.find((r) => r.rawLabel.startsWith('AVOIR'));
    expect(avoir?.amountCents).toBe(4500);
  });
});

describe('suggestCategoryId', () => {
  const { rows } = parseBoursobankCsv(FIXTURE_CSV);
  const byLabel = (fragment: string, amount?: number) =>
    rows.find((r) => r.rawLabel.includes(fragment) && (amount === undefined || r.amountCents === amount))!;

  it('route un virement interne débiteur vers Virements internes (etude-astra.md §2/§6)', () => {
    const row = byLabel('VIR Virement depuis BoursoBank');
    expect(suggestCategoryId(row, STARTER_LIKE_CATEGORIES, [])).toBe('c-virements-internes');
  });

  it('route un virement interne créditeur vers Virements internes', () => {
    const row = byLabel('VIR Virement depuis LIVRET A');
    expect(suggestCategoryId(row, STARTER_LIKE_CATEGORIES, [])).toBe('c-virements-internes');
  });

  it('route Alimentation (Vie quotidienne) vers Courses', () => {
    const row = byLabel('SUPERMARCHE');
    expect(suggestCategoryId(row, STARTER_LIKE_CATEGORIES, [])).toBe('c-courses');
  });

  it('route un remboursement Santé vers Santé, sans en faire un revenu (§6)', () => {
    const row = byLabel('VIR SEPA MUTUELLE EXEMPLE');
    expect(suggestCategoryId(row, STARTER_LIKE_CATEGORIES, [])).toBe('c-sante');
  });

  it('route un abonnement vers Abonnements', () => {
    const row = byLabel('PRLV SEPA OPERATEUR EXEMPLE');
    expect(suggestCategoryId(row, STARTER_LIKE_CATEGORIES, [])).toBe('c-abonnements');
  });

  it('laisse « à classer » un virement émis ordinaire, faute de catégorie de départ fiable', () => {
    const row = byLabel('VIR INST CONTACT EXEMPLE');
    expect(suggestCategoryId(row, STARTER_LIKE_CATEGORIES, [])).toBeNull();
  });

  it('laisse « à classer » un virement reçu, ambigu entre Salaire et Aides', () => {
    const row = byLabel('VIR SEPA EXEMPLE EMPLOYEUR');
    expect(suggestCategoryId(row, STARTER_LIKE_CATEGORIES, [])).toBeNull();
  });

  it('laisse « à classer » une ligne déjà « Non catégorisé » côté BoursoBank', () => {
    const row = byLabel('ATELIER EXEMPLE');
    expect(suggestCategoryId(row, STARTER_LIKE_CATEGORIES, [])).toBeNull();
  });

  it('laisse « à classer » Auto & Moto, faute de catégorie Transport au nom exact', () => {
    const row = byLabel('STATION EXEMPLE');
    expect(suggestCategoryId(row, STARTER_LIKE_CATEGORIES, [])).toBeNull();
  });

  it('une règle utilisateur l’emporte toujours sur l’amorce BoursoBank', () => {
    const row = byLabel('SUPERMARCHE');
    const rules: BudgetRule[] = [{ id: 'r1', pattern: 'SUPERMARCHE', categoryId: 'c-restaurants', priority: 5 }];
    expect(suggestCategoryId(row, STARTER_LIKE_CATEGORIES, rules)).toBe('c-restaurants');
  });

  it('parmi plusieurs règles qui matchent, la priorité la plus haute gagne', () => {
    const row = byLabel('SUPERMARCHE');
    const rules: BudgetRule[] = [
      { id: 'r1', pattern: 'SUPERMARCHE', categoryId: 'c-restaurants', priority: 1 },
      { id: 'r2', pattern: 'CARTE', categoryId: 'c-voyages', priority: 9 },
    ];
    expect(suggestCategoryId(row, STARTER_LIKE_CATEGORIES, rules)).toBe('c-voyages');
  });

  it('si la catégorie de départ visée n’existe pas (renommée, supprimée), reste « à classer »', () => {
    const row = byLabel('SUPERMARCHE');
    expect(suggestCategoryId(row, [], [])).toBeNull();
  });
});

describe('buildImportPreview', () => {
  const { rows } = parseBoursobankCsv(FIXTURE_CSV);

  it('sépare nouvelles et déjà connues par empreinte, sur un premier import', () => {
    const preview = buildImportPreview(rows, new Set(), STARTER_LIKE_CATEGORIES, []);
    expect(preview.connuesCount).toBe(0);
    expect(preview.nouvelles).toHaveLength(13);
  });

  it('cinq lignes sur treize restent à classer au premier import, comme sur le relevé réel (§5)', () => {
    const preview = buildImportPreview(rows, new Set(), STARTER_LIKE_CATEGORIES, []);
    const aClasser = preview.nouvelles.filter((p) => p.suggestedCategoryId === null);
    expect(aClasser).toHaveLength(5);
  });

  it('réimporter le même relevé ne propose plus aucune nouvelle ligne (§4 : « réimporter ne doit jamais dupliquer »)', () => {
    const first = buildImportPreview(rows, new Set(), STARTER_LIKE_CATEGORIES, []);
    const allKeys = new Set(rows.map((r) => r.importKey));
    const second = buildImportPreview(rows, allKeys, STARTER_LIKE_CATEGORIES, []);
    expect(first.nouvelles.length).toBeGreaterThan(0);
    expect(second.nouvelles).toHaveLength(0);
    expect(second.connuesCount).toBe(13);
  });

  it('les deux places de concert comptent comme deux nouvelles lignes au premier import', () => {
    const preview = buildImportPreview(rows, new Set(), STARTER_LIKE_CATEGORIES, []);
    const concerts = preview.nouvelles.filter((p) => p.row.rawLabel.includes('CONCERT EXEMPLE CB*0000') && p.row.amountCents === -4500);
    expect(concerts).toHaveLength(2);
  });
});
