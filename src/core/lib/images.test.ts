import { describe, expect, it } from 'vitest';
import { fitWithin, formatBytes } from './images';

describe('tailles', () => {
  it('une image tient dans son cadre sans être agrandie', () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 720)).toEqual({ width: 540, height: 720 });
    expect(fitWithin(600, 400, 2048)).toEqual({ width: 600, height: 400 });
  });

  it('un poids se dit en Ko, Mo ou Go', () => {
    expect(formatBytes(340_000)).toBe('340 Ko');
    expect(formatBytes(12_400_000)).toBe('12,4 Mo');
    expect(formatBytes(1_200_000_000)).toBe('1,2 Go');
  });
});
