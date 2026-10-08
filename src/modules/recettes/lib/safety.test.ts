import { describe, expect, it } from 'vitest';
import { checkUrl, isPrivateIp, toBase64 } from '../../../../supabase/functions/recettes-import/safety.ts';

describe('ce que la fonction d’import accepte d’aller chercher', () => {
  it('une page publique en http(s)', () => {
    expect('url' in checkUrl('https://www.marmiton.org/recettes/x.aspx')).toBe(true);
    expect('url' in checkUrl('  http://blog.example.com/tarte  ')).toBe(true);
  });

  it.each([
    ['ftp://example.com/x', 'http(s)'],
    ['javascript:alert(1)', 'http(s)'],
    ['pas une adresse', 'adresse web'],
    ['https://user:mdp@example.com/', 'identifiant'],
    ['https://example.com:8080/', 'ports'],
    ['http://localhost/x', 'publique'],
    ['http://intranet/x', 'publique'],
    ['http://db.internal/x', 'publique'],
    ['http://127.0.0.1/x', 'publique'],
    ['http://169.254.169.254/latest/meta-data', 'publique'],
    ['http://10.0.0.5/', 'publique'],
    ['http://192.168.1.1/', 'publique'],
    ['http://[::1]/', 'publique'],
  ])('refuse %s', (url, reason) => {
    const r = checkUrl(url);
    expect('error' in r && r.error).toContain(reason);
  });

  it('reconnaît les adresses IP privées, IPv4 et IPv6', () => {
    for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.10', '127.0.0.1', '169.254.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '151.101.1.1', '172.32.0.1', '2606:4700::1111']) expect(isPrivateIp(ip), ip).toBe(false);
  });

  it('encode une photo en base64 par morceaux', () => {
    expect(toBase64(new TextEncoder().encode('Atlas'))).toBe('QXRsYXM=');
    const big = new Uint8Array(100_000).fill(65);
    expect(atob(toBase64(big)).length).toBe(100_000);
  });
});
