import { useState } from 'react';
import { dayString } from '../../../core/lib/day';
import { shortDate } from '../lib/format';
import { formatEuros } from '../lib/money';
import { receiptsCsv, receiptsOf, receiptYears } from '../lib/receipts';
import type { Client, Payment, Project } from '../lib/types';

interface Props {
  payments: readonly Payment[];
  projects: readonly Project[];
  clients: readonly Client[];
  today: string;
}

/**
 * Le livre des recettes (§3.8) : les encaissements d'une année, dans
 * l'ordre, exportables en CSV. Une aide pour la déclaration, pas une
 * comptabilité certifiée.
 */
export function ReceiptsView({ payments, projects, clients, today }: Props) {
  const years = receiptYears(payments);
  const current = today.slice(0, 4);
  const choices = years.includes(current) ? years : [current, ...years];
  const [year, setYear] = useState(choices[0]);
  const rows = receiptsOf(year, payments, projects, clients);
  const total = rows.reduce((sum, r) => sum + r.amountCents, 0);

  function exportCsv() {
    const blob = new Blob([receiptsCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `livre-des-recettes-${year}-${dayString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="projets-receipts">
      <div className="projets-receipts-head">
        <div className="projets-nav" role="group" aria-label="Année">
          {choices.map((y) => (
            <button key={y} type="button" className={`projets-nav-item${y === year ? ' on' : ''}`} aria-pressed={y === year} onClick={() => setYear(y)}>
              {y}
            </button>
          ))}
        </div>
        <span className="projets-spacer" />
        <button className="btn btn-sm" disabled={rows.length === 0} onClick={exportCsv}>
          Exporter en CSV
        </button>
      </div>
      <p className="projets-receipts-total">
        Encaissé en {year} : <b>{formatEuros(total)}</b>
        <span>
          {' '}
          · {rows.length} encaissement{rows.length > 1 ? 's' : ''}
        </span>
      </p>
      {rows.length === 0 ? (
        <p className="projets-hint">Aucun paiement reçu en {year}. Un paiement noté « reçu » dans l’onglet Argent d’un projet arrive ici.</p>
      ) : (
        <div className="projets-table-wrap">
          <table className="projets-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Objet</th>
                <th className="num">Montant</th>
                <th>Mode</th>
                <th>Facture</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{shortDate(r.day, `${year}-01-01`)}</td>
                  <td>{r.client}</td>
                  <td>
                    {r.label}
                    {r.project && <span className="projets-table-sub"> · {r.project}</span>}
                  </td>
                  <td className="num">{formatEuros(r.amountCents)}</td>
                  <td>{r.method}</td>
                  <td>{r.invoiceRef}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="projets-hint">Une aide pour tenir ton livre des recettes et déclarer ton chiffre d’affaires, pas une comptabilité certifiée.</p>
    </div>
  );
}
