import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './coreStore';
import { readSettingsCopy, saveSettingsCopy } from './settingsCopy';

function memory(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe('les réglages gardés sur l’appareil', () => {
  it('se relisent pour le même compte, jamais pour un autre', () => {
    const storage = memory();
    const settings = { ...DEFAULT_SETTINGS, workMode: true, moduleOrder: ['courses', 'taches'] };
    saveSettingsCopy('jules', settings, storage);
    expect(readSettingsCopy('jules', storage)).toEqual(settings);
    expect(readSettingsCopy('autre', storage)).toBeNull();
    expect(readSettingsCopy(null, storage)).toBeNull();
  });
});
