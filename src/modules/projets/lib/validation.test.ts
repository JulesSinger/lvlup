import { describe, expect, it } from 'vitest';
import { validateClient, validateNote, validateProject, validateTask, validateWaiting, validateWorkstreamTitle } from './validation';

describe('validation', () => {
  it('un client a un nom, un métier connu, et une adresse e-mail plausible', () => {
    expect(validateClient({ name: 'Fleurs de Lou', trade: 'fleuriste' })).toBeNull();
    expect(validateClient({ name: '  ', trade: 'fleuriste' })).toMatch(/nom/);
    expect(validateClient({ name: 'X', trade: 'plombier' as never })).toMatch(/Métier/);
    expect(validateClient({ name: 'X', trade: 'autre', email: 'lou.fleurs' })).toMatch(/e-mail/);
    expect(validateClient({ name: 'X', trade: 'autre', email: 'lou@fleurs.fr' })).toBeNull();
  });

  it('un projet a un titre, un client, une échéance après son début, un prix positif', () => {
    const ok = { clientId: 'c', title: 'Site vitrine' };
    expect(validateProject(ok)).toBeNull();
    expect(validateProject({ ...ok, title: '' })).toMatch(/titre/);
    expect(validateProject({ ...ok, clientId: '' })).toMatch(/client/);
    expect(validateProject({ ...ok, startDay: '2026-10-10', dueDay: '2026-10-01' })).toMatch(/avant le début/);
    expect(validateProject({ ...ok, priceCents: -100 })).toMatch(/prix/);
    expect(validateProject({ ...ok, priceCents: 12.5 })).toMatch(/prix/);
    expect(validateProject({ ...ok, priceCents: null })).toBeNull();
  });

  it('l’attente, le chantier, la tâche, la note', () => {
    expect(validateWaiting(null)).toBeNull();
    expect(validateWaiting(' ')).toMatch(/attends/);
    expect(validateWorkstreamTitle('')).toMatch(/nom/);
    expect(validateWorkstreamTitle('x'.repeat(81))).toMatch(/80/);
    expect(validateTask({ projectId: 'p', workstreamId: 'w', title: 'Logo' })).toBeNull();
    expect(validateTask({ projectId: 'p', workstreamId: 'w', title: 'Logo', dueDay: '5 octobre' })).toMatch(/Échéance/);
    expect(validateNote('')).toMatch(/vide/);
  });
});
