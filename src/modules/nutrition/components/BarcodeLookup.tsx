import { useEffect, useRef, useState } from 'react';
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { lookupBarcode, OFF_CREDIT } from '../data/openFoodFacts';
import { isValidBarcode, normalizeBarcode, offToFoodForm } from '../lib/barcode';
import type { FoodFormValues } from '../lib/foodForm';
import type { Food } from '../lib/types';

/** Ce que la recherche d'un code a donné. */
export type BarcodeResult =
  /** Déjà recopié chez l'utilisateur : on le reprend tel quel, sans appel réseau. */
  | { kind: 'known'; food: Food }
  /** Trouvé sur Open Food Facts : un formulaire pré-rempli, à relire avant d'enregistrer. */
  | { kind: 'off'; barcode: string; values: FoodFormValues; missing: string[] }
  /** Inconnu partout : un formulaire vide, à recopier de l'étiquette. */
  | { kind: 'unknown'; barcode: string };

interface Props {
  /** Les aliments de l'utilisateur, pour reconnaître un code déjà recopié */
  foods: Food[];
  onResult: (result: BarcodeResult) => void;
  onBack: () => void;
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;
/** Intervalle entre deux lectures d'image : assez vif, sans faire chauffer le téléphone. */
const SCAN_INTERVAL_MS = 200;

/**
 * Scanner un code-barres, ou le taper (étape 6, docs/etude-nutrition.md §4,
 * §8, §12).
 *
 * Caméra : l'API native `BarcodeDetector` quand le navigateur l'a (Chrome sur
 * Android) ; sinon — Safari sur iPhone, et tous les navigateurs iOS qui
 * reposent sur lui — la même API reproduite par `barcode-detector`, qui lit
 * l'image avec zxing compilé en WebAssembly. Ce fichier `.wasm` (1 Mo) est
 * servi par l'application elle-même, jamais par un CDN, et ne se télécharge
 * qu'à la première ouverture du scanner.
 *
 * La saisie des chiffres reste toujours possible : caméra refusée, absente,
 * code abîmé ou mal éclairé.
 */
export function BarcodeLookup({ foods, onResult, onBack }: Props) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function resolve(raw: string) {
    const code = normalizeBarcode(raw);
    if (!isValidBarcode(code)) {
      setError('Ce code ne semble pas valide : vérifie les chiffres (8, 12 ou 13).');
      return;
    }
    const known = foods.find((f) => f.barcode === code);
    if (known) {
      onResult({ kind: 'known', food: known });
      return;
    }
    setBusy(true);
    setError('');
    try {
      const lookup = await lookupBarcode(code);
      if (lookup.found) {
        const { values, missing } = offToFoodForm(lookup.product);
        onResult({ kind: 'off', barcode: code, values, missing });
      } else {
        onResult({ kind: 'unknown', barcode: code });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche impossible.');
      setBusy(false);
    }
  }

  return (
    <div className="nutrition-barcode">
      {!busy && <CameraView onDetected={(code) => void resolve(code)} />}

      <div className="field">
        <label htmlFor="nutrition-barcode-input">Ou tape les chiffres sous le code-barres</label>
        <div className="nutrition-barcode-manual">
          <input
            id="nutrition-barcode-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void resolve(typed);
            }}
            placeholder="8 à 13 chiffres"
          />
          <button type="button" className="btn" onClick={() => void resolve(typed)} disabled={busy}>
            Chercher
          </button>
        </div>
      </div>

      {busy && <p className="nutrition-search-hint">Recherche sur Open Food Facts…</p>}
      {error && <div className="notice error">{error}</div>}

      <div className="nutrition-barcode-foot">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Retour à la recherche
        </button>
        <span className="nutrition-credit">Produits : {OFF_CREDIT}</span>
      </div>
    </div>
  );
}

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

async function createDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (native) return new native({ formats: [...FORMATS] });
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? zxingWasmUrl : prefix + path),
    },
  });
  return new BarcodeDetector({ formats: [...FORMATS] });
}

function cameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError') {
    return 'Accès à la caméra refusé. Autorise-le dans les réglages du navigateur, ou tape le code.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Aucune caméra disponible sur cet appareil : tape le code.';
  }
  return 'La caméra n’a pas pu démarrer : tape le code.';
}

/** Le flux de la caméra arrière, lu en boucle jusqu'au premier code valide. */
function CameraView({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [message, setMessage] = useState('');
  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        // Hors HTTPS, ou navigateur sans caméra : pas d'erreur à montrer, la
        // saisie des chiffres suffit.
        setStatus('error');
        setMessage('La caméra n’est pas disponible ici : tape le code.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = await createDetector();
        if (cancelled) return;
        setStatus('scanning');

        const tick = async () => {
          if (cancelled) return;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              const valid = codes.map((c) => c.rawValue).find(isValidBarcode);
              if (valid && !cancelled) {
                cancelled = true;
                navigator.vibrate?.(60);
                detectedRef.current(valid);
                return;
              }
            }
          } catch {
            // Une image illisible n'arrête pas le scanner : on essaie la suivante.
          }
          timer = setTimeout(() => void tick(), SCAN_INTERVAL_MS);
        };
        void tick();
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(cameraError(err));
      }
    }

    void start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (status === 'error') return <p className="nutrition-barcode-message">{message}</p>;

  return (
    <div className="nutrition-barcode-camera">
      {/* `playsInline` et `muted` : sans eux, Safari sur iPhone ouvre la vidéo
          en plein écran au lieu de l'afficher dans la fenêtre. */}
      <video ref={videoRef} className="nutrition-barcode-video" playsInline muted aria-label="Caméra" />
      <span className="nutrition-barcode-frame" aria-hidden="true" />
      <p className="nutrition-barcode-status">
        {status === 'starting' ? 'Démarrage de la caméra…' : 'Vise le code-barres'}
      </p>
    </div>
  );
}
