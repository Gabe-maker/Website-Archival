import puppeteer from 'puppeteer';
import logger from './logger.js';

function isSameOrigin(url, base) {
  try {
    const u = new URL(url, base);
    const b = new URL(base);
    return u.origin === b.origin;
  } catch {
    return false;
  }
}

export async function crawlWithPuppeteer(startUrl, { outDir, maxPages = 20, concurrency = 1, onProgress } = {}) {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'true' });
    const visited = new Set();
    const queue = [startUrl];
    const pages = [];

    async function crawlUrl(url) {
      const page = await browser.newPage();
      try {
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        const html = await page.content();
        const contentType = await page.evaluate(() => document.contentType || 'text/html');
        pages.push({ url, contentType, body: Buffer.from(html, 'utf8') });
        // Extract and queue internal links
        const links = await page.$$eval('a[href]', as =>
          as.map(a => a.href).filter(href => !!href)
        );
        for (const link of links) {
          if (isSameOrigin(link, startUrl) && !visited.has(link) && !queue.includes(link) && visited.size + queue.length < maxPages) {
            queue.push(link);
          }
        }

        if (onProgress) {
          onProgress({ phase: 'crawl', pageCount: visited.size, url, total: maxPages });
        }
      } catch (e) {
        logger.error('Puppeteer page error:', e);
        throw e;
      } finally {
        await page.close();
      }
    }

      while (queue.length && visited.size < maxPages) {
        const batch = [];
        while (batch.length < concurrency && queue.length && visited.size + batch.length < maxPages) {
          const url = queue.shift();
          if (!visited.has(url)) {
            visited.add(url);
            batch.push(crawlUrl(url));
          }
        }
        await Promise.all(batch);
      }
      await browser.close();
      return pages;
    } catch (e) {
      logger.error('Puppeteer failed to launch or crawl:', {
        message: e && e.message,
        stack: e && e.stack,
        error: e
      });
      if (browser) await browser.close();
      throw e;
    }

  return pages;
}