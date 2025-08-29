import React, { useEffect, useMemo, useState } from 'react'
import ArchiveProgress from './ArchieveProgress.jsx';

function genProgressId() {
  return (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
}

async function api(path, opts) {
  const r = await fetch(path, opts)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export default function App() {
  const [url, setUrl] = useState('https://example.com/')
  const [snapshots, setSnapshots] = useState([])
  const [host, setHost] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')
  const [maxPages, setMaxPages] = useState(10)
  const [error, setError] = useState('')
  const [progressId, setProgressId] = useState(null);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    setCompareA('');
    setCompareB('');
  }, [host, snapshots]);
  useEffect(() => {
    setSelected(snapshots.length ? snapshots[snapshots.length - 1] : null);
  }, [host, snapshots]);
  useEffect(() => {
    setIframeError(false); 
  }, [host, selected]);

  async function archiveNow() {
    setError('');
    if (maxPages < 1 || maxPages > 50) {
      setError('Max pages must be between 1 and 50.');
      return;
    }
    setLoading(true);
    const pid = genProgressId();
    setProgressId(pid);
    try {
      const r = await api('/api/archive', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ url, maxPages, progressId: pid }) 
      });
      setHost(r.host);
      await refresh();
      setSelected(r.ts);
    } catch (err) {
      setError(err.message || 'Failed to archive site.');
    } finally {
      setLoading(false);
      setTimeout(() => setProgressId(null), 2000); 
    }
  }

  function formatTimestamp(ts) {
  if (!/^\d{14}$/.test(ts)) return ts;
  return `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)} ${ts.slice(8,10)}:${ts.slice(10,12)}:${ts.slice(12,14)}`;
  }

  const base = useMemo(() => selected ? `/snapshots/${host}/${selected}/` : null, [host, selected]);

  async function refresh() {
    try {
      const { host: h, snapshots: s } = await api(`/api/archives?url=${encodeURIComponent(url)}`)
      setHost(h)
      setSnapshots(s.reverse())
      if (!selected && s.length) setSelected(s[s.length-1])
    } catch { setSnapshots([]) }
  }

  return (
    <div className="app-root">
      <header className="topbar">
        <span role="img" aria-label="archive" style={{fontSize: '2.2rem'}}>🗄️</span>
        <span style={{fontWeight: 700, marginLeft: 8}}>Website-Archival</span>
        <span style={{fontSize: '1rem', color: '#388e3c', fontWeight: 400, marginLeft: 16}}>
          Your personal web time machine
        </span>
      </header>
      <div className="dashboard-content">
        <aside className="sidebar">
          {error && (
            <div style={{
              color: '#c62828',
              background: '#fff3f3',
              borderRadius: 6,
              padding: 8,
              marginBottom: 12,
              fontWeight: 500,
              border: '1px solid #ffcdd2'
            }}>
              {error}
            </div>
          )}
          {progressId && <ArchiveProgress progressId={progressId} />}
          <div className="row">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{flex: 1}}
              placeholder="https://…"
            />
          </div>
          <div className="row">
            <button onClick={archiveNow} disabled={loading}>
              {loading ? 'Archiving…' : 'Archive now'}
            </button>
            <button onClick={refresh}>Refresh list</button>
          </div>
          <div className="row">
            <label>Max pages:</label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxPages}
              onChange={e => setMaxPages(+e.target.value)}
              style={{width: 90}}
            />
          </div>
          <h3>Snapshots</h3>
          {!snapshots.length && (
            <div className="muted">No snapshots yet. Create one!</div>
          )}
          <ul>
            {snapshots.map(ts => (
              <li key={ts}>
                <label>
                  <input
                    type="radio"
                    name="snapshot"
                    checked={selected === ts}
                    onChange={() => setSelected(ts)}
                  />{' '}
                    <span className="badge">{formatTimestamp(ts)}</span>
                </label>
              </li>
            ))}
          </ul>
          {snapshots.length >= 2 && (
            <div style={{marginTop: 12}}>
              <h3>Compare</h3>
              <div className="row">
                <select value={compareA} onChange={e => setCompareA(e.target.value)}>
                  <option value="">Choose A</option>
                  {snapshots.map(ts => (
                    <option key={'A' + ts} value={ts}>{ts}</option>
                  ))}
                </select>
              </div>
              <div className="row">
                <select value={compareB} onChange={e => setCompareB(e.target.value)}>
                  <option value="">Choose B</option>
                  {snapshots.map(ts => (
                    <option key={'B' + ts} value={ts}>{ts}</option>
                  ))}
                </select>
              </div>
              {compareA && compareB && (
                <DiffView host={host} a={compareA} b={compareB} />
              )}
            </div>
          )}
        </aside>
        <main className="main">
        <h3>Snapshot Viewer</h3>
        {base ? (
          iframeError ? (
            <div className="muted" style={{color: '#c62828', background: '#fff3f3', border: '1px solid #ffcdd2', borderRadius: 6, padding: 16}}>
              Snapshot not found.<br />
              (The file <code>index.html</code> does not exist for this snapshot.)
            </div>
          ) : (
            <iframe
              src={`/snapshots/${host}/${selected}/index.html`}
              title="snapshot"
              style={{
                width: '100%',
                minHeight: 600,
                border: 'none',
                borderRadius: 8
              }}
              onLoad={e => {
                try {
                  const doc = e.target.contentDocument || e.target.contentWindow.document;
                  if (doc && doc.getElementById('SNAPSHOT_NOT_FOUND')) {
                    setIframeError(true);
                  } else {
                    setIframeError(false);
                  }
                } catch {
                  // Cross-origin, ignore
                }
              }}
              onError={() => setIframeError(true)}
            />
          )
        ) : (
          <div className="muted">Select a snapshot to view.</div>
        )}
      </main>
      </div>
    </div>
  )
}

// Dummy DiffView for completeness; replace with your actual implementation
function DiffView({ host, a, b }) {
  const [pathRel, setPathRel] = useState('index.html');
  useEffect(() => {
    setPathRel('index.html');
  }, [host, a, b]);

  return (
    <div style={{marginTop:12}}>
      <div className="row" style={{marginBottom: 8}}>
        <input value={pathRel} onChange={e=>setPathRel(e.target.value)} placeholder="index.html or about/index.html" style={{flex:1}} />
      </div>
      <div style={{display:'flex', gap:12}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,marginBottom:4}}>A: {a}</div>
          <iframe
            src={`/snapshots/${host}/${a}/${pathRel}`}
            style={{width:'100%', minHeight:400, border:'1px solid #ccc', borderRadius:6, background:'#fff'}}
            title={`A-${a}`}
          />
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,marginBottom:4}}>B: {b}</div>
          <iframe
            src={`/snapshots/${host}/${b}/${pathRel}`}
            style={{width:'100%', minHeight:400, border:'1px solid #ccc', borderRadius:6, background:'#fff'}}
            title={`B-${b}`}
          />
        </div>
      </div>
    </div>
  );
}