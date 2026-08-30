import { describe, expect, it } from 'vitest';
import { parseBulkImport, withoutDuplicates } from './bulkImport';

describe('parseBulkImport', () => {
  it('sépare recto et verso sur un point-virgule', () => {
    const result = parseBulkImport('Hola ; Bonjour\nAdios ; Au revoir');
    expect(result.cards).toEqual([
      { front: 'Hola', back: 'Bonjour' },
      { front: 'Adios', back: 'Au revoir' },
    ]);
    expect(result.invalid).toEqual([]);
  });

  it('sépare aussi sur une tabulation, comme un collage de tableur', () => {
    const result = parseBulkImport('Hola\tBonjour');
    expect(result.cards).toEqual([{ front: 'Hola', back: 'Bonjour' }]);
  });

  it('ignore les lignes vides sans les compter en erreur', () => {
    const result = parseBulkImport('Hola ; Bonjour\n\n\nAdios ; Au revoir');
    expect(result.cards).toHaveLength(2);
    expect(result.invalid).toEqual([]);
  });

  it('signale une ligne sans séparateur', () => {
    const result = parseBulkImport('Hola Bonjour');
    expect(result.cards).toEqual([]);
    expect(result.invalid).toEqual(['Hola Bonjour']);
  });

  it('signale une ligne dont un des deux côtés est vide', () => {
    const result = parseBulkImport('Hola ; \n ; Bonjour');
    expect(result.cards).toEqual([]);
    expect(result.invalid).toHaveLength(2);
  });

  it('accepte un point-virgule dans le verso, seul le premier sépare', () => {
    const result = parseBulkImport('Salut ; Bonjour ; salut informel');
    expect(result.cards).toEqual([{ front: 'Salut', back: 'Bonjour ; salut informel' }]);
  });
});

describe('withoutDuplicates', () => {
  it('écarte une carte dont le recto existe déjà, insensible à la casse et aux espaces', () => {
    const { fresh, duplicates } = withoutDuplicates(
      [{ front: 'Hola', back: 'Bonjour' }, { front: '  hola  ', back: 'Salut' }, { front: 'Adios', back: 'Au revoir' }],
      ['Hola'],
    );
    expect(fresh).toEqual([{ front: 'Adios', back: 'Au revoir' }]);
    expect(duplicates).toHaveLength(2);
  });

  it('sans recoupement, tout est neuf', () => {
    const cards = [{ front: 'Hola', back: 'Bonjour' }];
    expect(withoutDuplicates(cards, []).fresh).toEqual(cards);
  });
});
