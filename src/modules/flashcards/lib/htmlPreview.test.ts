import { describe, expect, it } from 'vitest';
import { htmlToPlainText, truncatePreview } from './htmlPreview';

describe('htmlToPlainText', () => {
  it('retire les balises simples', () => {
    expect(htmlToPlainText('<p>Bonjour</p>')).toBe('Bonjour');
  });

  it('retire la mise en forme sans perdre le texte', () => {
    expect(htmlToPlainText('<p><strong>Gras</strong> et <mark>surligné</mark></p>')).toBe(
      'Gras et surligné',
    );
  });

  it('remplace les coupures de bloc par une espace, pas rien', () => {
    expect(htmlToPlainText('<p>Un</p><p>Deux</p>')).toBe('Un Deux');
  });

  it('déplie une liste en une seule ligne', () => {
    expect(htmlToPlainText('<ul><li>sel</li><li>poivre</li></ul>')).toBe('sel poivre');
  });

  it('décode les entités HTML courantes', () => {
    expect(htmlToPlainText('<p>Tom &amp; Jerry &lt;3&gt;</p>')).toBe('Tom & Jerry <3>');
  });

  it('un texte simple sans balise ressort tel quel', () => {
    expect(htmlToPlainText('Hola')).toBe('Hola');
  });
});

describe('truncatePreview', () => {
  it('ne touche pas un texte déjà assez court', () => {
    expect(truncatePreview('Hola', 70)).toBe('Hola');
  });

  it('coupe sur la dernière frontière de mot', () => {
    expect(truncatePreview('Le rapide renard brun saute par-dessus le chien paresseux', 20)).toBe(
      'Le rapide renard…',
    );
  });

  it('coupe en plein mot si la frontière est trop loin du bord', () => {
    expect(truncatePreview('Anticonstitutionnellement', 10)).toBe('Anticonsti…');
  });

  it('exactement à la limite ne tronque pas', () => {
    expect(truncatePreview('12345', 5)).toBe('12345');
  });
});
