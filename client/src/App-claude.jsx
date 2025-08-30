import React, { useEffect, useMemo, useState } from 'react'
import { Archive, Clock, Globe, Zap, RefreshCw, Eye, GitCompare, AlertCircle, Loader } from 'lucide-react'

function genProgressId() {
  return (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
}

async function api(path, opts) {
  const r = await fetch(path, opts)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// Mock progress component for demo
function ArchiveProgress({ progressId }) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => p >= 100 ? 0 : p + 10);
    }, 200);
    return () => clearInterval(interval);
  }, [progressId]);

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
      <div className="flex items-center gap-2 mb-2">
        <Loader className="w-4 h-4 animate-spin text-blue-600" />
        <span className="text-sm font-medium text-gray-700">Archiving in progress...</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-xs text-gray-600 mt-1">{progress}% complete</div>
    </div>
  );
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

  // Sync host with URL input
  useEffect(() => {
    try {
      const u = new URL(url);
      setHost(u.host);
    } catch {
      setHost('');
    }
  }, [url]);


  useEffect(() => {
    setCompareA('');
    setCompareB('');
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
      const res = await api('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, maxPages, progressId: pid })
      });
      // After archiving, refresh snapshots
      await refresh();
      setSelected(res.ts);
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
        const { host: h, snapshots: s } = await api(`/api/archives?url=${encodeURIComponent(url)}`);
        setHost(h);
        setSnapshots((s || []).reverse());
        setSelected(s && s.length ? s[s.length - 1] : null);
    } catch {
        setSnapshots([]);
        setSelected(null);
    }
    }
    async function refresh() {
  try {
    const { host: h, snapshots: s } = await api(`/api/archives?url=${encodeURIComponent(url)}`);
    setHost(h);
    setSnapshots((s || []).reverse());
    setSelected(s && s.length ? s[s.length - 1] : null);
  } catch {
    setSnapshots([]);
    setSelected(null);
  }
}

    // Fetch snapshots for the current URL (not just host)
    useEffect(() => {
    refresh();
    }, [url]);

  function handleUrlChange(e) {
    setUrl(e.target.value);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Archive className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Website Archival
              </h1>
              <p className="text-sm text-gray-600">Your personal web time machine</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-red-800 text-sm font-medium">{error}</div>
            </div>
          )}

          {/* Progress */}
          {progressId && <ArchiveProgress progressId={progressId} />}

          {/* Archive Controls */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Archive Website
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Website URL</label>
                <input
                  value={url}
                  onChange={handleUrlChange}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Pages</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxPages}
                  onChange={e => setMaxPages(+e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/50"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={archiveNow} 
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {loading ? 'Archiving…' : 'Archive Now'}
                </button>
                <button 
                  onClick={refresh}
                  className="px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Snapshots List */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-500" />
              Snapshots ({snapshots.length})
            </h3>
            
            {!snapshots.length ? (
              <div className="text-gray-500 text-center py-8">
                <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No snapshots yet</p>
                <p className="text-sm">Create your first archive!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {snapshots.map(ts => (
                  <label key={ts} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50/70 transition-all cursor-pointer">
                    <input
                      type="radio"
                      name="snapshot"
                      checked={selected === ts}
                      onChange={() => setSelected(ts)}
                      className="text-blue-500 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">{formatTimestamp(ts)}</div>
                      <div className="text-xs text-gray-500">{ts}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Compare Section */}
          {snapshots.length >= 2 && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-purple-500" />
                Compare Snapshots
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Snapshot A</label>
                  <select 
                    value={compareA} 
                    onChange={e => setCompareA(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/50"
                  >
                    <option value="">Choose first snapshot</option>
                    {snapshots.map(ts => (
                      <option key={'A' + ts} value={ts}>{formatTimestamp(ts)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Snapshot B</label>
                  <select 
                    value={compareB} 
                    onChange={e => setCompareB(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/50"
                  >
                    <option value="">Choose second snapshot</option>
                    {snapshots.map(ts => (
                      <option key={'B' + ts} value={ts}>{formatTimestamp(ts)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200/50">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-500" />
                Snapshot Viewer
                {selected && (
                  <span className="ml-auto text-sm font-mono bg-gray-100 px-3 py-1 rounded-lg text-gray-600">
                    {formatTimestamp(selected)}
                  </span>
                )}
              </h3>
            </div>
            
            <div className="p-6">
                {!selected ? (
                <div className="text-center py-16">
                    <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-600 mb-2">No Snapshot Selected</h4>
                    <p className="text-gray-500">Choose a snapshot from the sidebar to view it here</p>
                </div>
                ) : iframeError ? (
                <div className="bg-red-50 border-2 border-dashed border-red-200 rounded-xl p-8 text-center flex flex-col items-center">
                    <img
                    src="client/src/59520.jpg"
                    alt="404 Not Found"
                    className="w-40 h-40 mx-auto mb-4"
                    onError={e => { e.target.style.display = 'none'; }}
                    />
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <h4 className="text-lg font-medium text-red-800 mb-2">404 Snapshot Not Found</h4>
                    <p className="text-red-600 mb-2">
                    The <code className="bg-red-100 px-2 py-1 rounded">index.html</code> file does not exist for this snapshot.<br />
                    (It may have been deleted or never archived.)
                    </p>
                    <p className="text-gray-500 text-sm">Try selecting a different snapshot or archiving again.</p>
                </div>
                ) : (
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-inner">
                    <iframe
                    src={`/snapshots/${host}/${selected}/index.html`}
                    title="snapshot"
                    className="w-full h-96 lg:h-[600px] border-none"
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
                </div>
                )}
            </div>
          </div>

          {/* Comparison View */}
          {compareA && compareB && (
            <div className="mt-8 bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
                <DiffView host={host} a={compareA} b={compareB} />
            </div>
            )}
        </div>
      </div>
    </div>
  )
}

// Enhanced DiffView component
function DiffView({ host, a, b }) {
  const [pathRel, setPathRel] = useState('index.html');
  
  useEffect(() => {
    setPathRel('index.html');
  }, [host, a, b]);

  function formatTimestamp(ts) {
    if (!/^\d{14}$/.test(ts)) return ts;
    return `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)} ${ts.slice(8,10)}:${ts.slice(10,12)}:${ts.slice(12,14)}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-purple-500" />
          Snapshot Comparison
        </h4>
        <input 
          value={pathRel} 
          onChange={e => setPathRel(e.target.value)} 
          placeholder="index.html or about/index.html" 
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/50 text-sm"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="font-semibold text-gray-700">Snapshot A</h5>
            <span className="text-sm font-mono bg-blue-100 text-blue-800 px-3 py-1 rounded-lg">
              {formatTimestamp(a)}
            </span>
          </div>
          <div className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-inner">
            <iframe
              src={`/snapshots/${host}/${a}/${pathRel}`}
              className="w-full h-80 border-none"
              title={`A-${a}`}
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="font-semibold text-gray-700">Snapshot B</h5>
            <span className="text-sm font-mono bg-purple-100 text-purple-800 px-3 py-1 rounded-lg">
              {formatTimestamp(b)}
            </span>
          </div>
          <div className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-inner">
            <iframe
              src={`/snapshots/${host}/${b}/${pathRel}`}
              className="w-full h-80 border-none"
              title={`B-${b}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}