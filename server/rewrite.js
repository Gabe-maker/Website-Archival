import { JSDOM } from 'jsdom';
import { isAsset, normalizePathForDisk } from './utils.js';


export function rewriteHtmlToLocal(html, baseUrl, tsBasePrefix) {
// tsBasePrefix: `/snapshots/<host>/<ts>/` for serving locally
const dom = new JSDOM(html);
const doc = dom.window.document;


const attrs = [
['a','href'], ['img','src'], ['link','href'], ['script','src'], ['source','src'], ['video','poster']
];


for (const [tag, attr] of attrs) {
doc.querySelectorAll(`${tag}[${attr}]`).forEach(el => {
const val = el.getAttribute(attr);
try {
const abs = new URL(val, baseUrl).toString();
const localPath = normalizePathForDisk(abs);
const newHref = `${tsBasePrefix}${localPath}`;
// For navigation links, keep same-origin only; otherwise leave absolute
if (tag === 'a' && !isAsset(abs)) {
el.setAttribute(attr, newHref);
} else if (isAsset(abs)) {
el.setAttribute(attr, newHref);
}
} catch(e) {}
});
}


// Add banner so users know it's a snapshot
const banner = doc.createElement('div');
banner.textContent = `Snapshot of ${baseUrl}`;
banner.setAttribute('style','position:fixed;top:0;left:0;right:0;background:#111;color:#fff;padding:6px;z-index:99999;font:12px/1.2 system-ui');
doc.body.prepend(banner);
const spacer = doc.createElement('div'); spacer.style.height = '26px';
doc.body.prepend(spacer);


return dom.serialize();
}