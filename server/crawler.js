import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { isSameOrigin, isAsset, isHttp } from './utils.js';

import { URL } from 'url';

export async function crawlSameOrigin(startUrl, { maxPages = 10, concurrency = 4, onProgress } = {}) {
  const visited = new Set();
  const queue = [startUrl];
  const results = [];

  async function fetchAndExtract(url) {
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      const contentType = res.headers['content-type'] || '';
      results.push({ url, body: res.data, contentType });
      if (onProgress) onProgress({ url, pageCount: results.length, total: maxPages, phase: 'crawl' });

      // Only parse HTML for links
      if (/text\/html/i.test(contentType)) {
        const html = res.data.toString('utf8');
        const links = Array.from(html.matchAll(/href\s*=\s*["']([^"']+)["']/gi))
          .map(m => m[1])
          .map(link => {
            try {
              return new URL(link, url).href;
            } catch { return null; }
          })
          .filter(href => href && href.startsWith(new URL(startUrl).origin));
        for (const link of links) {
          if (!visited.has(link) && visited.size + queue.length < maxPages) {
            queue.push(link);
          }
        }
      }
    } catch (e) {
      // Optionally log or ignore errors
    }
  }

  while (queue.length && visited.size < maxPages) {
    // Take up to `concurrency` URLs from the queue
    const batch = [];
    while (batch.length < concurrency && queue.length && visited.size + batch.length < maxPages) {
      const next = queue.shift();
      if (!visited.has(next)) {
        visited.add(next);
        batch.push(fetchAndExtract(next));
      }
    }
    // Wait for this batch to finish
    await Promise.all(batch);
  }

  return results;
}