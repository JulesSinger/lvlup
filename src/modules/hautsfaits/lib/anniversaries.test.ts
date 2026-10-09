import { describe, expect, it } from 'vitest';
import { anniversariesBetween, anniversaryMarks, plannedReminders } from './anniversaries';
import type { DatePrecision, Feat } from './types';

function feat(id: string, dateStart: string, datePrecision: DatePrecision = 'day'): Feat {
  return {
    id,
    title: id,
    category: 'sport',
    dateStart,
    datePrecision,
    dateEnd: null,
    dateEndPrecision: null,
    major: false,
    highlight: '',
    place: '',
    people: '',
    story: '',
    createdAt: '2026-09-30T10:00:00Z',
    updatedAt: '2026-09-30T10:00:00Z',
  };
}

const feats = [feat('semi', '2023-04-02'), feat('madrid', '2021-01-01', 'month'), feat('brevet', '2014-01-01', 'year'), feat('bissextile', '2020-02-29')];

describe('les anniversaires', () => {
  it('seulement au jour près, et jamais l’année même', () => {
    expect(anniversariesBetween(feats, '2023-01-01', '2026-12-31').map((a) => `${a.feat.id} ${a.day} ${a.years}`)).toEqual([
      'bissextile 2023-02-28 3',
      'bissextile 2024-02-29 4',
      'semi 2024-04-02 1',
      'bissextile 2025-02-28 5',
      'semi 2025-04-02 2',
      'bissextile 2026-02-28 6',
      'semi 2026-04-02 3',
    ]);
  });

  it('font des marques qui ouvrent le haut fait', () => {
    expect(anniversaryMarks(feats, '2026-04-01', '2026-04-30')).toEqual([
      { id: 'feat:semi:2026', day: '2026-04-02', title: 'semi · 3 ans', detail: 'Il y a 3 ans', link: 'feat:semi' },
    ]);
  });

  it('le rappel du matin, seulement s’il est voulu et à venir', () => {
    const now = new Date(2026, 3, 1, 12, 0);
    expect(plannedReminders(feats, false, now)).toEqual([]);
    const planned = plannedReminders(feats, true, now);
    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({ ref: 'feat:semi:2026-04-02', title: '✨ Ce jour-là, il y a 3 ans', body: 'semi', url: '/#/hautsfaits' });
    expect(new Date(planned[0].fireAt).getHours()).toBe(9);
    // Le jour même, après 9 h : trop tard.
    expect(plannedReminders(feats, true, new Date(2026, 3, 2, 10, 0))).toEqual([]);
  });
});
