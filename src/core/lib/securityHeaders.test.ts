import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Les en-têtes de sécurité de Cloudflare Pages (`public/_headers`, docs/securite.md §2).
// La politique de contenu n'autorise le script écrit dans index.html (le thème) que par
// son empreinte : changer ce script sans changer l'empreinte casserait le thème en ligne,
// sans qu'aucun test du navigateur ne le voie (`vite preview` ne sert pas `_headers`).

const root = new URL('../../../', import.meta.url);
const headers = readFileSync(new URL('public/_headers', root), 'utf8');
const html = readFileSync(new URL('index.html', root), 'utf8');
const csp = /Content-Security-Policy: (.+)/.exec(headers)?.[1] ?? '';
const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';

describe('en-têtes de sécurité', () => {
  it('autorisent chaque script écrit dans index.html, par son empreinte', () => {
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(inline.length).toBeGreaterThan(0);
    for (const body of inline) {
      const hash = createHash('sha256').update(body).digest('base64');
      expect(directive('script-src')).toContain(`'sha256-${hash}'`);
    }
  });

  it('n’autorisent ni script en ligne quelconque, ni eval, ni intégration dans une autre page', () => {
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
    expect(directive('script-src')).not.toMatch(/'unsafe-eval'/);
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(headers).toMatch(/X-Frame-Options: DENY/);
    expect(headers).toMatch(/Strict-Transport-Security: max-age=\d{8,}/);
    expect(headers).toMatch(/X-Content-Type-Options: nosniff/);
  });

  it('ne laissent partir des données que vers Atlas, Supabase et Open Food Facts', () => {
    const hosts = directive('connect-src').split(/\s+/).slice(1);
    expect(hosts.sort()).toEqual(["'self'", 'https://*.supabase.co', 'https://world.openfoodfacts.org', 'wss://*.supabase.co'].sort());
  });
});
