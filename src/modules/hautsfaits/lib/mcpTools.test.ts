import { describe, expect, it } from 'vitest';
import * as server from '../../../../supabase/functions/atlas-mcp/hautsfaits.ts';
import { hautsfaitsTools, type FeatRow, type HautsFaitsData } from '../../../../supabase/functions/atlas-mcp/hautsfaits.ts';
import { CATEGORY_INFO } from './categories';
import { alignDate, formatFeatSpan } from './dates';
import * as types from './types';
import { validateFeat } from './validation';

// Les outils de Hauts faits du connecteur (docs/connecteur-claude.md §18).

describe('connecteur — Hauts faits : les copies suivent le module', () => {
  it('reprend les bornes et les catégories', () => {
    expect(server.FEAT_CATEGORIES).toEqual(types.FEAT_CATEGORIES);
    expect(server.DATE_PRECISIONS).toEqual(types.DATE_PRECISIONS);
    expect(Object.fromEntries(Object.entries(server.CATEGORY_LABELS))).toEqual(Object.fromEntries(Object.entries(CATEGORY_INFO).map(([k, v]) => [k, v.label])));
    expect([server.FEAT_TITLE_MAX, server.FEAT_HIGHLIGHT_MAX, server.FEAT_PLACE_MAX, server.FEAT_PEOPLE_MAX, server.FEAT_STORY_MAX]).toEqual([
      types.FEAT_TITLE_MAX,
      types.FEAT_HIGHLIGHT_MAX,
      types.FEAT_PLACE_MAX,
      types.FEAT_PEOPLE_MAX,
      types.FEAT_STORY_MAX,
    ]);
  });

  it('range, dit et valide les dates pareil', () => {
    for (const [d, p] of [
      ['2019-06-14', 'day'],
      ['2019-06-14', 'month'],
      ['2019-06-14', 'year'],
    ] as const)
      expect(server.alignDate(d, p)).toBe(alignDate(d, p));
    const spans = [
      { dateStart: '2019-01-01', datePrecision: 'year', dateEnd: null, dateEndPrecision: null },
      { dateStart: '2019-03-01', datePrecision: 'month', dateEnd: '2019-09-01', dateEndPrecision: 'month' },
      { dateStart: '2019-03-12', datePrecision: 'day', dateEnd: '2019-03-20', dateEndPrecision: 'day' },
      { dateStart: '2018-09-01', datePrecision: 'month', dateEnd: '2019-01-01', dateEndPrecision: 'year' },
    ] as const;
    for (const s of spans) expect(server.formatFeatSpan(s)).toBe(formatFeatSpan(s));
    const inputs = [
      { title: 'Bac', category: 'etudes', dateStart: '2014-07-01', datePrecision: 'month' },
      { title: 'Bac', category: 'etudes', dateStart: '2014-07-04', datePrecision: 'month' },
      { title: 'Futur', category: 'autre', dateStart: '2030-01-01', datePrecision: 'year' },
      { title: 'Erasmus', category: 'voyage', dateStart: '2019-02-01', datePrecision: 'month', dateEnd: '2019-02-01', dateEndPrecision: 'month' },
      { title: '', category: 'sport', dateStart: '2020-01-01', datePrecision: 'year' },
    ] as const;
    for (const i of inputs) expect(server.validateFeat(i, '2026-10-12')).toBe(validateFeat(i as types.FeatInput, '2026-10-12'));
  });

  it('lit une date à la précision donnée', () => {
    expect(server.readFeatDate('2019', 'date')).toEqual({ day: '2019-01-01', precision: 'year' });
    expect(server.readFeatDate('2019-06', 'date')).toEqual({ day: '2019-06-01', precision: 'month' });
    expect(server.readFeatDate('2019-06-14', 'date')).toEqual({ day: '2019-06-14', precision: 'day' });
    expect(() => server.readFeatDate('juin 2019', 'date')).toThrow(/AAAA/);
    expect(() => server.readFeatDate('2019-02-30', 'date')).toThrow();
  });
});

function memory() {
  let k = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++k).padStart(12, '0')}`;
  const feats: FeatRow[] = [];
  const photos = new Map<string, number>();
  const data: HautsFaitsData = {
    listFeats: async () => feats.map((f) => ({ ...f })),
    photoCounts: async () => photos,
    insertFeat: async (r) => {
      const f = { id: uuid(), created_at: `2026-10-12T10:00:0${k}Z`, ...r } as FeatRow;
      feats.push(f);
      return f;
    },
    updateFeat: async (id, r) => Object.assign(feats.find((f) => f.id === id)!, r),
    deleteFeat: async (id) => {
      const i = feats.findIndex((f) => f.id === id);
      if (i < 0) return false;
      feats.splice(i, 1);
      return true;
    },
  };
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await hautsfaitsTools.find((t) => t.name === name)!.run(args, { data, today: '2026-10-12' });
    try {
      return JSON.parse(result.text);
    } catch {
      return { text: result.text };
    }
  };
  return { feats, photos, call };
}

describe('connecteur — Hauts faits : les outils', () => {
  it('ajoute des hauts faits à leur précision, et la frise les rend du plus récent', async () => {
    const m = memory();
    await m.call('hautsfaits_ajouter', { title: 'Le bac', category: 'Études', date: '2014-07', highlight: 'mention bien' });
    const semi = await m.call('hautsfaits_ajouter', { title: 'Semi-marathon d’Annecy', category: 'sport', date: '2025-04-27', highlight: '1 h 52', place: 'Annecy', major: true });
    await m.call('hautsfaits_ajouter', { title: 'Erasmus', category: 'voyage', date: '2019-02', date_end: '2019-07', people: 'la coloc' });
    expect(m.feats[0]).toMatchObject({ date_start: '2014-07-01', date_precision: 'month', category: 'etudes', major: false });
    expect(semi.feat).toMatchObject({ when: '27 avril 2025', category: 'Sport', major: true });
    const frise = await m.call('hautsfaits_frise', {});
    expect(frise.feats.map((f: { title: string }) => f.title)).toEqual(['Semi-marathon d’Annecy', 'Erasmus', 'Le bac']);
    expect(frise.feats[1].when).toBe('février – juillet 2019');
    expect((await m.call('hautsfaits_frise', { year: 2019 })).feats).toHaveLength(1);
    await expect(m.call('hautsfaits_ajouter', { title: 'X', category: 'autre', date: '2027' })).rejects.toThrow(/après aujourd’hui/);
    await expect(m.call('hautsfaits_ajouter', { title: 'X', category: 'loisirs', date: '2020' })).rejects.toThrow(/category/);
  });

  it('modifie sans perdre le reste, et ne supprime pas un haut fait qui a des photos', async () => {
    const m = memory();
    const bac = await m.call('hautsfaits_ajouter', { title: 'Le bac', category: 'etudes', date: '2014', place: 'Lyon' });
    await m.call('hautsfaits_modifier', { id: bac.feat.id, date: '2014-07-04', story: 'Les résultats sur le panneau.' });
    expect(m.feats[0]).toMatchObject({ date_start: '2014-07-04', date_precision: 'day', place: 'Lyon', story: 'Les résultats sur le panneau.' });
    m.photos.set(bac.feat.id, 2);
    await expect(m.call('hautsfaits_supprimer', { id: bac.feat.id })).rejects.toThrow(/photos/);
    m.photos.clear();
    await m.call('hautsfaits_supprimer', { id: bac.feat.id });
    expect(m.feats).toEqual([]);
  });
});
