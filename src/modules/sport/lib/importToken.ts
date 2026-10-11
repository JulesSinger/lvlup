/**
 * Le jeton du raccourci iPhone (docs/etude-sport.md §3.3, §15) : un jeton
 * secret du socle (`core/lib/secretToken.ts`), préfixé « spt_ ».
 */
import { hashToken, newSecretToken } from '../../../core/lib/secretToken';

export function newImportToken(random?: (n: number) => Uint8Array): string {
  return newSecretToken('spt_', random);
}

export { hashToken };
