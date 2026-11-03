import { useState } from 'react';
import { isSalesforceLink, type CadenceDetail, type CadenceSummary } from '../../shared/cadences';
import { Calendar } from './Calendar';
import { dateKey } from './calendar-model';
import { EditRecord } from './EditRecord';
import { stepIcons, type CadenceEdit } from '../../shared/cadence-edits';
import { DraftHistory } from './DraftHistory';
import { DataTable } from './DataTable';

export function CadenceDashboard({ detail, cadences, onNotice, onOpen, onAddAccounts, onImportContacts, onDraftEmails, onChanged, onDeleted }: { detail: CadenceDetail; cadences: CadenceSummary[]; onNotice: (title: string, message: string) => void; onOpen: (name: string) => void; onAddAccounts: () => void; onImportContacts: () => void; onDraftEmails: () => void; onChanged: () => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState({ account: false, contact: false, step: false });
  const [edit, setEdit] = useState<Exclude<CadenceEdit, { kind: 'reply' }> | null>(null);
  const [planning, setPlanning] = useState<'calendar' | 'steps'>('calendar');
  const index = cadences.findIndex(cadence => cadence.name === detail.name);
  const upcoming = detail.events.slice().sort((a, b) => a.date.localeCompare(b.date));
  async function openLink(url: string) {
    try {
      const result = await window.villageDesktop?.cadences.openSalesforceLink(url);
      if (!result?.ok) onNotice('Link unavailable', result && !result.ok ? result.error : 'Open this link from the desktop app.');
    } catch { onNotice('Link unavailable', 'The Salesforce link could not be opened.'); }
  }
  function editToggle(kind: 'account' | 'contact' | 'step', label: string) {
    return <button className="small-button section-edit-toggle" aria-label={'Edit ' + label} aria-pressed={editing[kind]} onClick={() => setEditing(previous => ({ ...previous, [kind]: !previous[kind] }))}>{editing[kind] ? 'Done' : '✎'}</button>;
  }
  function recordName(kind: 'account' | 'contact', id: string | undefined, values: Record<string, string>) {
    return editing[kind] && id ? <button className="record-link" aria-label={'Edit ' + values.name} onClick={() => setEdit({ kind, id, values })}>{values.name}</button> : values.name;
  }
  function controls(kind: 'account' | 'contact', id: string | undefined, name: string) {
    return <button className="small-button" disabled={!id} aria-label={'Delete ' + name} onClick={() => setEdit({ kind, id: id!, remove: true })}>Delete</button>;
  }
  return <>
    <div className="cadence-edit-toolbar"><button className="small-button" onClick={() => setEdit({ kind: 'archive' })}>Delete cadence</button></div>
    {edit && <EditRecord cadence={detail.name} initial={edit} onClose={() => setEdit(null)} onSaved={archived => { setEdit(null); if (archived) onDeleted(); else onChanged(); }} />}

    <div className="cad-dashboard">
      <div className="dashboard-left">
        <section className="cad-panel accounts-panel" aria-labelledby="accounts-heading">
          <div className="panel-label"><h2 id="accounts-heading">Accounts</h2><span>{detail.accounts.length}</span>{editToggle('account', 'accounts')}</div>
          <div className="panel-action"><button className="retro-button" onClick={onAddAccounts}>+ Add Accounts</button></div>
          {editing.account && <p className="edit-hint">Select an account name to edit.</p>}
          <DataTable label="Accounts" headers={['Account Name', 'Salesforce Link', ...(editing.account ? ['Delete'] : [])]} rows={detail.accounts.map(account => [recordName('account', account.id, { name: account.name, salesforceLink: account.salesforceLink }), isSalesforceLink(account.salesforceLink) ? <button className="record-link" onClick={() => void openLink(account.salesforceLink)} title={account.salesforceLink}>Open account ↗</button> : account.salesforceLink ? <span title={account.salesforceLink}>Unsupported link</span> : '—', ...(editing.account ? [controls('account', account.id, account.name)] : [])])} empty="No accounts yet" />
        </section>
        <section className="cad-panel planning-panel" aria-label="Cadence planning">
          <div className="planning-toggle" role="group" aria-label="Planning view"><button aria-pressed={planning === 'calendar'} onClick={() => setPlanning('calendar')}>Calendar</button><button aria-pressed={planning === 'steps'} onClick={() => setPlanning('steps')}>Next Steps</button></div>
          {planning === 'calendar' ? <Calendar events={detail.events} cadences={cadences} compact /> : <div className="next-steps"><div className="section-edit-heading"><h3>Next steps</h3>{editToggle('step', 'next steps')}</div><button className="small-button" onClick={() => setEdit({ kind: 'step', type: 'email', title: '', date: dateKey(new Date()), contact: '' })}>+ Add next step</button>{editing.step && <p>Select a step title to edit.</p>}{upcoming.length ? <ul>{upcoming.map((event, i) => <li key={i} style={{ borderLeft: '4px solid ' + cadences.find(c => c.name === detail.name)?.color, paddingLeft: 8 }}><time dateTime={event.date}>{event.date}</time><strong>{event.type ? stepIcons[event.type] + ' ' : ''}{editing.step && event.id ? <button className="record-link" aria-label={'Edit ' + event.title} onClick={() => setEdit({ kind: 'step', id: event.id, type: event.type, title: event.title, date: event.date, contact: event.contact })}>{event.title}</button> : event.title}</strong>{event.contact && <span>{event.contact}</span>}{editing.step && event.id && <div className="record-actions"><button className="small-button" aria-label={'Delete ' + event.title} onClick={() => setEdit({ kind: 'step', id: event.id, remove: true })}>Delete</button></div>}</li>)}</ul> : <p>No next steps recorded. Add a dated reminder.</p>}</div>}
        </section>
      </div>
      <section className="cad-panel contacts-panel" aria-labelledby="contacts-heading">
        <div className="panel-label"><h2 id="contacts-heading">Contacts</h2><span>{detail.contacts.length}</span>{editToggle('contact', 'contacts')}</div>
        <div className="panel-action"><button className="retro-button" onClick={onImportContacts}>+ Import Contacts</button></div>
        {editing.contact && <p className="edit-hint">Select a contact name to edit.</p>}
        <DataTable label="Contacts" headers={['Name', 'Account', 'Position', 'Contacted', ...(editing.contact ? ['Delete'] : [])]} rows={detail.contacts.map(contact => [recordName('contact', contact.id, { name: contact.name, account: contact.account, position: contact.position, contacted: contact.contacted }), contact.account, contact.position, <span className="record-status">{contact.contacted}</span>, ...(editing.contact ? [controls('contact', contact.id, contact.name)] : [])])} empty="No contacts yet" />
      </section>
      <section className="cad-panel outreach-panel" aria-labelledby="outreach-heading">
        <div className="panel-label"><h2 id="outreach-heading">Outreach</h2></div>
        <div className="panel-action"><button className="retro-button" onClick={onDraftEmails}>+ Draft Emails</button></div>
        <DraftHistory cadence={detail.name} revision={detail} replies={detail.replies ?? {}} onChanged={onChanged} />
        {detail.outreach.length > 0 && <><h3 className="outreach-recorded-heading">Previously recorded replies</h3><DataTable label="Recorded replies" headers={['Contact', 'Replied']} rows={detail.outreach.map(item => [item.contact, item.replied])} empty="No replies recorded" /></>}
      </section>
    </div>
    <nav className="cadence-neighbours" aria-label="Browse cadences"><button className="small-button" disabled={index <= 0} onClick={() => onOpen(cadences[index - 1].name)}>← Previous cadence{index > 0 && <span>{cadences[index - 1].name}</span>}</button><button className="small-button" disabled={index < 0 || index >= cadences.length - 1} onClick={() => onOpen(cadences[index + 1].name)}>Next cadence →{index >= 0 && index < cadences.length - 1 && <span>{cadences[index + 1].name}</span>}</button></nav>
  </>;
}
