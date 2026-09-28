import { describe, expect, it } from 'vitest';
import { payloadFor, splitDue, type ModuleReminderRow } from '../../../supabase/functions/send-reminders/moduleReminders.ts';

const row = (ref: string, fire_at: string): ModuleReminderRow => ({ id: ref, user_id: 'u', module: 'taches', ref, title: 'Garage', body: '9 h', url: '/', fire_at });

describe('les rappels des modules — la règle d’envoi', () => {
  const now = new Date('2026-09-28T09:05:00Z');

  it('envoie ce dont l’heure est venue, abandonne ce qui a plus d’une heure de retard, garde l’avenir', () => {
    const { send, expire } = splitDue(
      [row('juste', '2026-09-28T09:00:00Z'), row('limite', '2026-09-28T08:05:00Z'), row('trop-tard', '2026-09-28T08:04:59Z'), row('plus-tard', '2026-09-28T09:10:00Z')],
      now,
    );
    expect(send.map((r) => r.ref)).toEqual(['juste', 'limite']);
    expect(expire.map((r) => r.ref)).toEqual(['trop-tard']);
  });

  it('la notification porte le titre, le texte, et une étiquette par module et référence', () => {
    expect(payloadFor(row('task:1', '2026-09-28T09:00:00Z'))).toEqual({ title: 'Garage', body: '9 h', tag: 'taches-task:1', url: '/' });
  });
});
