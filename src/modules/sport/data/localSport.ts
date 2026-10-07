import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import {
  DEFAULT_SPORT_SETTINGS,
  type ImportToken,
  type Plan,
  type PlanInput,
  type PlanPatch,
  type PlanSession,
  type PlanSessionDraft,
  type PlanSessionPatch,
  type Run,
  type RunImport,
  type RunInput,
  type RunPatch,
  type SportSettings,
} from '../lib/types';
import type { SportBackup, SportStore } from './sportStore';

const arrayOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Un jeton en mode local : on garde l'empreinte, comme la base. */
type LocalToken = ImportToken & { tokenHash: string };

interface Snapshot {
  runs: Run[];
  plans: Plan[];
  sessions: PlanSession[];
  settings: SportSettings;
  tokens: LocalToken[];
}

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  return {
    runs: arrayOf<Run>(raw.sportRuns),
    plans: arrayOf<Plan>(raw.sportPlans),
    sessions: arrayOf<PlanSession>(raw.sportSessions),
    settings: { ...DEFAULT_SPORT_SETTINGS, ...(raw.sportSettings as Partial<SportSettings> | undefined) },
    tokens: arrayOf<LocalToken>(raw.sportTokens),
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(s: Snapshot) {
  writeRaw({
    ...readRaw(),
    sportRuns: s.runs,
    sportPlans: s.plans,
    sportSessions: s.sessions,
    sportSettings: s.settings,
    sportTokens: s.tokens,
  });
}

const byStart = (a: Run, b: Run) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id);
const bySession = (a: PlanSession, b: PlanSession) =>
  a.planId.localeCompare(b.planId) || a.week - b.week || a.position - b.position;

function toRun(input: RunInput, id: string, createdAt: string): Run {
  return {
    id,
    startedAt: input.startedAt,
    day: input.day,
    distanceM: input.distanceM,
    durationS: input.durationS,
    elevationM: input.elevationM ?? null,
    avgHr: input.avgHr ?? null,
    maxHr: input.maxHr ?? null,
    kind: input.kind ?? 'footing',
    effort: input.effort ?? null,
    title: input.title ?? '',
    note: input.note ?? '',
    source: input.source ?? 'manuel',
    sourceRef: input.sourceRef ?? null,
    sessionId: input.sessionId ?? null,
    splitsS: input.splitsS ?? null,
    createdAt,
  };
}

/** Les mêmes refus que la base, pour que le mode local ne permette pas plus. */
function checkSessionLink(s: Snapshot, sessionId: string | null | undefined) {
  if (sessionId && !s.sessions.some((x) => x.id === sessionId)) throw new Error('Séance introuvable.');
}

/** Sport dans le navigateur (mode local, sans compte). */
export class LocalSport implements SportStore {
  async listRuns(): Promise<Run[]> {
    return read().runs.slice().sort(byStart);
  }

  async createRun(input: RunInput, id: string = newId()): Promise<Run> {
    const s = read();
    const existing = s.runs.find((r) => r.id === id);
    if (existing) return existing;
    if (input.sourceRef && s.runs.some((r) => r.sourceRef === input.sourceRef)) {
      throw new Error('Cette sortie est déjà importée.');
    }
    checkSessionLink(s, input.sessionId);
    const run = toRun(input, id, new Date().toISOString());
    s.runs.push(run);
    write(s);
    return run;
  }

  async updateRun(id: string, patch: RunPatch) {
    const s = read();
    const run = s.runs.find((r) => r.id === id);
    if (!run) return;
    checkSessionLink(s, patch.sessionId);
    Object.assign(run, patch);
    write(s);
  }

  async deleteRun(id: string) {
    const s = read();
    s.runs = s.runs.filter((r) => r.id !== id);
    write(s);
  }

  async importRuns(runs: RunImport[]): Promise<number> {
    const s = read();
    const refs = new Set(s.runs.map((r) => r.sourceRef).filter(Boolean));
    const ids = new Set(s.runs.map((r) => r.id));
    const now = new Date().toISOString();
    let added = 0;
    for (const input of runs) {
      if (refs.has(input.sourceRef) || ids.has(input.id)) continue;
      s.runs.push(toRun(input, input.id, now));
      refs.add(input.sourceRef);
      ids.add(input.id);
      added += 1;
    }
    if (added > 0) write(s);
    return added;
  }

  async listPlans(): Promise<Plan[]> {
    return read().plans.slice().sort((a, b) => a.raceDay.localeCompare(b.raceDay));
  }

  async createPlan(input: PlanInput, id: string = newId()): Promise<Plan> {
    const s = read();
    const existing = s.plans.find((p) => p.id === id);
    if (existing) return existing;
    if (input.startDay > input.raceDay) throw new Error('Le plan commence après la course.');
    const plan: Plan = {
      id,
      title: input.title,
      raceDistanceM: input.raceDistanceM,
      raceDay: input.raceDay,
      raceDayConfirmed: input.raceDayConfirmed ?? false,
      targetS: input.targetS ?? null,
      referenceDistanceM: input.referenceDistanceM ?? null,
      referenceS: input.referenceS ?? null,
      sessionsPerWeek: input.sessionsPerWeek ?? 3,
      startDay: input.startDay,
      status: input.status ?? 'actif',
      createdAt: new Date().toISOString(),
    };
    s.plans.push(plan);
    write(s);
    return plan;
  }

  async updatePlan(id: string, patch: PlanPatch) {
    const s = read();
    const plan = s.plans.find((p) => p.id === id);
    if (!plan) return;
    const next = { ...plan, ...patch };
    if (next.startDay > next.raceDay) throw new Error('Le plan commence après la course.');
    Object.assign(plan, patch);
    write(s);
  }

  async deletePlan(id: string) {
    const s = read();
    const gone = new Set(s.sessions.filter((x) => x.planId === id).map((x) => x.id));
    s.plans = s.plans.filter((p) => p.id !== id);
    s.sessions = s.sessions.filter((x) => x.planId !== id);
    // `on delete set null` côté base : les sorties restent, détachées.
    for (const run of s.runs) if (run.sessionId && gone.has(run.sessionId)) run.sessionId = null;
    write(s);
  }

  async listSessions(): Promise<PlanSession[]> {
    return read().sessions.slice().sort(bySession);
  }

  async addSessions(sessions: PlanSessionDraft[]) {
    const s = read();
    const now = new Date().toISOString();
    const known = new Set(s.sessions.map((x) => x.id));
    for (const draft of sessions) {
      if (known.has(draft.id)) continue;
      if (!s.plans.some((p) => p.id === draft.planId)) throw new Error('Plan introuvable.');
      s.sessions.push({ ...draft, createdAt: now });
      known.add(draft.id);
    }
    write(s);
  }

  async updateSession(id: string, patch: PlanSessionPatch) {
    const s = read();
    const session = s.sessions.find((x) => x.id === id);
    if (!session) return;
    Object.assign(session, patch);
    write(s);
  }

  async deleteSession(id: string) {
    const s = read();
    s.sessions = s.sessions.filter((x) => x.id !== id);
    for (const run of s.runs) if (run.sessionId === id) run.sessionId = null;
    write(s);
  }

  async getSettings(): Promise<SportSettings> {
    return read().settings;
  }

  async updateSettings(patch: Partial<SportSettings>) {
    const s = read();
    const next = { ...s.settings, ...patch };
    if (next.hrMax !== null && next.hrRest !== null && next.hrRest >= next.hrMax) {
      throw new Error('La fréquence de repos doit être sous la fréquence maximale.');
    }
    s.settings = next;
    write(s);
  }

  async listTokens(): Promise<ImportToken[]> {
    return read().tokens.map(({ tokenHash: _hash, ...token }) => token);
  }

  async createToken(tokenHash: string, label: string, id: string = newId()): Promise<ImportToken> {
    if (!/^[0-9a-f]{64}$/.test(tokenHash)) throw new Error('Empreinte de jeton invalide.');
    const s = read();
    const existing = s.tokens.find((t) => t.id === id);
    const token: LocalToken = existing ?? { id, label, tokenHash, createdAt: new Date().toISOString(), lastUsedAt: null };
    if (!existing) {
      s.tokens.push(token);
      write(s);
    }
    const { tokenHash: _hash, ...shown } = token;
    return shown;
  }

  async deleteToken(id: string) {
    const s = read();
    s.tokens = s.tokens.filter((t) => t.id !== id);
    write(s);
  }

  async exportData(): Promise<SportBackup> {
    const s = read();
    return { runs: s.runs, plans: s.plans, sessions: s.sessions, settings: s.settings };
  }

  async importData(data: SportBackup) {
    const s = read();
    write({
      runs: data.runs ?? [],
      plans: data.plans ?? [],
      sessions: data.sessions ?? [],
      settings: { ...DEFAULT_SPORT_SETTINGS, ...data.settings },
      tokens: s.tokens,
    });
  }
}
