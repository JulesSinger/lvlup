/**
 * Le livre des recettes (docs/etude-projets.md §3.8) — bibliothèque pure.
 *
 * Un micro-entrepreneur tient le registre chronologique de ses encaissements :
 * date, client, montant, mode de règlement, référence de la facture. Cette
 * vue le déduit des paiements reçus. Une aide, pas une comptabilité
 * certifiée : l'outil de facturation en tient sans doute un aussi.
 */
import { PAYMENT_METHOD_LABELS } from './payments';
import type { Client, Payment, Project } from './types';

export interface ReceiptRow {
  day: string;
  client: string;
  project: string;
  label: string;
  amountCents: number;
  method: string;
  invoiceRef: string;
}

/** Les années qui ont au moins un encaissement, la plus récente d'abord. */
export function receiptYears(payments: readonly Payment[]): string[] {
  return [...new Set(payments.filter((p) => p.receivedDay).map((p) => p.receivedDay!.slice(0, 4)))].sort().reverse();
}

/** Les encaissements d'une année, dans l'ordre chronologique. */
export function receiptsOf(year: string, payments: readonly Payment[], projects: readonly Project[], clients: readonly Client[]): ReceiptRow[] {
  const project = new Map(projects.map((p) => [p.id, p]));
  const client = new Map(clients.map((c) => [c.id, c]));
  return payments
    .filter((p) => p.receivedDay?.startsWith(year))
    .map((p) => {
      const pr = project.get(p.projectId);
      return {
        day: p.receivedDay!,
        client: (pr && client.get(pr.clientId)?.name) ?? 'Client inconnu',
        project: pr?.title ?? '',
        label: p.label,
        amountCents: p.amountCents,
        method: p.method ? PAYMENT_METHOD_LABELS[p.method] : '',
        invoiceRef: p.invoiceRef,
      };
    })
    .sort((a, b) => a.day.localeCompare(b.day) || a.client.localeCompare(b.client, 'fr'));
}

/** Une cellule CSV : entre guillemets si elle contient le séparateur, un guillemet ou un saut de ligne. */
function cell(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Le livre en CSV, lisible par un tableur français : point-virgule, virgule
 * décimale, dates JJ/MM/AAAA, et l'en-tête UTF-8 (BOM) sans lequel Excel
 * massacre les accents.
 */
export function receiptsCsv(rows: readonly ReceiptRow[]): string {
  const header = ['Date', 'Client', 'Projet', 'Objet', 'Montant (€)', 'Mode de règlement', 'Facture'];
  const lines = rows.map((r) => {
    const [y, m, d] = r.day.split('-');
    const amount = (r.amountCents / 100).toFixed(2).replace('.', ',');
    return [`${d}/${m}/${y}`, r.client, r.project, r.label, amount, r.method, r.invoiceRef].map(cell).join(';');
  });
  return `﻿${[header.join(';'), ...lines].join('\r\n')}\r\n`;
}
