import { describe, expect, it } from 'vitest';
import { isTierColor, validateItem, validateList, validateTier } from './validation';

describe('les règles de saisie', () => {
  it('une liste a un titre', () => {
    expect(validateList({ title: '  ' })).toContain('titre');
    expect(validateList({ title: 'x'.repeat(81) })).toContain('80');
    expect(validateList({ title: 'Champions LoL' })).toBeNull();
    expect(validateList({ description: 'x'.repeat(501) })).toContain('500');
    expect(validateList({})).toBeNull();
  });

  it('une rangée a un nom court et une couleur de la palette', () => {
    expect(validateTier({ label: '' })).toContain('nom');
    expect(validateTier({ label: 'Incroyable !!' })).toContain('12');
    expect(validateTier({ label: 'S', color: 'red' })).toBeNull();
    expect(validateTier({ color: '#ff0000' })).toContain('couleur');
    expect(isTierColor('teal')).toBe(true);
    expect(isTierColor('noir')).toBe(false);
  });

  it('un élément est un texte, une image, ou les deux', () => {
    expect(validateItem({ label: ' ' }, false)).toContain('image');
    expect(validateItem({ label: '' }, true)).toBeNull();
    expect(validateItem({ label: 'Ahri' }, false)).toBeNull();
    expect(validateItem({ label: 'x'.repeat(121) }, false)).toContain('120');
  });
});
