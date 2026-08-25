import { describe, expect, it } from 'vitest';
import { parseCsvRecords, parseCsvRows } from './csv';

describe('parseCsvRows', () => {
  it('découpe des lignes simples', () => {
    expect(parseCsvRows('a;b;c\n1;2;3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('retire le BOM UTF-8 en tête de fichier', () => {
    const withBom = '﻿dateOp;label\n2026-03-31;Test';
    expect(parseCsvRows(withBom)).toEqual([
      ['dateOp', 'label'],
      ['2026-03-31', 'Test'],
    ]);
  });

  it('lit un champ entre guillemets, y compris avec le délimiteur dedans', () => {
    expect(parseCsvRows('a;"b;c";d')).toEqual([['a', 'b;c', 'd']]);
  });

  it('déséchappe un guillemet doublé', () => {
    expect(parseCsvRows('"Le ""concert""";1')).toEqual([['Le "concert"', '1']]);
  });

  it('tolère les fins de ligne CRLF en plus du LF documenté', () => {
    expect(parseCsvRows('a;b\r\n1;2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('ignore une ligne vide finale plutôt que d’en faire un enregistrement fantôme', () => {
    expect(parseCsvRows('a;b\n1;2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseCsvRecords', () => {
  it('associe chaque valeur à sa colonne d’en-tête', () => {
    expect(parseCsvRecords('dateOp;label\n2026-03-31;"VIR EXEMPLE"')).toEqual([
      { dateOp: '2026-03-31', label: 'VIR EXEMPLE' },
    ]);
  });

  it('rend un tableau vide pour un fichier sans ligne de données', () => {
    expect(parseCsvRecords('dateOp;label')).toEqual([]);
    expect(parseCsvRecords('')).toEqual([]);
  });
});
