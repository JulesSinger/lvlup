import { describe, expect, it } from 'vitest';
import { renderDrawings } from './drawing';
import { sanitizeCardHtml } from './sanitize';

describe('le HTML d’une carte, filtré (docs/securite.md §4)', () => {
  it('laisse passer tel quel ce que l’éditeur écrit', () => {
    const editor =
      '<p>Un <strong>mot</strong>, <em>deux</em>, <u>trois</u>, <s>quatre</s>, <mark>cinq</mark>, <code>a &lt; b</code><br>suite</p><ul><li><p>un</p></li></ul><ol><li><p>deux</p></li></ol>';
    expect(sanitizeCardHtml(editor)).toBe(editor);
  });

  it('garde un dessin, que drawing.ts redessine', () => {
    const html = '<p>avant</p><div data-drawing="ink:6:12,40 13,42|red:3:1,2 3,4" class="flashcards-drawing"></div>';
    expect(sanitizeCardHtml(html)).toBe(html);
    expect(sanitizeCardHtml('<div data-drawing="ink:6:1,2"></div>')).toBe('<div data-drawing="ink:6:1,2" class="flashcards-drawing"></div>');
    expect(sanitizeCardHtml('<div class="x" data-drawing="ink:6:1,2"></div>')).not.toContain('<div');
    expect(renderDrawings(sanitizeCardHtml(html))).toContain('<svg');
  });

  it('rend comme du texte toute balise, tout attribut et tout script qui n’en viennent pas', () => {
    for (const evil of [
      '<img src=x onerror="alert(1)">',
      '<script>alert(1)</script>',
      '<p onclick="alert(1)">x</p>',
      '<a href="javascript:alert(1)">x</a>',
      '<svg onload=alert(1)>',
      '<div data-drawing="x" onmouseover="alert(1)"></div>',
      '<iframe src="https://evil.example"></iframe>',
      '<img src="a>b" onerror=alert(1)>',
    ]) {
      const out = sanitizeCardHtml(evil);
      expect(out).not.toMatch(/<(img|script|a|svg|iframe)\b/i);
      expect(out).not.toMatch(/<[^>]*\son\w+=/i);
    }
    expect(sanitizeCardHtml('<p onclick="x">a</p>')).toBe('&lt;p onclick="x"&gt;a</p>');
  });

  it('garde lisible le texte brut d’un import en masse', () => {
    expect(sanitizeCardHtml('a < b et c > d')).toBe('a &lt; b et c &gt; d');
    expect(sanitizeCardHtml('Bonjour')).toBe('Bonjour');
  });
});
