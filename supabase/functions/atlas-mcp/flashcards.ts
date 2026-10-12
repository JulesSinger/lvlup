/**
 * Les outils de Flashcards pour Claude (docs/connecteur-claude.md §15) —
 * règles pures, testées par Vitest (`src/modules/flashcards/lib/mcpTools.test.ts`).
 *
 * Priorité n° 6 de l'analyse du 11/10/2026 : « fais-moi des cartes sur ce
 * cours » — Claude lit un cours, une photo de notes, un PDF, et en tire des
 * questions-réponses rangées dans un paquet. Elles naissent en boîte 1, à
 * réviser aujourd'hui, comme une carte créée à la main. La révision, elle,
 * reste à l'app : c'est le geste qui fait apprendre.
 *
 * **Le HTML d'une carte n'est jamais écrit par Claude.** L'app affiche le
 * recto et le verso tels quels (`RichText`, sûr parce que le HTML ne sort que
 * de l'éditeur) : Claude écrit un petit Markdown — gras, italique, souligné,
 * barré, surligné, code, listes — que `toCardHtml` traduit dans les balises
 * de l'éditeur, tout le reste échappé. Une carte qui contient un dessin
 * n'est pas réécrite (le dessin serait perdu).
 */
import type { Tool, ToolResult } from './mcp.ts';

export const BOX_COUNT = 5;
export const CARD_FACE_MAX = 200000;
export const DECK_NAME_MAX = 80;
/** Au plus tant de cartes par envoi. */
export const CARDS_PER_CALL = 200;

export interface DeckRow {
  id: string;
  name: string;
  emoji: string;
  position: number;
  archived: boolean;
}

export interface CardRow {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  box: number;
  due_day: string;
  created_at: string;
}

export interface FlashcardsData {
  listDecks(): Promise<DeckRow[]>;
  insertDeck(row: Record<string, unknown>): Promise<DeckRow>;
  updateDeck(id: string, row: Record<string, unknown>): Promise<DeckRow | null>;
  listCards(): Promise<CardRow[]>;
  insertCards(rows: Record<string, unknown>[]): Promise<CardRow[]>;
  updateCard(id: string, row: Record<string, unknown>): Promise<CardRow | null>;
  deleteCard(id: string): Promise<boolean>;
}

export interface FlashcardsContext {
  data: FlashcardsData;
  today: string;
}

// --- Le texte d'une carte --------------------------------------------------------

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Les marques d'une ligne, sur du texte déjà échappé. Le code d'abord : rien ne se lit dedans. */
function inline(text: string): string {
  const codes: string[] = [];
  let s = escape(text).replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(c);
    return `\uE000${codes.length - 1}\uE000`;
  });
  s = s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?!\s)(.+?)_(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\uE000(\d+)\uE000/g, (_m, i: string) => `<code>${codes[Number(i)]}</code>`);
}

/**
 * Le petit Markdown de Claude → le HTML de l'éditeur (Tiptap) : un
 * paragraphe par bloc, les lignes d'un bloc séparées par `<br>`, les listes
 * à puces (`- `) et numérotées (`1. `).
 */
export function toCardHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li><p>${inline(i)}</p></li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (!line) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join('');
}

// Copie de `htmlToPlainText` (lib/htmlPreview.ts) : pour lire une carte et comparer les rectos.
const BLOCK_BREAK_RE = /<(p|div|li|br)[^>]*>/gi;
const TAG_RE = /<[^>]+>/g;
const ENTITY_RE = /&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g;
const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const DRAWING_RE = /<div\b[^>]*\sdata-drawing="[^"]*"[^>]*>\s*<\/div>/gi;

export function htmlToPlainText(html: string): string {
  const withoutTags = html.replace(DRAWING_RE, ' ✏️ dessin ').replace(BLOCK_BREAK_RE, ' ').replace(TAG_RE, '');
  const decoded = withoutTags.replace(ENTITY_RE, (m) => ENTITIES[m]);
  return decoded.replace(/\s+/g, ' ').trim();
}

const hasDrawing = (html: string) => /\sdata-drawing="/.test(html);

/** Deux rectos sont « le même » à la casse et aux espaces près (`withoutDuplicates` du module), mise en forme comprise. */
export const frontKey = (html: string) => htmlToPlainText(html).trim().toLowerCase();

// --- Les outils ---------------------------------------------------------------

class Refused extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) });
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function face(v: unknown, what: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new Refused(`${what} manque.`);
  const html = toCardHtml(v);
  if (html.length > CARD_FACE_MAX) throw new Refused(`${what} est trop long.`);
  return html;
}

async function findDeck(data: FlashcardsData, v: unknown): Promise<DeckRow> {
  if (typeof v !== 'string' || !v.trim()) throw new Refused('deck : le nom ou l’id d’un paquet.');
  const decks = await data.listDecks();
  const found = UUID.test(v) ? decks.filter((d) => d.id === v.toLowerCase()) : decks.filter((d) => fold(d.name) === fold(v));
  if (found.length === 1) return found[0];
  if (found.length > 1) throw new Refused(`Plusieurs paquets s’appellent « ${v} » : donne son id.`);
  throw new Refused(`Aucun paquet « ${v} » : flashcards_paquets les liste, flashcards_paquet_creer en crée un.`);
}

const cardOut = (c: CardRow) => ({
  id: c.id,
  front: htmlToPlainText(c.front),
  back: htmlToPlainText(c.back),
  box: c.box,
  due: c.due_day,
});

const CARD_TEXT =
  'Texte simple, avec si besoin **gras**, *italique*, __souligné__, ~~barré~~, ==surligné==, `code`, des listes (« - » ou « 1. ») et une ligne vide entre deux paragraphes. Pas de HTML.';

export const flashcardsTools: Tool<FlashcardsContext>[] = [
  {
    name: 'flashcards_paquets',
    title: 'Les paquets de cartes',
    description: 'Les paquets (id, nom, archivé ou non) avec leur nombre de cartes, celles à réviser aujourd’hui et la répartition par boîte (1 = à apprendre … 5 = maîtrisée).',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    async run(_args, { data, today }) {
      const [decks, cards] = await Promise.all([data.listDecks(), data.listCards()]);
      return json({
        decks: decks.map((d) => {
          const mine = cards.filter((c) => c.deck_id === d.id);
          return {
            id: d.id,
            name: `${d.emoji} ${d.name}`.trim(),
            archived: d.archived || undefined,
            cards: mine.length,
            due_today: d.archived ? 0 : mine.filter((c) => c.due_day <= today).length,
            boxes: Array.from({ length: BOX_COUNT }, (_, i) => mine.filter((c) => c.box === i + 1).length),
          };
        }),
      });
    },
  },
  {
    name: 'flashcards_paquet_creer',
    title: 'Créer un paquet',
    description: 'Crée un paquet de cartes (un nom court, et un emoji si tu veux).',
    inputSchema: { type: 'object', properties: { name: { type: 'string', maxLength: DECK_NAME_MAX }, emoji: { type: 'string' } }, required: ['name'] },
    annotations: {},
    async run(args, { data }) {
      const name = typeof args.name === 'string' ? args.name.trim() : '';
      if (!name || name.length > DECK_NAME_MAX) throw new Refused(`name : de 1 à ${DECK_NAME_MAX} caractères.`);
      const decks = await data.listDecks();
      if (decks.some((d) => fold(d.name) === fold(name))) throw new Refused(`Un paquet « ${name} » existe déjà : ajoute-lui des cartes.`);
      const emoji = typeof args.emoji === 'string' && args.emoji.trim() && [...args.emoji.trim()].length <= 4 ? args.emoji.trim() : '🪐';
      const created = await data.insertDeck({ name, emoji, position: decks.length, archived: false });
      return json({ message: `Paquet « ${name} » créé.`, deck: { id: created.id, name: created.name } });
    },
  },
  {
    name: 'flashcards_paquet_modifier',
    title: 'Renommer ou archiver un paquet',
    description: 'Renomme un paquet, change son emoji, l’archive (il quitte la révision, ses cartes restent) ou le restaure.',
    inputSchema: {
      type: 'object',
      properties: { deck: { type: 'string' }, name: { type: 'string', maxLength: DECK_NAME_MAX }, emoji: { type: 'string' }, archived: { type: 'boolean' } },
      required: ['deck'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const deck = await findDeck(data, args.deck);
      const row: Record<string, unknown> = {};
      if (args.name !== undefined) {
        const name = typeof args.name === 'string' ? args.name.trim() : '';
        if (!name || name.length > DECK_NAME_MAX) throw new Refused(`name : de 1 à ${DECK_NAME_MAX} caractères.`);
        row.name = name;
      }
      if (typeof args.emoji === 'string' && args.emoji.trim()) row.emoji = args.emoji.trim();
      if (typeof args.archived === 'boolean') row.archived = args.archived;
      if (Object.keys(row).length === 0) throw new Refused('Rien à changer.');
      await data.updateDeck(deck.id, row);
      return { text: `Paquet « ${String(row.name ?? deck.name)} » modifié.` };
    },
  },
  {
    name: 'flashcards_cartes_ajouter',
    title: 'Ajouter des cartes',
    description: `Ajoute des cartes à un paquet (${CARDS_PER_CALL} au plus par envoi) : une question ou une notion au recto, la réponse au verso, courtes et précises — une idée par carte. ${CARD_TEXT} Une carte dont le recto existe déjà dans le paquet est écartée. Elles sont à réviser dès aujourd’hui.`,
    inputSchema: {
      type: 'object',
      properties: {
        deck: { type: 'string', description: 'Le nom ou l’id du paquet.' },
        cards: {
          type: 'array',
          minItems: 1,
          maxItems: CARDS_PER_CALL,
          items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } }, required: ['front', 'back'] },
        },
      },
      required: ['deck', 'cards'],
    },
    annotations: {},
    async run(args, { data, today }) {
      const deck = await findDeck(data, args.deck);
      if (!Array.isArray(args.cards) || args.cards.length === 0) throw new Refused('cards : au moins une carte { front, back }.');
      if (args.cards.length > CARDS_PER_CALL) throw new Refused(`${CARDS_PER_CALL} cartes au plus par envoi.`);
      const parsed = args.cards.map((raw, i) => {
        const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
        return { front: face(o.front, `cards[${i}].front`), back: face(o.back, `cards[${i}].back`) };
      });
      const known = new Set((await data.listCards()).filter((c) => c.deck_id === deck.id).map((c) => frontKey(c.front)));
      const fresh: typeof parsed = [];
      const skipped: string[] = [];
      for (const card of parsed) {
        const key = frontKey(card.front);
        if (known.has(key)) skipped.push(htmlToPlainText(card.front));
        else {
          known.add(key);
          fresh.push(card);
        }
      }
      const created = fresh.length ? await data.insertCards(fresh.map((c) => ({ deck_id: deck.id, front: c.front, back: c.back, box: 1, due_day: today }))) : [];
      return json({
        message: `${created.length} carte${created.length > 1 ? 's' : ''} ajoutée${created.length > 1 ? 's' : ''} à « ${deck.name} ».`,
        skipped_duplicates: skipped.length ? skipped : undefined,
      });
    },
  },
  {
    name: 'flashcards_cartes',
    title: 'Lire les cartes d’un paquet',
    description: 'Les cartes d’un paquet en texte simple (id, recto, verso, boîte, prochaine révision) ; « query » cherche dans le recto et le verso ; « box » n’en garde qu’une boîte.',
    inputSchema: { type: 'object', properties: { deck: { type: 'string' }, query: { type: 'string' }, box: { type: 'integer', minimum: 1, maximum: BOX_COUNT } }, required: ['deck'] },
    annotations: { readOnlyHint: true },
    async run(args, { data }) {
      const deck = await findDeck(data, args.deck);
      const words = typeof args.query === 'string' ? fold(args.query).split(/\s+/).filter(Boolean) : [];
      const cards = (await data.listCards())
        .filter((c) => c.deck_id === deck.id && (args.box === undefined || c.box === args.box))
        .map(cardOut)
        .filter((c) => words.every((w) => fold(`${c.front} ${c.back}`).includes(w)));
      return json({ deck: deck.name, total: cards.length, cards: cards.slice(0, 500) });
    },
  },
  {
    name: 'flashcards_carte_modifier',
    title: 'Corriger une carte',
    description: `Réécrit le recto et/ou le verso d’une carte (sa boîte ne change pas). ${CARD_TEXT} Une carte qui contient un dessin se corrige dans l’app.`,
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, front: { type: 'string' }, back: { type: 'string' } }, required: ['id'] },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const id = typeof args.id === 'string' && UUID.test(args.id) ? args.id.toLowerCase() : null;
      if (!id) throw new Refused('id invalide : prends-le dans flashcards_cartes.');
      const card = (await data.listCards()).find((c) => c.id === id);
      if (!card) throw new Refused('Aucune carte avec cet id.');
      const row: Record<string, unknown> = {};
      if (args.front !== undefined) {
        if (hasDrawing(card.front)) throw new Refused('Le recto contient un dessin : il se corrige dans l’app.');
        row.front = face(args.front, 'front');
      }
      if (args.back !== undefined) {
        if (hasDrawing(card.back)) throw new Refused('Le verso contient un dessin : il se corrige dans l’app.');
        row.back = face(args.back, 'back');
      }
      if (Object.keys(row).length === 0) throw new Refused('Donne front ou back.');
      const updated = await data.updateCard(id, row);
      return json({ message: 'Carte corrigée.', card: updated && cardOut(updated) });
    },
  },
  {
    name: 'flashcards_carte_supprimer',
    title: 'Supprimer une carte',
    description: 'Supprime une carte (et son historique de révisions). Demande confirmation avant.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const id = typeof args.id === 'string' && UUID.test(args.id) ? args.id.toLowerCase() : null;
      if (!id) throw new Refused('id invalide : prends-le dans flashcards_cartes.');
      const card = (await data.listCards()).find((c) => c.id === id);
      if (!card || !(await data.deleteCard(id))) throw new Refused('Aucune carte avec cet id.');
      return { text: `Carte « ${htmlToPlainText(card.front).slice(0, 80)} » supprimée.` };
    },
  },
];
