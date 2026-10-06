import { describe, expect, it } from 'vitest';
import { formatDuration, hourlyRateCents, parseDuration, totalMinutes } from './time';
import type { TimeEntry } from './types';

describe('le temps passé', () => {
  it('lit une durée tapée comme on la dit', () => {
    expect(parseDuration('2h30')).toBe(150);
    expect(parseDuration('2 h 30')).toBe(150);
    expect(parseDuration('2h')).toBe(120);
    expect(parseDuration('1,5h')).toBe(90);
    expect(parseDuration('1.5 h')).toBe(90);
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('45 min')).toBe(45);
    expect(parseDuration('0')).toBeNull();
    expect(parseDuration('25h')).toBeNull();
    expect(parseDuration('beaucoup')).toBeNull();
  });

  it('l’écrit lisiblement', () => {
    expect(formatDuration(150)).toBe('2 h 30');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(65)).toBe('1 h 05');
  });

  it('le total d’un projet et le taux horaire réel', () => {
    const entries = [
      { projectId: 'lou', minutes: 600 },
      { projectId: 'lou', minutes: 1200 },
      { projectId: 'autre', minutes: 60 },
    ] as TimeEntry[];
    expect(totalMinutes(entries, 'lou')).toBe(1800);
    expect(hourlyRateCents(90_000, 1800)).toBe(3_000);
    expect(hourlyRateCents(90_000, 0)).toBeNull();
  });
});
