import { useRef } from 'react';

/**
 * Le bouton qui ouvre la photothèque (ou l'appareil photo, au choix du
 * téléphone). `image/*` : Safari sur iPhone convertit alors une photo HEIC
 * en JPEG au moment du choix.
 */
export function PhotoPicker({ label, disabled = false, onPick }: { label: string; disabled?: boolean; onPick: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn btn-sm hautsfaits-photo-pick" disabled={disabled} onClick={() => input.current?.click()}>
        {label}
      </button>
      <input
        ref={input}
        className="hautsfaits-file-input"
        type="file"
        accept="image/*"
        multiple
        aria-label="Choisir des photos"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onPick(files);
        }}
      />
    </>
  );
}
