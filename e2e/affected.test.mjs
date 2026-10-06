import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { affectedSuites, serviceGraph } from './affected.mjs';

const graph = {
  modules: ['budget', 'calendrier', 'courses', 'objectifs', 'projets', 'taches'],
  consumers: { budget: ['calendrier', 'courses', 'projets'], taches: ['calendrier'], courses: ['calendrier'], calendrier: [] },
};

describe('affectedSuites', () => {
  it('un module modifié : sa suite, celles qui utilisent ses services, et le socle', () => {
    expect(affectedSuites(['src/modules/taches/components/InlineAdd.tsx'], graph)).toMatchObject({
      all: false,
      suites: ['socle', 'calendrier', 'taches'],
    });
    expect(affectedSuites(['src/modules/objectifs/ZenithScreen.tsx'], graph).suites).toEqual(['socle', 'objectifs']);
  });

  it('le socle, le lanceur, les dépendances ou la configuration : tout', () => {
    for (const file of ['src/core/lib/services.ts', 'src/App.tsx', 'src/modules/index.ts', 'e2e/run.mjs', 'package.json', 'index.html', 'public/sw.js', 'vite.config.ts']) {
      expect(affectedSuites([file], graph)).toMatchObject({ all: true, suites: ['socle', ...graph.modules] });
    }
  });

  it('documentation, migrations, tests unitaires : aucune suite', () => {
    expect(affectedSuites(['docs/etude.md', 'CLAUDE.md', 'supabase/2026-10-06-x.sql', 'src/modules/taches/lib/views.test.ts', 'src/core/lib/day.test.ts'], graph)).toMatchObject({
      all: false,
      suites: [],
    });
  });

  it('une suite e2e modifiée se relance elle-même', () => {
    expect(affectedSuites(['src/modules/courses/e2e/suite.mjs'], graph).suites).toEqual(['socle', 'calendrier', 'courses']);
  });
});

describe('serviceGraph', () => {
  it('lit qui rend un service dans `provides`, et qui s’en sert', () => {
    const code = {
      budget: { moduleTs: 'provides: { expenses: x, calendarSources: [y] },\n', sources: '' },
      courses: { moduleTs: 'provides: { calendarSources: [z] },\n', sources: 'services.expenses?.record()' },
      calendrier: { moduleTs: '', sources: 'services.calendarSources ?? []' },
      nutrition: { moduleTs: '', sources: '' },
    };
    expect(serviceGraph(code, ['expenses', 'calendarSources']).consumers).toEqual({
      budget: ['calendrier', 'courses'],
      calendrier: [],
      courses: ['calendrier'],
      nutrition: [],
    });
  });

  it('sur le vrai code : Tâches relance Calendar, Budget relance Courses et Projets', () => {
    const root = new URL('../src/modules/', import.meta.url).pathname;
    const read = (dir) =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === 'e2e' ? [] : read(path);
        return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [readFileSync(path, 'utf8')] : [];
      });
    const code = {};
    for (const m of readdirSync(root).filter((n) => statSync(join(root, n)).isDirectory())) {
      code[m] = { moduleTs: readFileSync(join(root, m, 'module.ts'), 'utf8'), sources: read(join(root, m)).join('\n') };
    }
    const { consumers } = serviceGraph(code, ['expenses', 'calendarSources']);
    expect(consumers.taches).toEqual(['calendrier']);
    expect(consumers.budget).toEqual(['calendrier', 'courses', 'projets']);
    expect(consumers.nutrition).toEqual([]);
  });
});
