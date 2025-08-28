import React, { useEffect, useMemo, useState } from 'react'

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
  const [maxPages, setMaxPages] = useState(40)

  const base = useMemo(() => selected ? `/snapshots/${host}/${selected}/` : null, [host, selected])
  console.log('base', base);

  async function refresh() {
    try {
      const { host: h, snapshots: s } = await api(`/api/archives?url=${encodeURIComponent(url)}`)
      setHost(h)
      setSnapshots(s.reverse())
      if (!selected && s.length) setSelected(s[s.length-1])
    } catch { setSnapshots([]) }
  }


    async function archiveNow() {
    setLoading(true)
    try {
        const r = await api('/api/archive', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ url, maxPages }) 
        })
        setHost(r.host)
        await refresh()  // <-- call refresh after archiving
        setSelected(r.ts)
    } finally { setLoading(false) }
    }

// Optional: manual refresh button
<button onClick={refresh}>Refresh list</button>


  return (
    <div className="wrap">
      <aside className="sidebar">
        <h2>Wayback-Lite</h2>
        <div className="row">
          <input value={url} onChange={e=>setUrl(e.target.value)} style={{flex:1}} placeholder="https://…" />
        </div>
        <div className="row" style={{marginTop:8}}>
          <button onClick={archiveNow} disabled={loading}>{loading ? 'Archiving…' : 'Archive now'}</button>
          <button onClick={refresh}>Refresh list</button>
        </div>
        <div style={{marginTop:8}}>
          <label>Max pages: </label>
          <input type="number" min={1} max={500} value={maxPages} onChange={e=>setMaxPages(+e.target.value)} style={{width:90}} />
        </div>

        <h3 style={{marginTop:16}}>Snapshots</h3>
        {!snapshots.length && <div className="muted">No snapshots yet. Create one!</div>}
        <ul>
          {snapshots.map(ts => (
            <li key={ts}>
              <label>
                <input type="radio" name="snapshot" checked={selected===ts} onChange={()=>setSelected(ts)} />{' '}
                <span className="badge">{ts.slice(0,8)} {ts.slice(8,12)}</span>{' '}
                <span className="muted">{ts}</span>
              </label>
            </li>
          ))}
        </ul>

        {snapshots.length >= 2 && (
          <div style={{marginTop:12}}>
            <h3>Compare</h3>
            <div>
              <select value={compareA} onChange={e=>setCompareA(e.target.value)}>
                <option value="">Choose A</option>
                {snapshots.map(ts => <option key={'A'+ts} value={ts}>{ts}</option>)}
              </select>
            </div>
            <div style={{marginTop:6}}>
              <select value={compareB} onChange={e=>setCompareB(e.target.value)}>
                <option value="">Choose B</option>
                {snapshots.map(ts => <option key={'B'+ts} value={ts}>{ts}</option>)}
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
          <iframe src={`/snapshots/${host}/${selected}/index.html`} title="snapshot" />
        ) : (
          <div className="muted">Select a snapshot to view.</div>
        )}
      </main>
    </div>
  )
}

function DiffView({ host, a, b }) {
  const [pathRel, setPathRel] = useState('index.html')
  const [diffHtml, setDiffHtml] = useState('')

  async function loadDiff() {
    const [ha, hb] = await Promise.all([
      fetch(`/api/raw?host=${host}&ts=${a}&path=${encodeURIComponent(pathRel)}`),
      fetch(`/api/raw?host=${host}&ts=${b}&path=${encodeURIComponent(pathRel)}`)
    ])
    const [ta, tb] = await Promise.all([ha.text(), hb.text()])
    setDiffHtml(renderSideBySide(ta, tb))
  }

  useEffect(() => { loadDiff() }, [host, a, b, pathRel])

  return (
    <div style={{marginTop:12}}>
      <div className="row">
        <input value={pathRel} onChange={e=>setPathRel(e.target.value)} placeholder="index.html or about/index.html" style={{flex:1}} />
        <button onClick={loadDiff}>Reload diff</button>
      </div>
      <div dangerouslySetInnerHTML={{__html: diffHtml}} />
    </div>
  )
}

// minimalistic diff (line-by-line)
function renderSideBySide(a, b) {
  const aa = a.split(/\r?\n/)
  const bb = b.split(/\r?\n/)
  const max = Math.max(aa.length, bb.length)
  let rows = ''
  for (let i=0;i<max;i++) {
    const l = (aa[i]||'').replace(/</g,'&lt;')
    const r = (bb[i]||'').replace(/</g,'&lt;')
    const changed = (aa[i]||'') !== (bb[i]||'')
    rows += `<tr><td style="vertical-align:top;${changed?'background:#ffecec;':''}"><pre>${l}</pre></td><td style="vertical-align:top;${changed?'background:#ecffec;':''}"><pre>${r}</pre></td></tr>`
  }
  return `<table style="width:100%;table-layout:fixed;border-collapse:collapse"><colgroup><col width="50%"/><col width="50%"/></colgroup>${rows}</table>`
}
