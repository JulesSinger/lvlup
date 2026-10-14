import { useEffect, useRef, useState } from 'react';

/**
 * Ce que les deux modes de cuisine partagent (étape par étape, et « En
 * cuisine », docs/etude-recettes.md §19-§20) : le bip et l'écran allumé.
 */

/** L'écran qui reste allumé : `navigator.wakeLock` (iPhone : iOS 18.4 et plus dans l'app installée). */
export type WakeState = 'on' | 'off' | 'unsupported';

interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: 'release', cb: () => void): void;
}

/** Un petit « bip » quand un minuteur sonne, sans fichier son. `count` bips, plus une vibration. */
export function beep(count = 3) {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    for (let n = 0; n < count; n++) {
      const at = n * 0.35;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.3);
    }
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    // Pas de son : l'écran le dit quand même.
  }
  navigator.vibrate?.(count > 1 ? [300, 150, 300] : 200);
}

/** L'écran allumé : demandé à l'ouverture, redemandé au retour sur l'app (le système le relâche en veille). */
export function useWakeLock(): WakeState {
  const [wake, setWake] = useState<WakeState>('off');
  const sentinel = useRef<WakeLockSentinelLike | null>(null);
  useEffect(() => {
    const api = (navigator as unknown as { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!api) {
      setWake('unsupported');
      return;
    }
    let alive = true;
    const request = async () => {
      try {
        const s = await api.request('screen');
        if (!alive) return void s.release();
        sentinel.current = s;
        setWake('on');
        s.addEventListener('release', () => alive && setWake('off'));
      } catch {
        setWake('off');
      }
    };
    void request();
    const onVisible = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel.current?.release().catch(() => undefined);
    };
  }, []);
  return wake;
}
