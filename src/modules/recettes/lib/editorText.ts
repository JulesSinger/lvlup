/**
 * Les ingrédients et les étapes, écrits comme du texte dans la fenêtre d'une
 * recette — bibliothèque pure (docs/etude-recettes.md §15).
 *
 * Une ligne par ingrédient ; une ligne qui finit par « : » ouvre un groupe
 * (« Pour la béchamel : »). Une ligne par étape ; les numéros tapés
 * (« 1. », « 2) ») sont retirés, Atlas numérote lui-même.
 */
import { isSectionHeading } from './ingredients';
import type { Ingredient, Step } from './types';

export function ingredientsToText(ingredients: Ingredient[]): string {
  const lines: string[] = [];
  let section: string | null = null;
  for (const i of ingredients) {
    if (i.section !== section) {
      if (i.section) lines.push(`${i.section} :`);
      section = i.section;
    }
    lines.push(i.text);
  }
  return lines.join('\n');
}

export function textToIngredients(text: string): Ingredient[] {
  const out: Ingredient[] = [];
  let section: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*[-•*·–]\s*/, '').trim();
    if (!line) continue;
    if (/:\s*$/.test(line) || (isSectionHeading(line) && !/\d/.test(line))) {
      section = line.replace(/\s*:\s*$/, '') || null;
      continue;
    }
    out.push({ text: line.slice(0, 300), section });
  }
  return out;
}

export function stepsToText(steps: Step[]): string {
  return steps.map((s) => s.text).join('\n');
}

export function textToSteps(text: string): Step[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^(?:étape\s*)?\d+\s*[.)\-–:]\s+/i, ''))
    .filter(Boolean)
    .map((t) => ({ text: t.slice(0, 2000) }));
}

/** « batch cooking, rapide, Végétarien » → ['batch cooking', 'rapide', 'végétarien'], sans doublon. */
export function textToTags(text: string): string[] {
  return [...new Set(text.split(',').map((t) => t.trim().toLowerCase()).filter((t) => t && t.length <= 40))].slice(0, 20);
}

/** « 25 » → 25 ; « 1 h 30 », « 1h30 » → 90 ; « 45 min » → 45 ; vide → null ; illisible → undefined. */
export function readMinutesField(text: string): number | null | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  let m = /^(\d+)\s*h\s*(\d{1,2})?\s*(?:min)?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d+)\s*(?:min|mn|minutes?)?$/.exec(t);
  if (m) return Number(m[1]);
  return undefined;
}
