/**
 * Lecteur CSV minimal, générique — pas de dépendance externe pour un
 * format aussi contraint (docs/astra-import-boursobank.md §1). Comprend
 * les guillemets RFC4180 (`""` = un guillemet littéral dans un champ) et
 * retire le BOM UTF-8 en tête de fichier, sans quoi le nom de la première
 * colonne devient `﻿dateOp` et la lecture de l'en-tête échoue en silence.
 */

/** Découpe un texte CSV en lignes de champs bruts. */
export function parseCsvRows(text: string, delimiter = ';'): string[][] {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < body.length) {
    const c = body[i];
    if (inQuotes) {
      if (c === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      // Toléré même si le format documenté est en LF seul.
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Une ligne vide en toute fin de fichier (retour à la ligne final) ne
  // doit pas devenir un enregistrement fantôme.
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Découpe un CSV avec en-tête en objets `{ colonne: valeur }`. */
export function parseCsvRecords(text: string, delimiter = ';'): Record<string, string>[] {
  const rows = parseCsvRows(text, delimiter);
  if (rows.length === 0) return [];
  const [header, ...rest] = rows;
  return rest.map((r) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = r[index] ?? '';
    });
    return record;
  });
}
