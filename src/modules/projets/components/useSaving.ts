import { useState } from 'react';

/** Un enregistrement en cours, et son erreur affichée dans la fenêtre plutôt que perdue. */
export function useSaving() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }
  return { saving, error, setError, run };
}
