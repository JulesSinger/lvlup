import { describe, expect, it } from 'vitest';
import { instantiateTemplate, PROJECT_TEMPLATES, TEMPLATE_IDS, templateById } from './templates';
import { TASK_TITLE_MAX, WORKSTREAM_TITLE_MAX } from './types';

function counter() {
  let n = 0;
  return () => `id-${++n}`;
}

describe('les modèles de projet', () => {
  it('un modèle par identifiant, et chacun se retrouve', () => {
    expect(PROJECT_TEMPLATES.map((t) => t.id)).toEqual([...TEMPLATE_IDS]);
    for (const id of TEMPLATE_IDS) expect(templateById(id)?.id).toBe(id);
    expect(templateById('inconnu')).toBeUndefined();
  });

  it('tous les noms tiennent dans les limites de la base, sans doublon dans un modèle', () => {
    for (const template of PROJECT_TEMPLATES) {
      const titles = template.workstreams.map((w) => w.title);
      expect(new Set(titles).size).toBe(titles.length);
      for (const ws of template.workstreams) {
        expect(ws.title.length).toBeLessThanOrEqual(WORKSTREAM_TITLE_MAX);
        expect(ws.tasks.length).toBeGreaterThan(0);
        for (const task of ws.tasks) expect(task.length).toBeLessThanOrEqual(TASK_TITLE_MAX);
      }
    }
  });

  it('la boutique et la refonte partent de la vitrine, plus leur chantier propre', () => {
    const titles = (id: string) => templateById(id)!.workstreams.map((w) => w.title);
    expect(titles('boutique')).toEqual(expect.arrayContaining([...titles('vitrine'), 'Boutique']));
    expect(titles('refonte')).toEqual(expect.arrayContaining([...titles('vitrine'), 'Reprise de l’existant']));
    expect(titles('vide')).toEqual([]);
  });

  it('la vitrine n’oublie pas ce qui s’oublie : domaine, mentions légales, fiche Google, solde', () => {
    const all = templateById('vitrine')!.workstreams.flatMap((w) => w.tasks).join(' | ');
    for (const needle of ['nom de domaine', 'Mentions légales', 'fiche Google', 'solde', 'HTTPS']) expect(all).toContain(needle);
  });

  it('la copie : des chantiers ordonnés, des tâches rattachées, des ids tous différents', () => {
    const template = templateById('vitrine')!;
    const { workstreams, tasks } = instantiateTemplate(template, 'p-1', counter());
    expect(workstreams.map((w) => w.position)).toEqual(template.workstreams.map((_, i) => i));
    expect(workstreams.every((w) => w.projectId === 'p-1' && w.dueDay === null)).toBe(true);
    expect(tasks).toHaveLength(template.workstreams.reduce((n, w) => n + w.tasks.length, 0));
    const first = tasks.filter((t) => t.workstreamId === workstreams[0].id);
    expect(first.map((t) => t.title)).toEqual(template.workstreams[0].tasks);
    expect(first.map((t) => t.position)).toEqual(first.map((_, i) => i));
    const ids = [...workstreams.map((w) => w.id), ...tasks.map((t) => t.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('le projet vide ne crée rien', () => {
    expect(instantiateTemplate(templateById('vide')!, 'p-1', counter())).toEqual({ workstreams: [], tasks: [] });
  });
});
