import { htmlToPlainText, truncatePreview } from '../lib/htmlPreview';

interface Props {
  html: string;
  className?: string;
  maxLength?: number;
}

/**
 * Aperçu tronqué d'un recto/verso dans une liste (paquet, boîte). Le texte
 * intégral, mis en forme, reste dans l'éditeur (« Modifier ») et l'écran de
 * révision — ici seulement un aperçu texte simple, avec le texte complet en
 * infobulle native au survol.
 */
export function CardPreview({ html, className, maxLength = 70 }: Props) {
  const text = htmlToPlainText(html);
  return (
    <span className={className} title={text}>
      {truncatePreview(text, maxLength)}
    </span>
  );
}
