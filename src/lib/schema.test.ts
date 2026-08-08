import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIRECTIONS, TARGET_MODES, TIER_KINDS } from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose.
 *
 * Ces tests naissent d'un vrai incident. `cumul` avait été scindé en `compte`
 * et `cumul` ; le type a suivi, la migration SQL non. Les deux ont divergé en
 * silence — **rien, côté code, ne connaît le contenu d'un CHECK** — donc
 * `tsc` était vert, les 216 tests passaient, et les vérifications de bout en
 * bout aussi puisqu'elles tournent en mode local, sans base.
 *
 * Le bug n'existait qu'en production, et seulement pour une partie des
 * objectifs : ceux comportant un palier en jours. Créer « Arrêter de me
 * ronger les ongles » renvoyait
 *     new row for relation "tiers" violates check constraint "tiers_kind_check"
 * pendant qu'un objectif fait de jalons passait sans rien dire.
 *
 * C'est le trou de couverture le plus coûteux du projet : la frontière entre
 * le code et la base n'était vérifiée par personne. Ces tests la tiennent, à
 * la lettre près, sans avoir besoin d'une base.
 */

const SQL_DIR = new URL('../../supabase', import.meta.url).pathname;

/** Contenu de tous les fichiers SQL, dans l'ordre où on les exécute. */
function sqlFiles(): { name: string; body: string }[] {
  return readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort() // schema.sql puis migration-2, -3… l'ordre alphabétique suffit
    .map((name) => ({ name, body: readFileSync(join(SQL_DIR, name), 'utf8') }));
}

/**
 * Valeurs autorisées par la DERNIÈRE définition d'une contrainte donnée.
 *
 * La dernière fait foi : une migration ultérieure fait `drop constraint` puis
 * `add constraint`, et c'est elle qui décrit l'état réel de la base.
 */
function allowedBy(constraint: string): string[] | null {
  const pattern = new RegExp(
    `add\\s+constraint\\s+${constraint}\\s+check\\s*\\([^)]*in\\s*\\(([^)]*)\\)`,
    'gis',
  );
  let last: string | null = null;
  for (const { body } of sqlFiles()) {
    for (const match of body.matchAll(pattern)) last = match[1];
  }
  if (last === null) return null;
  return [...last.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

describe('le type et la base disent la même chose', () => {
  it('les six natures de palier sont acceptées par Postgres', () => {
    // Le test qui aurait attrapé l'incident : « compte » manquait ici.
    expect(allowedBy('tiers_kind_check')).toEqual([...TIER_KINDS].sort());
  });

  it('les deux sens de progression aussi', () => {
    expect(allowedBy('tiers_direction_check')).toEqual([...DIRECTIONS].sort());
  });

  it('les deux modes de cible aussi', () => {
    expect(allowedBy('tiers_mode_check')).toEqual([...TARGET_MODES].sort());
  });
});

describe('hygiène des migrations', () => {
  it('toute contrainte CHECK est retirée avant d’être reposée', () => {
    // `add constraint … check` sans `drop constraint if exists` juste avant
    // échoue au rejeu — or une migration doit pouvoir être relancée sans
    // casse, et c'est justement ce qu'on fait pour élargir une liste de
    // valeurs. Les contraintes d'unicité n'entrent pas dans ce cas : elles se
    // posent une fois avec `if not exists` sur l'index.
    for (const { name, body } of sqlFiles()) {
      for (const match of body.matchAll(/alter\s+table[^;]*?add\s+constraint\s+(\w+)\s+check/gis)) {
        const constraint = match[1];
        expect(
          new RegExp(`drop\\s+constraint\\s+if\\s+exists\\s+${constraint}`, 'is').test(body),
          `${name} : ${constraint} reposée sans être retirée d'abord`,
        ).toBe(true);
      }
    }
  });

  it('aucun fichier SQL ne contient de clé de service', () => {
    // Le SQL du cron porte des secrets ; ils vivent dans Supabase, pas ici.
    for (const { name, body } of sqlFiles()) {
      expect(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(body), name).toBe(false);
      expect(/\bsb_secret_[A-Za-z0-9]/.test(body), name).toBe(false);
    }
  });
});
