import { describe, expect, it } from 'vitest';
import { convertCiqual, energyFromNutrients, parseCiqualValue } from './ciqualImport';

/** Des extraits au format exact des fichiers de l'ANSES (espaces compris). */
function alim(code: string, name: string) {
  return `<ALIM>
      <alim_code> ${code} </alim_code>
      <alim_nom_fr> ${name} </alim_nom_fr>
      <alim_nom_eng> x </alim_nom_eng>
   </ALIM>`;
}

function compo(code: string, constituent: string, teneur: string | null) {
  const value = teneur === null ? '<teneur missing=" " />' : `<teneur> ${teneur} </teneur>`;
  return `<COMPO>
      <alim_code> ${code} </alim_code>
      <const_code> ${constituent} </const_code>
      ${value}
      <min missing=" " />
   </COMPO>`;
}

function food(code: string, v: Record<string, string | null>) {
  return Object.entries(v)
    .map(([constituent, teneur]) => compo(code, constituent, teneur))
    .join('\n');
}

describe('parseCiqualValue', () => {
  it('lit la virgule décimale française', () => {
    expect(parseCiqualValue(' 59,7 ')).toBe(59.7);
    expect(parseCiqualValue('274')).toBe(274);
  });

  it('« traces » et « < seuil » comptent pour zéro', () => {
    expect(parseCiqualValue('traces')).toBe(0);
    expect(parseCiqualValue('&lt; 0,5')).toBe(0);
  });

  it('une valeur non mesurée est inconnue, jamais zéro', () => {
    expect(parseCiqualValue('-')).toBeNull();
    expect(parseCiqualValue(undefined)).toBeNull();
  });
});

describe('energyFromNutrients', () => {
  it('suit les coefficients du règlement UE 1169/2011, alcool et fibres compris', () => {
    expect(energyFromNutrients({ protein: 10, carbs: 10, fat: 10, fiber: 5, alcohol: 10 })).toBe(
      40 + 40 + 90 + 70 + 10,
    );
  });
});

describe('convertCiqual', () => {
  const alimXml = [
    alim('13000', 'Pomme, crue'),
    alim('1000', 'Pastis'),
    alim('9107', 'Riz blanc, précuit, cuit'),
    alim('18000', 'Jus d&apos;orange, frais'),
  ].join('\n');
  const compoXml = [
    food('13000', { 328: '53', 25000: '0,25', 31000: '11,3', 40000: 'traces', 34100: '1,4' }),
    // kcal non renseignées : recalculées, alcool compris
    food('1000', { 328: '-', 25000: '0', 31000: '&lt; 0,5', 40000: '0', 34100: '-', 60000: '40' }),
    // protéines inconnues : l'aliment est écarté
    food('9107', { 328: '-', 25000: '-', 31000: '28,1', 40000: '1,3', 34100: '1' }),
    food('18000', { 328: '44', 25000: '0,7', 31000: '9', 40000: '0,1', 34100: null }),
  ].join('\n');
  const result = convertCiqual(alimXml, compoXml);

  it('convertit en entiers : kcal, puis macros et fibres en décigrammes', () => {
    expect(result.rows).toContainEqual(['13000', 'Pomme, crue', 53, 3, 113, 0, 14]);
  });

  it('recalcule les kcal manquantes, en comptant l’alcool', () => {
    expect(result.rows).toContainEqual(['1000', 'Pastis', 280, 0, 0, 0, null]);
    expect(result.energyComputed).toBe(1);
  });

  it('écarte un aliment dont une macro est inconnue plutôt que de la compter à zéro', () => {
    expect(result.rows.map((r) => r[0])).not.toContain('9107');
    expect(result.skipped).toEqual([{ code: '9107', name: 'Riz blanc, précuit, cuit' }]);
  });

  it('décode les entités XML des noms, fibres inconnues à null', () => {
    expect(result.rows).toContainEqual(['18000', 'Jus d’orange, frais', 44, 7, 90, 1, null]);
  });

  it('trie par nom, dans l’ordre alphabétique français', () => {
    expect(result.rows.map((r) => r[1])).toEqual(['Jus d’orange, frais', 'Pastis', 'Pomme, crue']);
  });
});
