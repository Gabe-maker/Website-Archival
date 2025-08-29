import { useEffect, useState } from 'react';

export default function ArchiveProgress({ progressId }) {
  const [progress, setProgress] = useState({ pageCount: 0, total: 0, url: '', phase: 'crawl' });

  useEffect(() => {
    if (!progressId) return;
    const es = new EventSource(`/api/progress/${progressId}`);
    es.onmessage = (e) => {
      setProgress(JSON.parse(e.data));
    };
    return () => es.close();
  }, [progressId]);

  if (!progressId) return null;

  // Calculate percent (avoid divide by zero)
  const percent = progress.total ? Math.round((progress.pageCount / progress.total) * 100) : 0;

  return (
    <div style={{
    height: 18,
    background: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
    boxShadow: '0 2px 8px rgba(76,175,80,0.08)'
    }}>
    <div style={{
        width: `${percent}%`,
        background: 'linear-gradient(90deg, #4caf50 60%, #00bcd4 100%)',
        height: '100%',
        transition: 'width 0.3s'
    }} />
    </div>
  );
}