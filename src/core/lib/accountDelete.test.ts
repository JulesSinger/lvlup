import { describe, expect, it } from 'vitest';
import { BUCKETS, deletionRefusal, isAccountFolder, jwtClaims } from '../../../supabase/functions/account-delete/rules.ts';
import { DELETE_PHRASE, jwtClaims as clientClaims, needsSecondFactor, readTotpCode } from './mfa';

// Supprimer son compte et la double authentification (docs/securite.md §7-§8).

const b64url = (o: unknown) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = (claims: Record<string, unknown>) => `${b64url({ alg: 'HS256' })}.${b64url(claims)}.signature`;
const now = 1_800_000_000;

describe('supprimer son compte : la fonction', () => {
  it('efface les fichiers des trois espaces de stockage', () => {
    expect([...BUCKETS]).toEqual(['hautsfaits', 'projets', 'recettes']);
  });

  it('exige un mot de passe redonné il y a moins de dix minutes', () => {
    expect(deletionRefusal({ amr: [{ method: 'password', timestamp: now - 60 }] }, false, now)).toBeNull();
    expect(deletionRefusal({ amr: [{ method: 'password', timestamp: now - 3600 }], iat: now }, false, now)).toMatch(/dix minutes/);
    expect(deletionRefusal({}, false, now)).toMatch(/mot de passe/);
  });

  it('exige le code pour un compte à double authentification', () => {
    const fresh = [{ method: 'password', timestamp: now - 30 }];
    expect(deletionRefusal({ amr: fresh, aal: 'aal1' }, true, now)).toMatch(/code/);
    expect(deletionRefusal({ amr: [...fresh, { method: 'totp', timestamp: now - 10 }], aal: 'aal2' }, true, now)).toBeNull();
  });

  it('ne descend que dans un dossier qui est un identifiant de compte', () => {
    expect(isAccountFolder('5b0f5c2e-1d2a-4c3b-9e8f-0a1b2c3d4e5f')).toBe(true);
    expect(isAccountFolder('..')).toBe(false);
    expect(isAccountFolder('5b0f5c2e-1d2a-4c3b-9e8f-0a1b2c3d4e5f/../x')).toBe(false);
  });

  it('lit un jeton comme l’app', () => {
    const t = token({ sub: 'x', aal: 'aal2', email: 'léa@exemple.fr' });
    expect(jwtClaims(t).aal).toBe('aal2');
    expect(clientClaims(t)).toMatchObject({ aal: 'aal2', email: 'léa@exemple.fr' });
    expect(jwtClaims('n’importe quoi')).toEqual({});
  });
});

describe('la double authentification dans l’app', () => {
  const session = (aal: string, factors: { status: string }[]) => ({ access_token: token({ aal }), user: { factors } });

  it('demande le code seulement à un compte qui l’a activée, tant qu’il ne l’a pas donné', () => {
    expect(needsSecondFactor(session('aal1', []))).toBe(false);
    expect(needsSecondFactor(session('aal1', [{ status: 'unverified' }]))).toBe(false);
    expect(needsSecondFactor(session('aal1', [{ status: 'verified' }]))).toBe(true);
    expect(needsSecondFactor(session('aal2', [{ status: 'verified' }]))).toBe(false);
  });

  it('lit un code à six chiffres, espaces tolérés', () => {
    expect(readTotpCode('123 456')).toBe('123456');
    expect(readTotpCode('12345')).toBeNull();
    expect(readTotpCode('12a456')).toBeNull();
    expect(DELETE_PHRASE).toBe('SUPPRIMER');
  });
});
