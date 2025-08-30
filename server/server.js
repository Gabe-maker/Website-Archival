import express from 'express';
import path from 'path';
import fs from 'fs-extra';
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
await fs.ensureDir(DATA);
const manifestPath = path.join(DATA, 'manifest.json');
if (!await fs.pathExists(manifestPath)) {
  await fs.writeFile(manifestPath, '{}', 'utf8');
}

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


app.use('/snapshots', express.static(SNAPROOT, { fallthrough: true }));

// Custom 404 for snapshots
app.use('/snapshots', (req, res) => {
  res.status(404).send(`
    <html>
      <body style="background:#fef2f2;">
        <div id="SNAPSHOT_NOT_FOUND" style="text-align:center;margin-top:10vh;">
          <h1 style="color:#b91c1c;">404 Snapshot Not Found</h1>
          <p>The requested snapshot does not exist.</p>
        </div>
      </body>
    </html>
  `);
});

// Health Checks
app.get('/api/health', (req, res) => res.json({ ok: true }));

// List snapshots for a URL
app.get('/api/archives', async (req, res) => {
try {
const { url } = req.query;
if (!url) return res.status(400).json({ error: 'url is required' });
    const list = await listSnapshotsByUrl(url);
    logger.debug('List snapshots', { url, list });
    res.json({ host: toHost(url), snapshots: list });
} catch (e) {
    logger.error('Failed to archive', { error: e, url });
    res.status(500).json({ error: e.message });
}
});

// Get manifest
app.get('/api/manifest', async (req, res) => {
res.json(await getManifest());
});

// Archieves a URL and saves pages locally to data/snapshots/<host>/<timestamp>/
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

  let pages;
  let pageCount = 0;
  try {
    logger.info('Trying same-origin crawl...');
    try {
      pages = await crawlSameOrigin(url, { maxPages });
    } catch (e) {
      logger.warn('Same-origin crawl failed, falling back to Puppeteer.', e);
      logger.info('Trying Puppeteer crawl...');
      pages = await crawlWithPuppeteer(url, {
        outDir: dir,
        maxPages,
        concurrency: 1,
        onProgress: info => {
          if (progressId && progressClients.has(progressId)) {
            progressClients.get(progressId).write(
              `data: ${JSON.stringify(info)}\n\n`
            );
          }
        }
      });
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

    const isHtml = /text\/html/i.test(p.contentType);
    let rel = normalizePathForDisk(p.url);

    let outPath;
    if (isHtml) {
      rel = rel.replace(/\/$/, '');
      // If rel ends with 'index.html', save as .../index.html (not .../index.html/index.html)
      if (rel.endsWith('index.html')) {
        outPath = path.join(dir, rel);
      } else {
        outPath = path.join(dir, rel, 'index.html');
      }
    } else {
      outPath = path.join(dir, rel);
    }
    const outDir = path.dirname(outPath);

    // --- Handle file/dir collision for outDir ---
    if (await fs.pathExists(outDir)) {
      const stat = await fs.stat(outDir);
      if (stat.isFile()) {
        await fs.remove(outDir);
      }
    }
    await fs.ensureDir(outDir);

    // --- Handle dir/file collision for outPath ---
    if (await fs.pathExists(outPath)) {
      const stat = await fs.stat(outPath);
      if (stat.isDirectory()) {
        await fs.remove(outPath);
      }
    }

    if (isHtml) {
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

  // Save the homepage as index.html at the root of the snapshot directory
  if (pages.length > 0) {
    const mainPageUrl = pages[0].url;
    const mainRel = normalizePathForDisk(mainPageUrl);
    let mainPath;
    if (mainRel.endsWith('index.html')) {
      mainPath = path.join(dir, mainRel);
    } else {
      mainPath = path.join(dir, mainRel, 'index.html');
    }
    const rootIndex = path.join(dir, 'index.html');
    if (mainPath !== rootIndex && await fs.pathExists(mainPath)) {
      if (await fs.pathExists(rootIndex)) {
        const stat = await fs.stat(rootIndex);
        if (stat.isDirectory()) {
          await fs.remove(rootIndex);
        }
      }
      await fs.copyFile(mainPath, rootIndex);
      logger.info(`Copied main page to snapshot root: ${rootIndex}`);
    }
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