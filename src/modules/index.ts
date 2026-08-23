import type { AtlasModule } from '../core/lib/module';
import { budgetModule } from './budget/module';
import { objectifsModule } from './objectifs/module';

/**
 * Le registre : la liste des modules actifs d'Atlas.
 *
 * C'est le seul fichier partagé qu'un nouveau module doit modifier — d'où sa
 * brièveté volontaire. Deux conversations qui ajoutent chacune un module n'ont
 * ici qu'une ligne à départager.
 */
export const MODULES: readonly AtlasModule[] = [objectifsModule, budgetModule];
