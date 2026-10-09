import { describe, expect, it } from 'vitest';
import { archiveFolders, archiveName } from './archive';
import type { DatePrecision, Feat } from './types';

const feat = (id: string, title: string, dateStart: string, datePrecision: DatePrecision): Feat => ({
  id,
  title,
  category: 'autre',
  dateStart,
  datePrecision,
  dateEnd: null,
  dateEndPrecision: null,
  major: false,
  highlight: '',
  place: '',
  people: '',
  story: '',
  createdAt: '',
  updatedAt: '',
});

describe('l’archive des photos', () => {
  it('nomme un dossier par la date, aussi précise qu’on la connaît, et le titre', () => {
    expect(archiveName(feat('a', 'Bac', '2017-07-05', 'day'))).toBe('2017-07-05 Bac');
    expect(archiveName(feat('b', 'Madrid', '2021-01-01', 'month'))).toBe('2021-01 Madrid');
    expect(archiveName(feat('c', 'Brevet', '2014-01-01', 'year'))).toBe('2014 Brevet');
    expect(archiveName(feat('d', 'A/B : « 1 » ?', '2014-01-01', 'year'))).toBe('2014 A B « 1 »');
  });

  it('deux dossiers ne portent jamais le même nom', () => {
    const folders = archiveFolders([feat('a', 'Semi', '2023-04-02', 'day'), feat('b', 'Semi', '2023-04-02', 'day'), feat('c', 'Semi', '2023-04-02', 'day')]);
    expect([...folders.values()]).toEqual(['2023-04-02 Semi', '2023-04-02 Semi (2)', '2023-04-02 Semi (3)']);
  });
});
