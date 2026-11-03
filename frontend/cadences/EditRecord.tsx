import { useRef, useState } from 'react';
import type { CadenceEdit, StepKind } from '../../shared/cadence-edits';
import { stepLabels } from '../../shared/cadence-edits';
import { Modal } from './Modal';

export function EditRecord({ cadence, initial, onClose, onSaved }: { cadence: string; initial: Exclude<CadenceEdit, { kind: 'reply' }>; onClose: () => void; onSaved: (archived: boolean) => void }) {
  const [change, setChange] = useState(initial);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const archive = change.kind === 'archive';
  const removing = archive || change.remove;
  async function save() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await window.villageDesktop?.cadences.edit(cadence, change);
      if (!result?.ok) throw new Error(result && !result.ok ? result.error : 'Desktop bridge unavailable.');
      onSaved(archive);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save changes.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Modal title={archive ? 'Delete cadence' : removing ? 'Delete record' : change.kind === 'step' ? 'Next step' : 'Edit ' + change.kind} onClose={onClose} busy={busy}>
    <form className="record-editor" onSubmit={event => { event.preventDefault(); void save(); }}>
      {removing ? <p>{archive ? `Move “${cadence}” and all its files to the hidden recovery bin? It will disappear from the library and calendar.` : 'Delete this record? Other records and draft history will stay unchanged.'}</p> : change.kind === 'step' ? <>
        <label>Activity<select aria-label="Activity" value={change.type} onChange={event => setChange({ ...change, type: event.target.value as StepKind })}>{Object.entries(stepLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Title<input required maxLength={250} value={change.title} onChange={event => setChange({ ...change, title: event.target.value })} /></label>
        <label>Date<input required type="date" value={change.date} onChange={event => setChange({ ...change, date: event.target.value })} /></label>
        <label>Contact (optional)<input maxLength={250} value={change.contact} onChange={event => setChange({ ...change, contact: event.target.value })} /></label>
        <p>A manual reminder only. Nothing is sent or called automatically.</p>
      </> : Object.entries(change.values ?? {}).map(([key, value]) => <label key={key}>{({ name: 'Name', account: 'Account', position: 'Position', contacted: 'Contacted', salesforceLink: 'Salesforce link' } as Record<string, string>)[key]}<input required={key === 'name'} maxLength={2048} value={value} onChange={event => setChange({ ...change, values: { ...change.values, [key]: event.target.value } })} /></label>)}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="small-button" disabled={busy} onClick={onClose}>Cancel</button><button className="retro-button" disabled={busy}>{busy ? 'Saving…' : removing ? 'Confirm delete' : 'Save'}</button></div>
    </form>
  </Modal>;
}
