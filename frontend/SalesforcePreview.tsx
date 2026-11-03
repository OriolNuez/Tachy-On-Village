import { useEffect, useState } from 'react';

export function SalesforcePreview({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState('Opening isolated Salesforce preview…');
  const [fallback, setFallback] = useState('');
  useEffect(() => {
    const api = window.villageDesktop?.salesforcePreview;
    if (!api) return;
    let active = true;
    const update = () => { void api.status().then(value => { if (active) setStatus(value); }).catch(() => { if (active) setStatus('Preview connection failed.'); }); };
    void api.open().then(update).catch(() => { if (active) setStatus('Could not open the preview.'); });
    const timer = setInterval(update, 1000);
    return () => { active = false; clearInterval(timer); void api.close().catch(() => {}); };
  }, []);
  return <div className="desktop-app" style={{ height: 180, padding: '12px 20px', overflow: 'auto' }}>
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <button className="small-button" onClick={onClose}>← Main menu</button>
      <h1 style={{ fontSize: 20, margin: 0 }}>Salesforce · Viewing prototype</h1>
      <button className="retro-button primary" onClick={() => { void window.villageDesktop?.salesforcePreview.openChrome().then(setFallback).catch(() => setFallback('Could not open Chrome.')); }}>Open in Chrome ↗</button>
    </div>
    <p style={{ margin: '8px 0', fontSize: 13 }}>Temporary session · No export automation · Passkey / Touch ID login is not configured here. Use Chrome or IBM’s alternative sign-in option.</p>
    <p role="status" style={{ margin: '4px 0', fontSize: 13 }}>{status}</p>
    {fallback && <p role="status" style={{ margin: 0, fontSize: 13 }}>{fallback}</p>}
  </div>;
}
