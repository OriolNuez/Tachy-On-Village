import { useCallback, useEffect, useRef, useState } from 'react';
import { VillageScene } from './world/VillageScene';
import { landmarks, type LocationId } from './world/model';
import { Icon } from './components/Icon';

type Hover = { name: string; subtitle: string; x: number; y: number } | null;

export function App() {
  const worldHost = useRef<HTMLDivElement>(null);
  const scene = useRef<VillageScene | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('A little village. All yours to explore.');
  const [location, setLocation] = useState<LocationId | null>(null);
  const [directory, setDirectory] = useState(false);
  const [help, setHelp] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [follow, setFollow] = useState(false);
  const [hover, setHover] = useState<Hover>(null);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const openLocation = useCallback((id: LocationId) => {
    previousFocus.current = document.activeElement as HTMLElement;
    scene.current?.cancel(); scene.current?.setPaused(true);
    setLocation(id); setDirectory(false); setHelp(false);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    let current: VillageScene | null = null;
    void VillageScene.create(worldHost.current!, {
      location: openLocation, status: setStatus, hover: setHover,
      camera: (percent, following) => { setZoom(percent); setFollow(following); },
    }, abort.signal).then(value => {
      if (abort.signal.aborted) { value?.destroy(); return; }
      current = value; scene.current = value; value?.setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches); setReady(true);
    }).catch(reason => { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'The scene could not start.'); });
    return () => { abort.abort(); current?.destroy(); scene.current = null; };
  }, [openLocation]);

  useEffect(() => { scene.current?.setReducedMotion(reduced); }, [reduced, ready]);
  useEffect(() => {
    if (location && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [location]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setDirectory(false); setHelp(false); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);

  function closeLocation() {
    dialog.current?.close(); setLocation(null); scene.current?.setPaused(false);
    if (previousFocus.current?.isConnected && previousFocus.current.closest('[inert]') === null) previousFocus.current.focus();
    else worldHost.current?.focus();
  }
  function visit(id: LocationId) {
    setDirectory(false); scene.current?.visit(id); worldHost.current?.focus();
  }
  const current = landmarks.find(b => b.id === location);

  return <main className={`village-app ${reduced ? 'reduced-motion' : ''}`}>
    <div ref={worldHost} className="world" tabIndex={0} role="application" aria-label="Explorable village map" aria-describedby="world-instructions" />
    <div className="edge-haze" aria-hidden="true" />
    <header className="topbar">
      <div className="brand">
        <div className="brand-symbol" aria-hidden="true"><Icon name="shrine" size={30} /></div>
        <div><p className="eyebrow">A LITTLE WORLD OF YOUR OWN</p><h1>Tachy-on <span>Village</span><span className="brand-dot">.</span></h1></div>
      </div>
      <div className="topbar-right">
        <div className="weather"><Icon name="sun" size={24} /><span>Golden hour<small>A gentle sea breeze</small></span></div>
        <span className="topbar-divider" />
        <button className="icon-button motion-toggle" aria-label="Reduce motion" aria-pressed={reduced} onClick={() => setReduced(!reduced)} title="Reduce motion"><Icon name="leaf" /></button>
        <button className="directory-toggle" aria-expanded={directory} aria-controls="village-directory" onClick={() => { setDirectory(!directory); setHelp(false); }}><Icon name="map" size={18} /><span>Village guide</span></button>
      </div>
    </header>

    <div className="chapter-note"><span className="small-diamond" />THE COASTAL VILLAGE<span className="chapter-line" /><span>01</span></div>
    <div className="compass" aria-hidden="true"><span>N</span><svg width="40" height="52" viewBox="0 0 40 52"><path d="m20 5 7 20-7-4-7 4Z" fill="#f4e6ba" /><path d="m20 45 7-20-7 4-7-4Z" fill="#426b79" opacity=".45" /><circle cx="20" cy="25" r="2" fill="#f4e6ba" /></svg></div>

    {!ready && !error && <div className="loading-card" role="status"><div className="loading-sun"><Icon name="sun" size={32} /></div><h2>A place to slow down.</h2><p>Opening the village gates…</p></div>}
    {error && <div className="loading-card error-card" role="alert"><h2>The village couldn’t be drawn.</h2><p>The village guide is still available. Restart the app to try the scene again.</p><details><summary>Rendering details</summary><p>{error}</p></details><button className="primary-button" onClick={() => setDirectory(true)}>Open village guide</button></div>}

    {directory && <aside className="village-directory" id="village-directory" aria-label="Village guide">
      <div className="panel-heading"><div><p className="eyebrow">SIX PLACES. ONE LITTLE ISLAND.</p><h2>Find your corner.</h2></div><button className="icon-button" aria-label="Close village guide" onClick={() => setDirectory(false)}><Icon name="close" size={18} /></button></div>
      <p className="directory-intro">Take the long way round, or step right in.</p>
      <div className="place-list">{landmarks.map((b, i) => <div className="place-row" key={b.id}>
        <span className={`place-icon ${b.id}`}><Icon name={b.id} size={24} /></span>
        <div className="place-copy"><span className="place-number">0{i + 1}</span><h3>{b.name}</h3><p>{b.subtitle}</p></div>
        <div className="place-actions"><button disabled={!ready} onClick={() => visit(b.id)} aria-label={`Walk to ${b.name}`} title="Walk to entrance"><Icon name="walk" size={18} /></button><button onClick={() => openLocation(b.id)} aria-label={`Open ${b.name}`}>Open</button></div>
      </div>)}</div>
      <div className="directory-footer"><Icon name="leaf" size={15} />There’s no hurry here.</div>
    </aside>}

    {hover && !directory && !location && <div className="world-tooltip" style={{ left: Math.min(window.innerWidth - 220, hover.x + 20), top: Math.max(110, hover.y - 60) }}><strong>{hover.name}</strong><span>{hover.subtitle}<Icon name="arrow" size={13} /></span></div>}

    <div className="bottom-left"><div className="explorer-card"><div className="portrait" aria-hidden="true"><i className="pixel-hair" /><i className="pixel-face" /><i className="pixel-eyes" /><i className="pixel-shirt" /></div><div><span className="eyebrow">YOUR EXPLORER</span><strong>A new arrival</strong><span className="explorer-place"><span />Village wanderer</span></div></div><p className="prototype-label">COASTAL EDITION <span>·</span> MILESTONE 01</p></div>
    <footer className="bottom-center"><p className="village-status" role="status" aria-live="polite">{status}</p><p className="control-hint" id="world-instructions"><span className="mouse-icon" />Click to wander<span>·</span>Scroll to zoom<span>·</span><kbd>Space</kbd> + drag to look around<button className="help-toggle" aria-expanded={help} aria-label="Show all controls" onClick={() => setHelp(!help)}>?</button></p></footer>
    <nav className="camera-controls" aria-label="Camera controls">
      <button aria-label="Zoom out" onClick={() => scene.current?.zoom(1 / 1.2)} disabled={!ready}><Icon name="minus" size={18} /></button>
      <output aria-label="Zoom level">{zoom}%</output>
      <button aria-label="Zoom in" onClick={() => scene.current?.zoom(1.2)} disabled={!ready}><Icon name="plus" size={18} /></button>
      <span className="control-divider" />
      <button aria-label="Follow explorer" aria-pressed={follow} title="Follow explorer" onClick={() => scene.current?.follow()} disabled={!ready}><Icon name="walk" size={19} /></button>
      <button className="overview-button" aria-label="Return to village overview" title="Return to village overview (Home)" onClick={() => scene.current?.overview()} disabled={!ready}><Icon name="compass" size={19} /></button>
    </nav>
    {help && <aside className="help-panel" aria-label="Village controls"><div className="panel-heading"><h2>A few little pointers</h2><button className="icon-button" onClick={() => setHelp(false)} aria-label="Close controls"><Icon name="close" size={16} /></button></div><dl><dt>Walk / visit a building</dt><dd>Left click</dd><dt>Look around</dt><dd>Space + drag / middle drag</dd><dt>Pan with keyboard</dt><dd>Arrow keys on the map</dd><dt>Zoom</dt><dd>Scroll / + / −</dd><dt>Island overview</dt><dd>Home</dd><dt>Close a panel / stop walking</dt><dd>Escape</dd></dl><p>The Village guide also opens every place with your keyboard.</p></aside>}

    <dialog ref={dialog} className={`location-dialog ${location ?? ''}`} onCancel={event => { event.preventDefault(); closeLocation(); }} onClick={event => { if (event.target === dialog.current) { const r = dialog.current.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeLocation(); } }} aria-labelledby="location-title" aria-describedby="location-description">
      {current && <><div className="location-art"><div className="location-art-sun" /><div className="location-art-hill" /><div className="location-art-hill second" /><div className="location-art-icon"><Icon name={current.id} size={68} /></div><span className="location-art-caption">A PLACE IN TACHY-ON VILLAGE</span><button className="icon-button dialog-close" onClick={closeLocation} aria-label="Close location"><Icon name="close" /></button></div><div className="location-body"><p className="eyebrow">{current.subtitle}</p><h2 id="location-title">{current.name}</h2><p id="location-description">{current.description}</p>{location === 'shrine' && <label className="motion-setting"><span><Icon name="leaf" size={20} />Let the village be still<small>Reduce ambient motion and camera easing</small></span><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} /></label>}<div className="future-note"><span className="small-diamond" /><p>{current.future}<span>For now, enjoy exploring the village.</span></p></div><button className="primary-button" onClick={closeLocation}>Back to the village<Icon name="arrow" size={18} /></button></div></>}
    </dialog>
  </main>;
}
