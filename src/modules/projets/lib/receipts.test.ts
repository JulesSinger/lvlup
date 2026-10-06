import { describe, expect, it } from 'vitest';
import { receiptsCsv, receiptsOf, receiptYears } from './receipts';
import type { Client, Payment, Project } from './types';

const clients = [{ id: 'c1', name: 'Fleurs de Lou' }, { id: 'c2', name: 'Le Camion; Gourmand' }] as Client[];
const projects = [
  { id: 'p1', clientId: 'c1', title: 'Site vitrine' },
  { id: 'p2', clientId: 'c2', title: 'Site "emplacements"' },
] as Project[];

function payment(id: string, projectId: string, receivedDay: string | null, amountCents: number, over: Partial<Payment> = {}): Payment {
  return { id, projectId, number: 1, label: 'Acompte', amountCents, expectedDay: null, receivedDay, method: receivedDay ? 'virement' : null, invoiceRef: '', position: 0, createdAt: '', ...over };
}

const payments = [
  payment('a', 'p1', '2026-10-02', 27_000, { invoiceRef: 'F-2026-004' }),
  payment('b', 'p2', '2026-03-15', 36_000, { label: 'Solde', method: 'cheque' }),
  payment('c', 'p1', '2025-12-20', 5_000),
  payment('d', 'p1', null, 63_000),
];

describe('le livre des recettes', () => {
  it('les années encaissées, la plus récente d’abord', () => {
    expect(receiptYears(payments)).toEqual(['2026', '2025']);
  });

  it('les encaissements d’une année, dans l’ordre, sans les paiements attendus', () => {
    const rows = receiptsOf('2026', payments, projects, clients);
    expect(rows.map((r) => [r.day, r.client, r.amountCents, r.method])).toEqual([
      ['2026-03-15', 'Le Camion; Gourmand', 36_000, 'Chèque'],
      ['2026-10-02', 'Fleurs de Lou', 27_000, 'Virement'],
    ]);
  });

  it('un CSV pour un tableur français, cellules protégées', () => {
    const csv = receiptsCsv(receiptsOf('2026', payments, projects, clients));
    expect(csv.startsWith('﻿Date;Client;Projet;Objet;Montant (€);Mode de règlement;Facture\r\n')).toBe(true);
    expect(csv).toContain('15/03/2026;"Le Camion; Gourmand";"Site ""emplacements""";Solde;360,00;Chèque;\r\n');
    expect(csv).toContain('02/10/2026;Fleurs de Lou;Site vitrine;Acompte;270,00;Virement;F-2026-004\r\n');
  });
});
