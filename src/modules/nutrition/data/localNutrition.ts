import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import type { Entry, EntryInput, Food, FoodInput, Target, TargetInput } from '../lib/types';
import type { NutritionBackup, NutritionStore } from './nutritionStore';

interface Snapshot extends NutritionBackup {}

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  return {
    foods: Array.isArray(raw.nutritionFoods) ? (raw.nutritionFoods as Food[]) : [],
    entries: Array.isArray(raw.nutritionEntries) ? (raw.nutritionEntries as Entry[]) : [],
    targets: Array.isArray(raw.nutritionTargets) ? (raw.nutritionTargets as Target[]) : [],
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(snapshot: Snapshot) {
  writeRaw({
    ...readRaw(),
    nutritionFoods: snapshot.foods,
    nutritionEntries: snapshot.entries,
    nutritionTargets: snapshot.targets,
  });
}

function byEffectiveFrom(a: Target, b: Target) {
  return a.effectiveFrom.localeCompare(b.effectiveFrom);
}

/** Nutrition (Cérès) stockée dans le navigateur, sans compte ni serveur. */
export class LocalNutrition implements NutritionStore {
  async listFoods(): Promise<Food[]> {
    return read().foods.slice();
  }

  async createFood(input: FoodInput): Promise<Food> {
    const snapshot = read();
    // Même règle que l'index unique partiel côté base : un code-barres n'est
    // recopié qu'une fois par compte.
    if (input.barcode && snapshot.foods.some((f) => f.barcode === input.barcode)) {
      throw new Error('Ce code-barres est déjà enregistré.');
    }
    const food: Food = {
      id: newId(),
      source: input.source ?? 'custom',
      barcode: input.barcode ?? null,
      name: input.name,
      brand: input.brand ?? null,
      kcal: input.kcal,
      proteinDg: input.proteinDg,
      carbsDg: input.carbsDg,
      fatDg: input.fatDg,
      fiberDg: input.fiberDg ?? null,
      servingGrams: input.servingGrams ?? null,
      favorite: input.favorite ?? false,
      createdAt: new Date().toISOString(),
    };
    snapshot.foods.push(food);
    write(snapshot);
    return food;
  }

  async updateFood(id: string, patch: Partial<FoodInput>) {
    const snapshot = read();
    const food = snapshot.foods.find((f) => f.id === id);
    if (!food) return;
    // Les entrées déjà saisies gardent leurs valeurs figées : rien à
    // propager, c'est tout l'intérêt (étude §6).
    Object.assign(food, patch);
    write(snapshot);
  }

  async deleteFood(id: string) {
    const snapshot = read();
    snapshot.foods = snapshot.foods.filter((f) => f.id !== id);
    // Comme `on delete set null` côté base : la ligne du journal reste,
    // seule sa référence disparaît.
    for (const entry of snapshot.entries) {
      if (entry.foodId === id) entry.foodId = null;
    }
    write(snapshot);
  }

  async listEntries(from: string, to: string): Promise<Entry[]> {
    return read().entries.filter((e) => e.day >= from && e.day <= to);
  }

  async createEntry(input: EntryInput): Promise<Entry> {
    const snapshot = read();
    const entry: Entry = { ...input, id: newId(), createdAt: new Date().toISOString() };
    snapshot.entries.push(entry);
    write(snapshot);
    return entry;
  }

  async updateEntry(id: string, patch: Partial<EntryInput>) {
    const snapshot = read();
    const entry = snapshot.entries.find((e) => e.id === id);
    if (!entry) return;
    Object.assign(entry, patch);
    write(snapshot);
  }

  async deleteEntry(id: string) {
    const snapshot = read();
    snapshot.entries = snapshot.entries.filter((e) => e.id !== id);
    write(snapshot);
  }

  async listTargets(): Promise<Target[]> {
    return read().targets.slice().sort(byEffectiveFrom);
  }

  async setTarget(input: TargetInput): Promise<Target> {
    const snapshot = read();
    const target: Target = { ...input, id: newId(), createdAt: new Date().toISOString() };
    // Un jour n'a qu'un objectif, comme la contrainte unique côté base.
    snapshot.targets = snapshot.targets.filter((t) => t.effectiveFrom !== input.effectiveFrom);
    snapshot.targets.push(target);
    write(snapshot);
    return target;
  }

  async deleteTarget(id: string) {
    const snapshot = read();
    snapshot.targets = snapshot.targets.filter((t) => t.id !== id);
    write(snapshot);
  }

  async exportData(): Promise<NutritionBackup> {
    const { foods, entries, targets } = read();
    return { foods: foods.slice(), entries: entries.slice(), targets: targets.slice() };
  }

  async importData(data: NutritionBackup) {
    write({ foods: data.foods ?? [], entries: data.entries ?? [], targets: data.targets ?? [] });
  }
}
