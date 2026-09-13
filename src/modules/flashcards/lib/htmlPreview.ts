/**
 * Aperçu texte d'un recto/verso pour une ligne de liste (post-V1) — demande
 * de Jules : « j'ai souvent des longues réponses et ça rend très moche, il
 * faut... ne pas afficher toute la réponse, juste le début ». `front`/`back`
 * sont du HTML écrit par l'éditeur (Tiptap, §19) ; l'aperçu retombe en texte
 * simple plutôt que de tronquer le HTML lui-même, qui casserait des balises
 * ouvertes à mi-chemin. La mise en forme complète reste visible dans
 * l'éditeur (« Modifier ») et l'écran de révision — jamais perdue, seulement
 * pas montrée deux fois.
 */

const BLOCK_BREAK_RE = /<(p|div|li|br)[^>]*>/gi;
const TAG_RE = /<[^>]+>/g;
const ENTITY_RE = /&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g;
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/** Réduit du HTML à du texte simple, sans balise ni entité. */
export function htmlToPlainText(html: string): string {
  const withoutTags = html.replace(BLOCK_BREAK_RE, ' ').replace(TAG_RE, '');
  const decoded = withoutTags.replace(ENTITY_RE, (m) => ENTITIES[m]);
  return decoded.replace(/\s+/g, ' ').trim();
}

/**
 * Coupe à `maxLength` caractères, sur la dernière frontière de mot quand
 * elle n'est pas trop loin du bord — sinon un mot coupé en plein milieu.
 */
export function truncatePreview(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}
