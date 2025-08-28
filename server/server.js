import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import serverTiming from 'server-timing';
import { __dirname, toHost, normalizePathForDisk } from './utils.js';
import { crawlSameOrigin } from './crawler.js';
import { rewriteHtmlToLocal } from './rewrite.js';
import { createSnapshotRoot, saveAsset, listSnapshotsByUrl, recordCapture, getManifest } from './snapshot.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(serverTiming());

const DATA = path.join(__dirname, '..', 'data');
const SNAPROOT = path.join(DATA, 'snapshots');

app.get('/snapshots/:host/:ts/index.html', (req, res, next) => {
  const { host, ts } = req.params;
  const filePath = path.join(SNAPROOT, host, ts, '_', 'index.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    next();
  }
});

app.use('/snapshots', express.static(SNAPROOT, { fallthrough: true }));

// Health Checks
app.get('/api/health', (req, res) => res.json({ ok: true }));


app.get('/api/archives', async (req, res) => {
try {
const { url } = req.query;
if (!url) return res.status(400).json({ error: 'url is required' });
const list = await listSnapshotsByUrl(url);
res.json({ host: toHost(url), snapshots: list });
} catch (e) {
res.status(500).json({ error: e.message });
}
});

app.get('/api/manifest', async (req, res) => {
res.json(await getManifest());
});

app.post('/api/archive', async (req, res) => {
const { url, maxPages = 100 } = req.body || {};
if (!url) return res.status(400).json({ error: 'url is required' });
const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14); // YYYYMMDDHHmmss
const { dir, host } = await createSnapshotRoot(url, ts);
const tsBasePrefix = `/snapshots/${host}/${ts}/`;


const pages = await crawlSameOrigin(url, { maxPages });


// Save assets & rewrite HTML locally
for (const p of pages) {
const rel = normalizePathForDisk(p.url);
const outPath = path.join(dir, rel);
await fs.ensureDir(path.dirname(outPath));


if (/text\/html/i.test(p.contentType)) {
const html = p.body.toString('utf8');
const rewritten = rewriteHtmlToLocal(html, p.url, tsBasePrefix);
await fs.writeFile(outPath, rewritten);
} else {
await fs.writeFile(outPath, p.body);
}
}


await recordCapture(url, ts);
res.json({ host, ts, base: tsBasePrefix, count: pages.length });
});

// Simple raw HTML fetch for diffing convenience
app.get('/api/raw', async (req, res) => {
const { host, ts, path: rel } = req.query;
if (!host || !ts || !rel) return res.status(400).json({ error: 'host, ts, path required' });
const file = path.join(SNAPROOT, host, ts, rel);
if (!await fs.pathExists(file)) return res.status(404).send('Not found');
const txt = await fs.readFile(file, 'utf8');
res.type('text/html').send(txt);
});


// Root helper to serve an index for a snapshot (redirects to homepage)
app.get('/view/:host/:ts', async (req, res) => {
const { host, ts } = req.params;
const indexPath = path.join(SNAPROOT, host, ts, 'index.html');
if (await fs.pathExists(indexPath)) return res.sendFile(indexPath);
res.status(404).send('Snapshot index not found');
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Wayback-Lite server running http://localhost:${PORT}`));