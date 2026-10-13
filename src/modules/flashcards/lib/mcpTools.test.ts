import { describe, expect, it } from 'vitest';
import * as server from '../../../../supabase/functions/atlas-mcp/flashcards.ts';
import { flashcardsTools, type CardRow, type DeckRow, type FlashcardsData } from '../../../../supabase/functions/atlas-mcp/flashcards.ts';
import { withoutDuplicates } from './bulkImport';
import { htmlToPlainText } from './htmlPreview';
import { BOX_COUNT, CARD_FACE_MAX } from './types';

// Les outils de Flashcards du connecteur (docs/connecteur-claude.md §16).

describe('connecteur — Flashcards : le texte d’une carte', () => {
  it('reprend les bornes du module', () => {
    expect(server.BOX_COUNT).toBe(BOX_COUNT);
    expect(server.CARD_FACE_MAX).toBe(CARD_FACE_MAX);
  });

  it('traduit le petit Markdown dans les balises de l’éditeur', () => {
    expect(server.toCardHtml('Quelle est la **capitale** de l’*Australie* ?')).toBe('<p>Quelle est la <strong>capitale</strong> de l’<em>Australie</em> ?</p>');
    expect(server.toCardHtml('__a__ ~~b~~ ==c== `d*e*`')).toBe('<p><u>a</u> <s>b</s> <mark>c</mark> <code>d*e*</code></p>');
    expect(server.toCardHtml('Trois étapes :\n1. lire\n2. écrire\n\n- un\n- deux')).toBe(
      '<p>Trois étapes :</p><ol><li><p>lire</p></li><li><p>écrire</p></li></ol><ul><li><p>un</p></li><li><p>deux</p></li></ul>',
    );
    expect(server.toCardHtml('ligne 1\nligne 2\n\nautre')).toBe('<p>ligne 1<br>ligne 2</p><p>autre</p>');
    expect(server.toCardHtml('snake_case et 2 * 3 * 4')).toBe('<p>snake_case et 2 * 3 * 4</p>');
  });

  it('n’écrit jamais un HTML venu du texte', () => {
    const html = server.toCardHtml('<img src=x onerror="alert(1)"> & <script>x</script>');
    expect(html).toBe('<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &lt;script&gt;x&lt;/script&gt;</p>');
    expect(htmlToPlainText(html)).toBe('<img src=x onerror="alert(1)"> & <script>x</script>');
  });

  it('lit une carte comme le module', () => {
    for (const html of [
      '<p>Un <strong>mot</strong></p><ul><li><p>a &amp; b</p></li></ul>',
      '<p>avant</p><div data-drawing="ink:6:1,2 3,4"></div><p>après</p>',
      'texte brut d’un ancien import',
    ])
      expect(server.htmlToPlainText(html)).toBe(htmlToPlainText(html));
  });

  it('reconnaît un recto déjà là comme le module, mise en forme comprise', () => {
    const existing = ['<p>Capitale de la <strong>France</strong> ?</p>', 'Hola'];
    const cards = [
      { front: 'capitale de la france ?', back: '' },
      { front: '  HOLA ', back: '' },
      { front: 'Nouveau', back: '' },
    ];
    const app = withoutDuplicates(cards, existing.map(htmlToPlainText));
    const known = new Set(existing.map(server.frontKey));
    expect(cards.filter((c) => known.has(server.frontKey(server.toCardHtml(c.front))))).toEqual(app.duplicates);
  });
});

function memory() {
  let k = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++k).padStart(12, '0')}`;
  const decks: DeckRow[] = [{ id: uuid(), name: 'Espagnol', emoji: '🇪🇸', position: 0, archived: false }];
  const cards: CardRow[] = [
    { id: uuid(), deck_id: decks[0].id, front: '<p>Hola</p>', back: '<p>Bonjour</p>', box: 3, due_day: '2026-10-12', created_at: '' },
    { id: uuid(), deck_id: decks[0].id, front: '<p>dessin</p>', back: '<p>x</p><div data-drawing="ink:6:1,2"></div>', box: 1, due_day: '2026-10-20', created_at: '' },
  ];
  const data: FlashcardsData = {
    listDecks: async () => decks,
    insertDeck: async (r) => {
      const d = { id: uuid(), ...r } as DeckRow;
      decks.push(d);
      return d;
    },
    updateDeck: async (id, r) => Object.assign(decks.find((d) => d.id === id)!, r),
    listCards: async () => cards.map((c) => ({ ...c })),
    insertCards: async (rows) => {
      const made = rows.map((r) => ({ id: uuid(), created_at: '', ...r }) as CardRow);
      cards.push(...made);
      return made;
    },
    updateCard: async (id, r) => Object.assign(cards.find((c) => c.id === id)!, r),
    deleteCard: async (id) => {
      const i = cards.findIndex((c) => c.id === id);
      if (i < 0) return false;
      cards.splice(i, 1);
      return true;
    },
  };
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await flashcardsTools.find((t) => t.name === name)!.run(args, { data, today: '2026-10-12' });
    try {
      return JSON.parse(result.text);
    } catch {
      return { text: result.text };
    }
  };
  return { decks, cards, call };
}

describe('connecteur — Flashcards : les outils', () => {
  it('crée un paquet et y ajoute des cartes, en boîte 1, sans doublon', async () => {
    const m = memory();
    await m.call('flashcards_paquet_creer', { name: 'Histoire', emoji: '📜' });
    await expect(m.call('flashcards_paquet_creer', { name: 'histoire' })).rejects.toThrow(/existe/);
    const res = await m.call('flashcards_cartes_ajouter', {
      deck: 'espagnol',
      cards: [
        { front: 'Gracias', back: 'Merci' },
        { front: 'hola', back: 'Salut' },
        { front: 'Gracias', back: 'Merci (bis)' },
      ],
    });
    expect(res).toEqual({ message: '1 carte ajoutée à « Espagnol ».', skipped_duplicates: ['hola', 'Gracias'] });
    expect(m.cards.at(-1)).toMatchObject({ front: '<p>Gracias</p>', back: '<p>Merci</p>', box: 1, due_day: '2026-10-12' });
  });

  it('liste les paquets et les cartes en texte', async () => {
    const m = memory();
    const decks = await m.call('flashcards_paquets', {});
    expect(decks.decks[0]).toMatchObject({ name: '🇪🇸 Espagnol', cards: 2, due_today: 1, boxes: [1, 0, 1, 0, 0] });
    const cards = await m.call('flashcards_cartes', { deck: 'Espagnol', query: 'bonjour' });
    expect(cards.cards).toEqual([{ id: m.cards[0].id, front: 'Hola', back: 'Bonjour', box: 3, due: '2026-10-12' }]);
  });

  it('corrige une carte sans toucher à sa boîte, jamais une carte dessinée', async () => {
    const m = memory();
    await m.call('flashcards_carte_modifier', { id: m.cards[0].id, back: 'Bonjour / **Salut**' });
    expect(m.cards[0]).toMatchObject({ back: '<p>Bonjour / <strong>Salut</strong></p>', box: 3 });
    await expect(m.call('flashcards_carte_modifier', { id: m.cards[1].id, back: 'x' })).rejects.toThrow(/dessin/);
    await m.call('flashcards_carte_supprimer', { id: m.cards[1].id });
    expect(m.cards).toHaveLength(1);
  });
});
