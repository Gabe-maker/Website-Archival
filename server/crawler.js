import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { isSameOrigin, isAsset, isHttp } from './utils.js';


export async function crawlSameOrigin(startUrl, { maxPages = 100, concurrency = 5 } = {}) {
const seen = new Set();
const queue = [startUrl];
const pages = [];
const limit = pLimit(concurrency);


async function fetchUrl(u) {
if (seen.has(u) || pages.length >= maxPages) return;
seen.add(u);
try {
const res = await axios.get(u, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Wayback-Lite/1.0' }});
const ct = res.headers['content-type'] || '';
const buf = Buffer.from(res.data);
pages.push({ url: u, contentType: ct, body: buf });


// Only parse links on HTML pages
if (/text\/html/i.test(ct)) {
const $ = cheerio.load(buf.toString('utf8'));
const links = new Set();
$('a[href], link[href], script[src], img[src], source[src]').each((_, el) => {
const attr = $(el).attr('href') || $(el).attr('src');
if (!attr) return;
try {
const abs = new URL(attr, u).toString();
if (!isHttp(abs)) return;
if (isSameOrigin(startUrl, abs)) links.add(abs);
} catch(e) {}
});
// enqueue HTML page links and asset links
for (const l of links) {
if (!seen.has(l)) queue.push(l);
}
}
} catch (e) {
// swallow; continue crawling
}
}


while (queue.length && pages.length < maxPages) {
const batch = queue.splice(0, concurrency);
await Promise.all(batch.map(u => limit(() => fetchUrl(u))));
}


return pages;
}