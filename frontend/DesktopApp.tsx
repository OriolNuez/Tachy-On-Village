import { OutlookConsole } from './jobs/OutlookConsole';
import { CognismConsole } from './jobs/CognismConsole';
import { SalesforcePreview } from './SalesforcePreview';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { CadenceDetail, CadenceLibrary, CalendarData, Result } from '../shared/cadences';
import { Calendar } from './cadences/Calendar';
import { CadenceDashboard } from './cadences/CadenceDashboard';
import { CreateCadence, Modal } from './cadences/Modal';
import { JobConsole } from './jobs/JobConsole';
import { useJobs } from './jobs/useJobs';
import './styles/desktop.css';

const Village = lazy(() => import('./App').then(module => ({ default: module.App })));
type Screen = { kind: 'menu' | 'cadences' | 'calendar' | 'village' | 'salesforce' } | { kind: 'detail'; name: string };
const menu = [
  { label: 'Existing Cadences', icon: '▤', accent: 'sage', screen: 'cadences' },
  { label: 'Salesforce', icon: '▥', accent: 'blue', screen: 'salesforce' },
  { label: 'Cognism', icon: '⌕', accent: 'peach' },
  { label: 'Emails', icon: '✉', accent: 'pink' },
  { label: 'Calendar', icon: '▦', accent: 'lavender', screen: 'calendar' },
] as const;
function unwrap<T>(result: Result<T>): T { if (!result.ok) throw new Error(result.error); return result.data; }

export function DesktopApp() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const [library, setLibrary] = useState<CadenceLibrary>({ path: '', cadences: [], warnings: [] });
  const [detail, setDetail] = useState<CadenceDetail | null>(null);
  const [calendar, setCalendar] = useState<CalendarData>({ events: [], warnings: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [outlookCadence, setOutlookCadence] = useState<string | null>(null);
  const [cognismCadence, setCognismCadence] = useState<string | null>(null);
  const [salesforceCadence, setSalesforceCadence] = useState<string | null>(null);
  const refreshAccounts = useCallback(() => setRefresh(value => value + 1), []);
  const { job, connectionError } = useJobs(refreshAccounts);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const name = screen.kind === 'detail' ? screen.name : '';
  useEffect(() => { heading.current?.focus(); }, [screen]);
  useEffect(() => {
    if (screen.kind === 'menu' || screen.kind === 'village' || screen.kind === 'salesforce') return;
    let cancelled = false;
    setLoading(true); setError('');
    async function load() {
      try {
        const api = window.villageDesktop?.cadences;
        if (!api) throw new Error('Cadence files are available in the Electron desktop app. Start it with npm run dev or npm start.');
        const nextLibrary = unwrap(await api.list());
        const nextDetail = screen.kind === 'detail' ? unwrap(await api.read(name)) : null;
        const nextCalendar = screen.kind === 'calendar' ? unwrap(await api.calendar()) : { events: [], warnings: [] };
        if (!cancelled) { setLibrary(nextLibrary); setDetail(nextDetail); setCalendar(nextCalendar); }
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load cadence data.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [screen.kind, name, refresh]);
  const openCadence = (name: string) => setScreen({ kind: 'detail', name });
  const title = screen.kind === 'cadences' ? 'Existing Cadences' : screen.kind === 'calendar' ? 'Calendar' : name;
  const warnings = [...library.warnings, ...(screen.kind === 'detail' ? detail?.warnings ?? [] : screen.kind === 'calendar' ? calendar.warnings : [])];

  const taskConsole = <>
    {!salesforceCadence && !cognismCadence && <OutlookConsole job={job} cadence={outlookCadence} onDismiss={() => setOutlookCadence(null)} />}
    {!outlookCadence && !salesforceCadence && <CognismConsole job={job} cadence={cognismCadence} onDismiss={() => setCognismCadence(null)} />}
    {(job?.tool === 'salesforce' || !job || salesforceCadence) && !cognismCadence && !outlookCadence && <JobConsole job={job?.tool !== 'salesforce' && job?.state !== 'running' ? null : job} cadence={salesforceCadence} onDismiss={() => setSalesforceCadence(null)} connectionError={connectionError} />}
  </>;
  if (screen.kind === 'salesforce') return <SalesforcePreview onClose={() => setScreen({ kind: 'menu' })} />;
  if (screen.kind === 'village') return <><Suspense fallback={<div className="village-loading">Opening the village…</div>}><Village /></Suspense><button className="return-to-desktop" onClick={() => setScreen({ kind: 'menu' })}>← Main menu</button><div className="desktop-app job-overlay">{taskConsole}</div></>;
  return <div className={`desktop-app ${screen.kind === 'menu' ? 'on-menu' : ''}`}>
    <div className="desktop-scenery" aria-hidden="true"><div className="dusk-moon" /><div className="dusk-ridge back" /><div className="dusk-ridge front" /><div className="dusk-water" /></div>
    <header className="desktop-header"><button className="desktop-brand" onClick={() => setScreen({ kind: 'menu' })} aria-label="Tachy-on main menu"><span className="brand-pixel" aria-hidden="true">T</span><span>TACHY-ON<small>YOUR LOCAL WORKSPACE</small></span></button><span className="local-indicator"><i />LOCAL DESKTOP</span></header>
    {screen.kind === 'menu' ? <main className="main-menu">
      <p className="menu-eyebrow">A LITTLE WORLD. A LITTLE MORE ORGANISED.</p>
      <h1 ref={heading} tabIndex={-1} className="menu-logo">TACHY<span>-ON</span><small>V I L L A G E</small></h1>
      <p className="menu-subtitle">Your next chapter starts here.</p>
      <nav className="menu-navigation" aria-label="Main menu">{menu.map((item, i) => <button className={`menu-button accent-${item.accent}`} key={item.label} onClick={() => {
        if ('screen' in item) setScreen({ kind: item.screen });
        else setNotice({ title: 'Coming Soon', message: `${item.label} will be available in a later phase. This menu does not launch any tools.` });
      }}><span className="menu-icon" aria-hidden="true">{item.icon}</span><span className="menu-button-label">{item.label}{!('screen' in item) && <small>Coming Soon</small>}</span><span className="menu-arrow" aria-hidden="true">{String(i + 1).padStart(2, '0')} ▸</span></button>)}</nav>
      <button className="explore-link" onClick={() => setScreen({ kind: 'village' })}>Explore village <span aria-hidden="true">↗</span></button>
      <p className="menu-footnote">A quiet place to plan what comes next.</p>
    </main> : <main className="workspace-screen">
      <div className="workspace-breadcrumb"><button onClick={() => setScreen({ kind: 'menu' })}>Main menu</button><span>/</span>{screen.kind === 'detail' ? <><button onClick={() => setScreen({ kind: 'cadences' })}>Existing Cadences</button><span>/</span><span>Cadence</span></> : <span>{title}</span>}</div>
      <div className="workspace-heading"><div><p className="workspace-eyebrow">{screen.kind === 'calendar' ? 'THE MONTH AHEAD' : screen.kind === 'detail' ? 'YOUR CADENCE AT A GLANCE' : 'PICK UP WHERE YOU LEFT OFF'}</p><h1 ref={heading} tabIndex={-1}>{title}</h1></div><div className="workspace-actions"><button className="small-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>↻ Refresh</button>{screen.kind === 'cadences' && <button className="retro-button primary" onClick={() => setCreating(true)}>+ Create New Cadence</button>}</div></div>
      {loading && <p className="loading-state" role="status">Reading your cadence folders…</p>}
      {error && <div className="error-state" role="alert"><h2>Couldn’t load this screen</h2><p>{error}</p><button className="small-button" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
      {!loading && !error && <>
        {warnings.length > 0 && <div className="data-warnings" role="status"><strong>Some data could not be loaded</strong><ul>{[...new Set(warnings)].map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
        {screen.kind === 'cadences' && (library.cadences.length ? <div className="cadence-cards">{library.cadences.map((cadence, i) => <button key={cadence.name} className="cadence-card" style={{ '--cadence-color': cadence.color } as React.CSSProperties} onClick={() => openCadence(cadence.name)}><span className="card-top"><span className="card-folder" aria-hidden="true">▤</span><small>CADENCE {String(i + 1).padStart(2, '0')}</small></span><strong>{cadence.name}</strong><span className="card-bottom">Open cadence <span aria-hidden="true">→</span></span></button>)}</div> : <div className="library-empty"><span className="empty-emblem" aria-hidden="true">▤</span><p className="workspace-eyebrow">ROOM FOR A NEW BEGINNING</p><h2>Your first cadence starts here.</h2><p>No cadences yet. Create one to organise your accounts,<br />contacts and outreach in one place.</p><button className="retro-button primary" onClick={() => setCreating(true)}>+ Create New Cadence</button></div>)}
        {screen.kind === 'detail' && detail && <CadenceDashboard key={detail.name} detail={detail} onChanged={() => { void window.villageDesktop?.cadences.read(detail.name).then(result => { if (result.ok) setDetail(result.data); else setError(result.error); }).catch(() => setError('Could not refresh cadence.')); }} onDeleted={() => setScreen({ kind: 'cadences' })} cadences={library.cadences} onOpen={openCadence} onDraftEmails={() => setOutlookCadence(detail.name)} onImportContacts={() => setCognismCadence(detail.name)} onAddAccounts={() => setSalesforceCadence(detail.name)} onNotice={(title, message) => setNotice({ title, message })} />}
        {screen.kind === 'calendar' && <><p className="screen-intro">One view of your cadences. Only recorded events appear here.</p><div className="cad-panel global-calendar"><Calendar events={calendar.events} cadences={library.cadences} /></div></>}
        <footer className="workspace-footer"><span><i />FILES STAY ON THIS DEVICE</span><details><summary>Cadence folder</summary><p>{library.path}</p></details></footer>
      </>}
    </main>}
    {creating && <CreateCadence onClose={() => setCreating(false)} onCreated={cadence => { setCreating(false); openCadence(cadence.name); }} />}
    {notice && <Modal title={notice.title} onClose={() => setNotice(null)}><p>{notice.message}</p><div className="modal-actions"><button autoFocus className="retro-button primary" onClick={() => setNotice(null)}>Got it</button></div></Modal>}
    {taskConsole}
  </div>;
}
