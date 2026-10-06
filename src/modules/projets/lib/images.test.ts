import { describe, expect, it } from 'vitest';
import { imageRoom, imagesOf, logoOf, nextImagePosition } from './images';
import type { ProjectImage } from './types';

const image = (id: string, kind: ProjectImage['kind'], position: number, projectId = 'lou'): ProjectImage => ({
  id,
  projectId,
  kind,
  path: `${id}.jpg`,
  thumbPath: `${id}-t.jpg`,
  width: 10,
  height: 10,
  bytes: 1,
  position,
  createdAt: '2026-10-06T10:00:00Z',
});

describe('les images d’un projet', () => {
  const list = [image('m', 'maquette', 0), image('p2', 'photo', 3), image('l', 'logo', 5), image('p1', 'photo', 1), image('autre', 'logo', 0, 'x')];

  it('rangées par sorte, logos d’abord, chacune dans son ordre', () => {
    expect(imagesOf(list, 'lou').map((i) => i.id)).toEqual(['l', 'p1', 'p2', 'm']);
  });

  it('le logo est la première image de sorte « logo » ; sans elle, rien', () => {
    expect(logoOf(list, 'lou')?.id).toBe('l');
    expect(logoOf([image('p', 'photo', 0)], 'lou')).toBeNull();
  });

  it('vingt images au plus : une sélection trop grande garde les premières', () => {
    const nineteen = Array.from({ length: 19 }, (_, i) => image(`i${i}`, 'photo', i));
    expect(imageRoom(nineteen, 'lou', 3)).toEqual({ accepted: 1, refused: 2 });
    expect(imageRoom([], 'lou', 3)).toEqual({ accepted: 3, refused: 0 });
    expect(nextImagePosition(list, 'lou')).toBe(6);
    expect(nextImagePosition([], 'lou')).toBe(0);
  });
});
