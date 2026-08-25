import { describe, expect, it } from 'vitest';
import { centsToInputValue, formatCents, parsePositiveAmountToCents, parseSignedAmountToCents } from './amount';

describe('parsePositiveAmountToCents', () => {
  it('lit un entier', () => {
    expect(parsePositiveAmountToCents('45')).toBe(4500);
  });

  it('lit une virgule décimale', () => {
    expect(parsePositiveAmountToCents('45,90')).toBe(4590);
  });

  it('lit un point décimal', () => {
    expect(parsePositiveAmountToCents('45.90')).toBe(4590);
  });

  it('complète une seule décimale', () => {
    expect(parsePositiveAmountToCents('45,9')).toBe(4590);
  });

  it('accepte un montant sans partie décimale après le séparateur', () => {
    expect(parsePositiveAmountToCents('45,')).toBe(4500);
  });

  it('accepte les espaces autour', () => {
    expect(parsePositiveAmountToCents('  12,50  ')).toBe(1250);
  });

  it('refuse un texte qui ne ressemble pas à un montant', () => {
    expect(parsePositiveAmountToCents('abc')).toBeNull();
    expect(parsePositiveAmountToCents('')).toBeNull();
    expect(parsePositiveAmountToCents('-45')).toBeNull();
  });

  it('refuse trois décimales plutôt que d’en perdre une en silence', () => {
    expect(parsePositiveAmountToCents('45,999')).toBeNull();
  });

  it('ne produit jamais un nombre à virgule flottante approché', () => {
    // 0,1 + 0,2 est le contre-exemple canonique de l'erreur à éviter.
    const a = parsePositiveAmountToCents('0,10');
    const b = parsePositiveAmountToCents('0,20');
    expect(a! + b!).toBe(30);
  });
});

describe('centsToInputValue / formatCents', () => {
  it('formate des centimes en euros pour un champ de saisie', () => {
    expect(centsToInputValue(4500)).toBe('45,00');
    expect(centsToInputValue(90)).toBe('0,90');
  });

  it('signe l’affichage', () => {
    expect(formatCents(-4500)).toBe('-45,00 €');
    expect(formatCents(4500)).toBe('+45,00 €');
    expect(formatCents(0)).toBe('+0,00 €');
  });

  it('l’aller-retour saisie → centimes → affichage est fidèle au centime près', () => {
    const cents = parsePositiveAmountToCents('12,34')!;
    expect(centsToInputValue(cents)).toBe('12,34');
  });
});

describe('parseSignedAmountToCents', () => {
  it('lit un montant négatif simple', () => {
    expect(parseSignedAmountToCents('-620,00')).toBe(-62000);
  });

  it('lit un montant positif', () => {
    expect(parseSignedAmountToCents('150,00')).toBe(15000);
  });

  it('retire l’espace de milliers (docs/astra-import-boursobank.md §1)', () => {
    expect(parseSignedAmountToCents('-1 500,00')).toBe(-150000);
    expect(parseSignedAmountToCents('2 100,00')).toBe(210000);
  });

  it('lit un montant sans milliers ni signe explicite comme positif', () => {
    expect(parseSignedAmountToCents('12,40')).toBe(1240);
  });

  it('complète une seule décimale', () => {
    expect(parseSignedAmountToCents('-62,1')).toBe(-6210);
  });

  it('refuse un texte qui ne ressemble pas à un montant', () => {
    expect(parseSignedAmountToCents('abc')).toBeNull();
    expect(parseSignedAmountToCents('')).toBeNull();
    expect(parseSignedAmountToCents('683.65')).toBeNull(); // point décimal : format du solde, pas du montant
  });

  it('ne produit jamais un nombre à virgule flottante approché', () => {
    const a = parseSignedAmountToCents('-0,10');
    const b = parseSignedAmountToCents('0,20');
    expect(a! + b!).toBe(10);
  });
});
