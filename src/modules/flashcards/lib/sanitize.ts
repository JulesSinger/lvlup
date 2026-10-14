/**
 * Le HTML d'une carte, filtré avant l'affichage — docs/securite.md §4.
 *
 * `RichText` affiche le recto et le verso en HTML. Ce HTML vient de l'éditeur
 * (Tiptap, schéma restreint), mais pas seulement : une carte importée en masse
 * est du texte brut, et une sauvegarde peut avoir été retouchée. Avant ce
 * filtre, « <img src=x onerror=…> » collé dans un import s'exécutait.
 *
 * Liste blanche, sans bibliothèque : seules les balises que l'éditeur produit
 * passent, **sans aucun attribut** ; le bloc de dessin garde son
 * `data-drawing` (que `lib/drawing.ts` revalide trait par trait) et sa classe. Tout le
 * reste — une balise inconnue, un attribut, un commentaire — est rendu comme
 * du texte, visible et inoffensif, plutôt que supprimé en silence.
 */

const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'code', 'ul', 'ol', 'li']);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s[^<>]*)?)\s*(\/?)>/g;
const ATTR = /\s+([a-z-]+)="([^"]*)"/gi;
const DRAWING_DATA = /^[a-z0-9:,|. -]*$/i;

/** Le bloc de dessin tel que l'éditeur l'écrit : `data-drawing`, et au plus sa classe. */
function drawingData(attrs: string): string | null {
  if (attrs.replace(ATTR, '').trim()) return null;
  let data: string | null = null;
  for (const [, name, value] of attrs.matchAll(ATTR)) {
    if (name === 'data-drawing' && DRAWING_DATA.test(value)) data = value;
    else if (!(name === 'class' && value === 'flashcards-drawing')) return null;
  }
  return data;
}

const escapeText = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function sanitizeCardHtml(html: string): string {
  let out = '';
  let last = 0;
  let openDrawings = 0;
  for (const m of html.matchAll(TAG)) {
    out += escapeText(html.slice(last, m.index));
    last = m.index + m[0].length;
    const [raw, closing, name, attrs] = m;
    const tag = name.toLowerCase();
    if (ALLOWED.has(tag) && !attrs.trim()) {
      out += closing ? (tag === 'br' ? '' : `</${tag}>`) : tag === 'br' ? '<br>' : `<${tag}>`;
    } else if (tag === 'div' && !closing && drawingData(attrs) !== null) {
      out += `<div data-drawing="${drawingData(attrs)}" class="flashcards-drawing">`;
      openDrawings++;
    } else if (tag === 'div' && closing && openDrawings > 0) {
      out += '</div>';
      openDrawings--;
    } else {
      out += escapeText(raw);
    }
  }
  return out + escapeText(html.slice(last));
}
