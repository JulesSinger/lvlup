import { describe, expect, it } from 'vitest';
import { archiveRunsFixture } from './archiveImport.fixture';
import { planArchiveImport, readableTrack } from './archiveImport';
import { emptyRunForm, formToRun, parseDuration, parseKm, runToForm } from './runForm';
import type { Run } from './types';

describe('saisir une sortie', () => {
  it('lit une distance en kilomètres, virgule ou point', () => {
    expect(parseKm('10,2')).toBe(10_200);
    expect(parseKm('42.195')).toBe(42_195);
    expect(parseKm('0')).toBeNull();
    expect(parseKm('dix')).toBeNull();
  });

  it('lit une durée sous toutes ses formes courantes', () => {
    expect(parseDuration('1:05:09')).toBe(3909);
    expect(parseDuration('47:12')).toBe(2832);
    expect(parseDuration('45')).toBe(2700);
    expect(parseDuration('45 min')).toBe(2700);
    expect(parseDuration('1h05')).toBe(3900);
    expect(parseDuration('1 h 05')).toBe(3900);
    expect(parseDuration('2h')).toBe(7200);
    expect(parseDuration('47:75')).toBeNull();
    expect(parseDuration('vite')).toBeNull();
  });

  it('du formulaire à la sortie, et retour', () => {
    const form = { ...emptyRunForm(new Date(2026, 9, 6, 18, 30)), km: '10,2', duration: '52:30', avgHr: '152', kind: 'seuil' as const };
    const result = formToRun(form);
    if (!('input' in result)) throw new Error(result.error);
    expect(result.input).toMatchObject({ day: '2026-10-06', distanceM: 10_200, durationS: 3150, avgHr: 152, maxHr: null, kind: 'seuil' });
    const back = runToForm({ ...result.input, id: 'r', title: '', note: '', source: 'manuel', sourceRef: null, sessionId: null, splitsS: null, createdAt: '' } as Run);
    expect(back).toMatchObject({ day: '2026-10-06', time: '18:30', km: '10,2', duration: '52:30', avgHr: '152' });
  });

  it('dit ce qui manque', () => {
    expect(formToRun(emptyRunForm())).toEqual({ error: expect.stringMatching(/distance/) });
    expect(formToRun({ ...emptyRunForm(), km: '5' })).toEqual({ error: expect.stringMatching(/durée/) });
    expect(formToRun({ ...emptyRunForm(), km: '5', duration: '25', avgHr: '150,5' })).toEqual({ error: expect.stringMatching(/entier/) });
  });
});

describe('préparer l’import de l’archive', () => {
  it('ne reprend que les nouvelles sorties, complétées de leur tracé', () => {
    let n = 0;
    const tracks = new Map([['activities/2.gpx.gz', { startedAt: '', distanceM: 0, durationS: 0, elevationM: 40, avgHr: 150, maxHr: 170, splitsS: [300, 310] }]]);
    const plan = planArchiveImport(archiveRunsFixture, new Set(['strava:1']), tracks, () => `id${n++}`);
    expect(plan.alreadyKnown).toBe(1);
    expect(plan.runs.map((r) => r.sourceRef)).toEqual(['strava:2', 'strava:3', 'strava:4']);
    // La FC du CSV l'emporte ; le fichier comble ce qui manque.
    expect(plan.runs[0]).toMatchObject({ id: 'id0', splitsS: [300, 310], avgHr: 140, maxHr: 170, elevationM: 40 });
    expect(plan.runs[0]).not.toHaveProperty('file');
    expect(plan.withTrack).toBe(1);
    expect(plan.fitSkipped).toBe(1);
    // La plus longue de sa semaine, 18 km : une sortie longue.
    expect(plan.runs[2].kind).toBe('longue');
    expect(plan).toMatchObject({ otherActivities: 3, unreadable: 1 });
  });

  it('sait quels fichiers lire', () => {
    expect(readableTrack('activities/1.gpx')).toBe(true);
    expect(readableTrack('activities/1.tcx.gz')).toBe(true);
    expect(readableTrack('activities/1.fit.gz')).toBe(false);
  });
});
