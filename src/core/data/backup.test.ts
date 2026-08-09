import { describe, expect, it, vi } from 'vitest';
import type { AtlasModule } from '../lib/module';
import { BACKUP_VERSION, exportBackup, importBackup, readBackupFile } from './backup';
import { DEFAULT_SETTINGS } from './coreStore';

function fakeModule(id: string, legacyKey?: string): AtlasModule {
  return {
    id,
    label: id,
    emoji: '·',
    data: {
      exportData: vi.fn(async () => ({ from: id })),
      importData: vi.fn(async () => {}),
    },
    // Ce test n'exerce que la sauvegarde : l'écran n'a pas besoin d'être réel.
    Screen: () => null,
    fromLegacyBackup: legacyKey
      ? (raw) => (Array.isArray(raw[legacyKey]) ? { recupere: raw[legacyKey] } : null)
      : undefined,
  };
}

const core = {
  getSettings: async () => ({ ...DEFAULT_SETTINGS, dailyGoal: 70 }),
  updateSettings: vi.fn(async () => {}),
};

describe('sauvegarde', () => {
  it('range chaque module dans sa section, et les réglages à part', async () => {
    const file = await exportBackup([fakeModule('objectifs'), fakeModule('budget')], core);
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.modules).toEqual({ objectifs: { from: 'objectifs' }, budget: { from: 'budget' } });
    expect(file.settings?.dailyGoal).toBe(70);
  });

  it('relit un fichier versionné tel quel', () => {
    const raw = { version: BACKUP_VERSION, settings: DEFAULT_SETTINGS, modules: { objectifs: 42 } };
    expect(readBackupFile(raw, [fakeModule('objectifs')]).modules.objectifs).toBe(42);
  });

  it('convertit un fichier à plat en interrogeant les modules', () => {
    // Le socle ne connaît pas le champ `goals` : c'est le module qui le réclame.
    const file = readBackupFile({ version: 4, goals: [{ id: 'g1' }] },
      [fakeModule('objectifs', 'goals')]);
    expect(file.modules).toEqual({ objectifs: { recupere: [{ id: 'g1' }] } });
  });

  it('ignore un module qui ne trouve rien dans un fichier à plat', () => {
    const file = readBackupFile({ goals: [] } as Record<string, unknown>,
      [fakeModule('objectifs', 'goals'), fakeModule('budget', 'entries')]);
    expect(Object.keys(file.modules)).toEqual(['objectifs']);
  });

  it('refuse un fichier étranger plutôt que d’écraser des données', () => {
    expect(() => readBackupFile({ n: 1 }, [fakeModule('objectifs', 'goals')])).toThrow();
    expect(() => readBackupFile(null, [fakeModule('objectifs', 'goals')])).toThrow();
    expect(() => readBackupFile('{}', [fakeModule('objectifs', 'goals')])).toThrow();
  });

  it('restaure chaque section auprès de son module, puis les réglages', async () => {
    const objectifs = fakeModule('objectifs');
    await importBackup(
      { version: BACKUP_VERSION, settings: DEFAULT_SETTINGS, modules: { objectifs: { a: 1 } } },
      [objectifs],
      core,
    );
    expect(objectifs.data.importData).toHaveBeenCalledWith({ a: 1 });
    expect(core.updateSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });

  it('ignore sans bruit la section d’un module absent de cette installation', async () => {
    // Une sauvegarde faite avec un module de plus doit rester importable.
    const objectifs = fakeModule('objectifs');
    await importBackup(
      { version: BACKUP_VERSION, modules: { objectifs: 1, sport: 2 } },
      [objectifs],
      core,
    );
    expect(objectifs.data.importData).toHaveBeenCalledTimes(1);
  });

  it('n’appelle aucun module quand sa section manque', async () => {
    const objectifs = fakeModule('objectifs');
    await importBackup({ version: BACKUP_VERSION, modules: {} }, [objectifs], core);
    expect(objectifs.data.importData).not.toHaveBeenCalled();
  });
});
