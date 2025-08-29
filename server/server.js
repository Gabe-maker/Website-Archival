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
import { crawlWithPuppeteer } from './crawler-puppet.js';
import logger from './logger.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(serverTiming());

const DATA = path.join(__dirname, '..', 'data');
const SNAPROOT = path.join(DATA, 'snapshots');


const progressClients = new Map();




app.get('/api/progress/:id', (req, res) => {
  const { id } = req.params;
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  progressClients.set(id, res);

  req.on('close', () => {
    progressClients.delete(id);
  });
});

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
    logger.error('Failed to archive', { error: e, url });
    res.status(500).json({ error: e.message });
}
});

app.get('/api/manifest', async (req, res) => {
res.json(await getManifest());
});

app.post('/api/archive', async (req, res) => {
  const { url, maxPages = 10, usePuppeteer = true, progressId } = req.body || {};
  logger.info(`Received archive request for url=${url} maxPages=${maxPages} usePuppeteer=${usePuppeteer}`);
  if (!url) {
    logger.warn('No URL provided to /api/archive');
    return res.status(400).json({ error: 'url is required' });
  }
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14);
  const { dir, host } = await createSnapshotRoot(url, ts);
  const tsBasePrefix = `/snapshots/${host}/${ts}/`;

   let pages = await crawlWithPuppeteer(url, {
    outDir: dir,
    maxPages,
    onProgress: info => {
        if (progressId && progressClients.has(progressId)) {
        progressClients.get(progressId).write(
            `data: ${JSON.stringify(info)}\n\n`
        );
        }
    }
    });
    let pageCount = 0;
    try {
    if (!/localhost|127\.0\.0\.1/.test(url)) {
        logger.info('Starting Puppeteer crawl...');
        try {
        pages = await crawlWithPuppeteer(url, { outDir: dir, maxPages, concurrency: 1, onProgress });
        } catch (e) {
        logger.warn('Puppeteer crawl failed, falling back to same-origin.', { error: e });
        logger.info('Starting same-origin crawl...');
        pages = await crawlSameOrigin(url, { maxPages });
        }
    } else {
        logger.info('Starting same-origin crawl...');
        pages = await crawlSameOrigin(url, { maxPages });
    }
    logger.info(`Crawl complete. Pages found: ${pages.length}`);
    } catch (e) {
    logger.error('Crawler failed', { error: e });
    return res.status(500).json({ error: e.message });
    }

  const total = pages.length;

  // Save assets & rewrite HTML locally
for (const p of pages) {
  logger.debug(`Saving: ${p.url} -> ${normalizePathForDisk(p.url)}`);
  const rel = normalizePathForDisk(p.url);
  const outPath = path.join(dir, rel);
  await fs.ensureDir(path.dirname(outPath));
  if (/text\/html/i.test(p.contentType)) {
    const html = p.body.toString('utf8');
    const rewritten = rewriteHtmlToLocal(html, p.url, tsBasePrefix);
    await fs.writeFile(outPath, rewritten);
    logger.info(`Saved HTML: ${outPath}`);
  } else {
    await fs.writeFile(outPath, p.body);
    logger.info(`Saved asset: ${outPath}`);
  }
  pageCount++;
  if (progressId && progressClients.has(progressId)) {
    progressClients.get(progressId).write(
      `data: ${JSON.stringify({ phase: 'save', pageCount, total, url: p.url })}\n\n`
    );
  }
}
if (pages.length > 0) {
  // The first page is the main page requested by the user
  const mainPageUrl = pages[0].url;
  const mainRel = normalizePathForDisk(mainPageUrl);
  const mainPath = path.join(dir, mainRel);

  // Always copy to _/index.html if not already there
  const underscoreIndex = path.join(dir, '_', 'index.html');
  if (mainPath !== underscoreIndex && await fs.pathExists(mainPath)) {
    await fs.ensureDir(path.dirname(underscoreIndex));
    await fs.copyFile(mainPath, underscoreIndex);
    logger.info(`Copied main page to: ${underscoreIndex}`);
  }

  // Always copy to index.html at the root
  const rootIndex = path.join(dir, 'index.html');
  if (await fs.pathExists(mainPath)) {
    await fs.copyFile(mainPath, rootIndex);
    logger.info(`Copied main page to snapshot root: ${rootIndex}`);
  }
}
const mainIndex = path.join(dir, '_', 'index.html');
const rootIndex = path.join(dir, 'index.html');
if (await fs.pathExists(mainIndex)) {
  await fs.copyFile(mainIndex, rootIndex);
  logger.info(`Copied main index to snapshot root: ${rootIndex}`);
}

  await recordCapture(url, ts);
  logger.info(`Archive complete for ${url} at ts=${ts}`);
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
app.listen(PORT, () => logger.info(`Wayback-Lite server running http://localhost:${PORT}`));