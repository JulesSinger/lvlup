import { describe, expect, it } from 'vitest';
import { storedSessionUser } from './storedSession';

const token = (claims: object) => `x.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.y`;

describe('le compte de la session gardée sur l’appareil', () => {
  it('se lit sans réseau, double authentification comprise', () => {
    const raw = JSON.stringify({ access_token: token({ aal: 'aal1' }), refresh_token: 'r', user: { id: 'jules', email: 'j@x.fr' } });
    expect(storedSessionUser(raw)).toEqual({ id: 'jules', email: 'j@x.fr', isLocal: false, needsSecondFactor: false });
    const mfa = JSON.stringify({ access_token: token({ aal: 'aal1' }), refresh_token: 'r', user: { id: 'jules', factors: [{ status: 'verified' }] } });
    expect(storedSessionUser(mfa)?.needsSecondFactor).toBe(true);
  });

  it('rien, ou une session incomplète, ne donne aucun compte', () => {
    expect(storedSessionUser(null)).toBeNull();
    expect(storedSessionUser('pas du json')).toBeNull();
    expect(storedSessionUser(JSON.stringify({ access_token: 'a', user: { id: 'jules' } }))).toBeNull();
  });
});
