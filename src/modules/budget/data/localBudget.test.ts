import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBudget } from './localBudget';

/**
 * Le module s'appuie sur localStorage ; en environnement Node on en fournit
 * une version minimale plutôt que de tirer tout un DOM — même motif que
 * `modules/objectifs/data/outbox.test.ts`.
 */
const memory = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

describe('LocalBudget', () => {
  let store: LocalBudget;

  beforeEach(() => {
    memory.clear();
    store = new LocalBudget();
  });

  it('crée une catégorie avec ses valeurs par défaut', async () => {
    const category = await store.createCategory({ name: 'Courses' });
    expect(category.kind).toBe('variable');
    expect(category.position).toBe(0);
    expect(await store.listCategories()).toEqual([category]);
  });

  it('numérote les catégories dans leur ordre de création', async () => {
    await store.createCategory({ name: 'Loyer', kind: 'fixe' });
    await store.createCategory({ name: 'Courses', kind: 'variable' });
    const positions = (await store.listCategories()).map((c) => c.position);
    expect(positions).toEqual([0, 1]);
  });

  it('arrondit un montant en centimes entiers, jamais en flottant', async () => {
    const entry = await store.createEntry({ day: '2026-07-04', label: 'Test', amountCents: -1234.6 });
    expect(entry.amountCents).toBe(-1235);
    expect(Number.isInteger(entry.amountCents)).toBe(true);
  });

  it('une écriture sans catégorie reste « à classer », pas masquée', async () => {
    const entry = await store.createEntry({ day: '2026-07-01', label: 'Non catégorisé', amountCents: -500 });
    expect(entry.categoryId).toBeNull();
    expect(await store.listEntries()).toContainEqual(entry);
  });

  it('supprimer une catégorie remet ses écritures et règles « à classer »', async () => {
    const category = await store.createCategory({ name: 'Loisirs' });
    const entry = await store.createEntry({
      day: '2026-07-10',
      label: 'Concert',
      amountCents: -4500,
      categoryId: category.id,
    });
    await store.createRule({ pattern: 'CONCERT', categoryId: category.id });

    await store.deleteCategory(category.id);

    const [updated] = await store.listEntries();
    expect(updated.id).toBe(entry.id);
    expect(updated.categoryId).toBeNull();
    expect(await store.listRules()).toEqual([]);
  });

  it('exporte puis réimporte fidèlement, enveloppes et mouvements compris', async () => {
    await store.createCategory({ name: 'Salaire', kind: 'revenu' });
    await store.createEntry({ day: '2026-07-01', label: 'Virement', amountCents: 250000 });
    const envelope = await store.createEnvelope({ name: 'Voiture' });
    await store.createEnvelopeMove({ envelopeId: envelope.id, amountCents: 10000, day: '2026-07-05' });
    const backup = await store.exportData();

    const restored = new LocalBudget();
    await restored.importData(backup);

    expect(await restored.listCategories()).toEqual(backup.categories);
    expect(await restored.listEntries()).toEqual(backup.entries);
    expect(await restored.listEnvelopes()).toEqual(backup.envelopes);
    expect(await restored.listEnvelopeMoves()).toEqual(backup.envelopeMoves);
  });

  it('crée une enveloppe avec ses valeurs par défaut, numérotée dans son ordre de création', async () => {
    const voiture = await store.createEnvelope({ name: 'Voiture' });
    const vacances = await store.createEnvelope({ name: 'Vacances', emoji: '🏖️' });
    expect(voiture.position).toBe(0);
    expect(vacances.position).toBe(1);
    expect(vacances.emoji).toBe('🏖️');
    expect(await store.listEnvelopes()).toEqual([voiture, vacances]);
  });

  it('le solde d’une enveloppe se lit en sommant ses mouvements, jamais stocké (etude-astra-epargne.md §4.3)', async () => {
    const envelope = await store.createEnvelope({ name: 'Voiture' });
    await store.createEnvelopeMove({ envelopeId: envelope.id, amountCents: 100000, day: '2026-07-01' });
    await store.createEnvelopeMove({ envelopeId: envelope.id, amountCents: -8000, day: '2026-08-01', note: 'Vidange' });
    const moves = await store.listEnvelopeMoves();
    const balance = moves
      .filter((m) => m.envelopeId === envelope.id)
      .reduce((sum, m) => sum + m.amountCents, 0);
    expect(balance).toBe(92000);
  });

  it('un montant de mouvement est arrondi en centimes entiers, jamais en flottant', async () => {
    const envelope = await store.createEnvelope({ name: 'Voiture' });
    const move = await store.createEnvelopeMove({ envelopeId: envelope.id, amountCents: 1234.6, day: '2026-07-01' });
    expect(move.amountCents).toBe(1235);
    expect(Number.isInteger(move.amountCents)).toBe(true);
  });

  it('supprimer une enveloppe supprime ses mouvements : ses fonds retournent au non-affecté (etude-astra-epargne.md §7 Q5)', async () => {
    const envelope = await store.createEnvelope({ name: 'Voiture' });
    await store.createEnvelopeMove({ envelopeId: envelope.id, amountCents: 50000, day: '2026-07-01' });

    await store.deleteEnvelope(envelope.id);

    expect(await store.listEnvelopes()).toEqual([]);
    expect(await store.listEnvelopeMoves()).toEqual([]);
  });

  it('supprimer une enveloppe ne touche pas les mouvements d’une autre', async () => {
    const voiture = await store.createEnvelope({ name: 'Voiture' });
    const vacances = await store.createEnvelope({ name: 'Vacances' });
    await store.createEnvelopeMove({ envelopeId: voiture.id, amountCents: 30000, day: '2026-07-01' });
    const vacancesMove = await store.createEnvelopeMove({ envelopeId: vacances.id, amountCents: 20000, day: '2026-07-01' });

    await store.deleteEnvelope(voiture.id);

    expect(await store.listEnvelopeMoves()).toEqual([vacancesMove]);
  });

  it('supprimer un mouvement isolé ne touche pas l’enveloppe ni les autres mouvements', async () => {
    const envelope = await store.createEnvelope({ name: 'Voiture' });
    const move1 = await store.createEnvelopeMove({ envelopeId: envelope.id, amountCents: 30000, day: '2026-07-01' });
    const move2 = await store.createEnvelopeMove({ envelopeId: envelope.id, amountCents: 5000, day: '2026-07-15' });

    await store.deleteEnvelopeMove(move1.id);

    expect(await store.listEnvelopes()).toEqual([envelope]);
    expect(await store.listEnvelopeMoves()).toEqual([move2]);
  });
});
