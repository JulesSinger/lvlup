/**
 * Les modèles de projet (docs/etude-projets.md §3.3, §12) — bibliothèque pure.
 *
 * Un modèle est la liste de chantiers et de tâches qu'Atlas recopie dans un
 * nouveau projet. La copie est indépendante : modifier un projet ne touche ni
 * le modèle ni les autres projets. Les modèles vivent dans le code (pas de
 * table) : on les enrichit au fil des versions, d'un projet à l'autre.
 *
 * Plusieurs modèles, décision de Jules (05/10/2026). La maintenance n'en est
 * pas un : c'est un statut, un suivi après livraison sans chantiers.
 */
import type { ProjectTaskDraft, WorkstreamDraft } from './types';

export const TEMPLATE_IDS = ['vitrine', 'boutique', 'refonte', 'vide'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface TemplateWorkstream {
  title: string;
  tasks: string[];
}

export interface ProjectTemplate {
  id: TemplateId;
  label: string;
  description: string;
  workstreams: TemplateWorkstream[];
}

const DECOUVERTE: TemplateWorkstream = {
  title: 'Découverte',
  tasks: [
    'Premier rendez-vous avec le client',
    'Remplir le questionnaire de besoins',
    'Envoyer le devis',
    'Recevoir le devis signé',
    'Recevoir l’acompte',
  ],
};

const CONTENUS: TemplateWorkstream = {
  title: 'Contenus',
  tasks: [
    'Recevoir le logo',
    'Recevoir les photos',
    'Textes de présentation',
    'Horaires, adresse et contact',
    'Carte, tarifs ou prestations',
    'Accès aux réseaux sociaux et à la fiche Google',
  ],
};

const MAQUETTE: TemplateWorkstream = {
  title: 'Maquette',
  tasks: ['Arborescence des pages', 'Maquette de l’accueil', 'Maquette d’une page intérieure', 'Validation de la maquette par le client'],
};

const DEVELOPPEMENT: TemplateWorkstream = {
  title: 'Développement',
  tasks: [
    'Mettre en place le projet',
    'Page d’accueil',
    'Pages intérieures',
    'Formulaire de contact',
    'Carte et accès',
    'Liens vers les réseaux sociaux',
    'Version téléphone',
    'Référencement de base : titres et descriptions',
    'Optimiser les images',
  ],
};

const HEBERGEMENT: TemplateWorkstream = {
  title: 'Hébergement & domaine',
  tasks: [
    'Choisir l’hébergement',
    'Acheter ou transférer le nom de domaine, au nom du client',
    'Adresse e-mail professionnelle',
    'HTTPS',
  ],
};

const RECETTE: TemplateWorkstream = {
  title: 'Recette',
  tasks: [
    'Envoyer le lien de préproduction',
    'Relecture par le client',
    'Corrections',
    'Tester sur iPhone et Android',
    'Tester le formulaire de contact',
    'Validation écrite du client',
  ],
};

const MISE_EN_LIGNE: TemplateWorkstream = {
  title: 'Mise en ligne',
  tasks: [
    'Mettre en ligne',
    'Mentions légales',
    'Politique de confidentialité',
    'Search Console et plan du site',
    'Lien du site sur la fiche Google',
    'Favicon et image de partage',
    'Première sauvegarde',
  ],
};

const APRES: TemplateWorkstream = {
  title: 'Après',
  tasks: ['Former le client à modifier son site', 'Encaisser le solde', 'Demander un avis', 'Relancer à trois mois'],
};

const BOUTIQUE: TemplateWorkstream = {
  title: 'Boutique',
  tasks: [
    'Catalogue des produits',
    'Fiches produits et photos',
    'Paiement en ligne, sur un compte au nom du client',
    'Livraison ou retrait en boutique',
    'Conditions générales de vente',
    'E-mails de confirmation de commande',
    'Commande test de bout en bout',
  ],
};

const REPRISE: TemplateWorkstream = {
  title: 'Reprise de l’existant',
  tasks: [
    'Audit du site actuel : pages, visites, ce qui marche',
    'Récupérer les accès à l’ancien hébergement',
    'Sauvegarder l’ancien site',
    'Récupérer les contenus à garder',
    'Lister les anciennes adresses des pages',
    'Rediriger les anciennes adresses vers les nouvelles',
  ],
};

export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: 'vitrine',
    label: 'Site vitrine',
    description: 'Présenter le commerce, ses horaires, sa carte ou ses tarifs',
    workstreams: [DECOUVERTE, CONTENUS, MAQUETTE, DEVELOPPEMENT, HEBERGEMENT, RECETTE, MISE_EN_LIGNE, APRES],
  },
  {
    id: 'boutique',
    label: 'Boutique en ligne',
    description: 'Un site vitrine qui vend : catalogue, paiement, livraison ou retrait',
    workstreams: [DECOUVERTE, CONTENUS, MAQUETTE, DEVELOPPEMENT, BOUTIQUE, HEBERGEMENT, RECETTE, MISE_EN_LIGNE, APRES],
  },
  {
    id: 'refonte',
    label: 'Refonte',
    description: 'Refaire un site existant sans perdre ses visites',
    workstreams: [DECOUVERTE, REPRISE, CONTENUS, MAQUETTE, DEVELOPPEMENT, HEBERGEMENT, RECETTE, MISE_EN_LIGNE, APRES],
  },
  {
    id: 'vide',
    label: 'Projet vide',
    description: 'Aucun chantier : tu construis tout toi-même',
    workstreams: [],
  },
];

export function templateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}

/**
 * La copie d'un modèle pour un projet : chantiers et tâches, avec leurs
 * identifiants déjà choisis (`makeId`, injecté pour les tests) — de quoi
 * appeler `addWorkstreams` de façon rejouable.
 */
export function instantiateTemplate(
  template: ProjectTemplate,
  projectId: string,
  makeId: () => string,
): { workstreams: WorkstreamDraft[]; tasks: ProjectTaskDraft[] } {
  const workstreams: WorkstreamDraft[] = [];
  const tasks: ProjectTaskDraft[] = [];
  template.workstreams.forEach((ws, position) => {
    const workstreamId = makeId();
    workstreams.push({ id: workstreamId, projectId, title: ws.title, position, dueDay: null });
    ws.tasks.forEach((title, taskPosition) => {
      tasks.push({ id: makeId(), projectId, workstreamId, title, position: taskPosition });
    });
  });
  return { workstreams, tasks };
}
