import type { ModuleDemo } from '../../core/lib/module';
import { budgetStore as store } from './data';
import { STARTER_CATEGORIES } from './lib/starterCategories';

const pad = (n: number) => String(n).padStart(2, '0');

/** Le jour `day` du mois `back` mois avant celui de `today` ; jamais après aujourd'hui. */
function inMonth(today: string, back: number, day: number): string | null {
  const [y, m] = today.split('-').map(Number);
  const date = new Date(y, m - 1 - back, 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(Math.min(day, last))}`;
  return value <= today ? value : null;
}

/** Un mois type : le jour, le libellé, le montant en euros (négatif : une dépense), la catégorie. */
const MONTH: [number, string, number, string][] = [
  [1, 'Salaire', 2400, 'Salaire'],
  [2, 'Loyer', -850, 'Loyer'],
  [3, 'Free Mobile', -19.99, 'Internet & mobile'],
  [4, 'Carrefour', -62.4, 'Courses'],
  [6, 'Netflix', -13.49, 'Abonnements'],
  [7, 'Boulangerie', -6.8, 'Courses'],
  [9, 'Le Bistrot', -38, 'Restaurants & bars'],
  [11, 'Lidl', -48.15, 'Courses'],
  [12, 'Virement épargne', -300, 'Épargne'],
  [14, 'Cinéma', -24, 'Sorties & loisirs'],
  [16, 'Pharmacie', -12.3, 'Santé'],
  [18, 'Carrefour', -71.2, 'Courses'],
  [21, 'Sushi Shop', -27.5, 'Restaurants & bars'],
  [23, 'Zara', -45.99, 'Vêtements'],
  [25, 'Lidl', -39.8, 'Courses'],
  [27, 'Bar Le Comptoir', -18, 'Restaurants & bars'],
];

/**
 * La démo de Budget (15/10/2026) : les catégories de départ, trois mois de
 * relevé (pour le camembert, l'évolution et les comparaisons), une écriture à
 * classer, une enveloppe d'épargne et un abonnement déclaré.
 */
export const budgetDemo: ModuleDemo = {
  async seed(today) {
    const ids = new Map<string, string>();
    for (const input of STARTER_CATEGORIES) ids.set(input.name, (await store.createCategory(input)).id);
    const entries = [];
    for (const back of [2, 1, 0]) {
      for (const [n, [day, label, euros, category]] of MONTH.entries()) {
        const d = inMonth(today, back, day);
        // Les mois se ressemblent sans être identiques : quelques euros de plus ou de moins.
        if (d) entries.push({ day: d, label, amountCents: Math.round(euros * 100) + (euros < 0 && label !== 'Loyer' ? ((n * 37 + back * 53) % 900) - 450 : 0), categoryId: ids.get(category) ?? null, source: 'manuelle' as const });
      }
    }
    const unsorted = inMonth(today, 0, 10) ?? today;
    entries.push({ day: unsorted, label: 'PAYPAL *VINTED', amountCents: -2200, categoryId: null, source: 'manuelle' as const });
    await store.importEntries(entries);
    const envelope = await store.createEnvelope({ name: 'Vacances', emoji: '🏖️' });
    await store.createEnvelopeMove({ envelopeId: envelope.id, amountCents: 45_000, day: inMonth(today, 1, 12) ?? today, note: 'Pour l’été' });
    await store.createSubscription({ name: 'Assurance habitation', amountCents: 14_400, frequency: 'annuel', nextDay: inMonth(today, -2, 5) ?? today, categoryId: ids.get('Assurances') ?? null });
  },
  tour: [
    {
      target: '.budget-tabs',
      title: 'Six onglets',
      body: 'L’aperçu du mois, l’évolution sur plusieurs mois, les abonnements, l’épargne en enveloppes, l’import du relevé et tes catégories.',
    },
    {
      target: '.budget-month-selector',
      title: 'Un mois à la fois',
      body: 'Ce qui est sorti, ce qui est entré, et le solde, comparés au mois d’avant.',
    },
    {
      target: '.budget-pie',
      title: 'Où part l’argent',
      body: 'Touche une part du camembert : la liste dessous ne garde que ses dépenses.',
    },
    {
      target: '.budget-search',
      title: 'Retrouver une dépense',
      body: 'Un mot, un montant : toutes les écritures, tous mois confondus.',
    },
    {
      target: '.budget-add',
      title: 'Ajouter à la main',
      body: 'Une dépense en espèces, un remboursement — ou plusieurs d’un coup. Le reste arrive par l’import de ton relevé (onglet Importer).',
    },
    {
      title: 'À toi',
      body: 'Ce sont des exemples : classe la ligne « à classer », ouvre l’onglet Épargne ou Évolution. Rien n’est enregistré dans ton compte.',
    },
  ],
};
