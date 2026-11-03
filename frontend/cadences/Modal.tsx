import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cadenceNameError, type CadenceDetail } from '../../shared/cadences';

export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="cad-modal" aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-title"><span className="pixel-mark" aria-hidden="true">✦</span><h2 id={id}>{title}</h2></div>
    <div className="modal-body">{children}</div>
  </dialog>;
}

export function CreateCadence({ onClose, onCreated }: { onClose: () => void; onCreated: (cadence: CadenceDetail) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function create() {
    if (pending.current) return;
    const invalid = cadenceNameError(name);
    if (invalid) { setError(invalid); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const api = window.villageDesktop?.cadences;
      if (!api) throw new Error('Open the desktop app to create a cadence.');
      const result = await api.create(name);
      if (!result.ok) throw new Error(result.error);
      onCreated(result.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create the cadence. Try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Modal title="Create New Cadence" onClose={onClose} busy={busy}>
    <p>A fresh space for your accounts, contacts and outreach.</p>
    <form onSubmit={event => { event.preventDefault(); void create(); }}>
      <label htmlFor="cadence-name">Cadence name</label>
      <input id="cadence-name" autoFocus maxLength={80} value={name} disabled={busy} autoComplete="off" spellCheck={false} aria-describedby="cadence-name-help cadence-name-error" aria-invalid={!!error} placeholder="e.g. Autumn outreach" onChange={event => { setName(event.target.value); setError(''); }} />
      <p id="cadence-name-help" className="field-help">1–80 characters. Letters, numbers, spaces, hyphens or underscores.</p>
      <p id="cadence-name-error" role="alert" className="form-error">{error}</p>
      <div className="modal-actions"><button type="button" className="small-button" disabled={busy} onClick={onClose}>Cancel</button><button className="retro-button primary" disabled={busy}>{busy ? 'Creating…' : 'Create Cadence →'}</button></div>
    </form>
  </Modal>;
}
