import path from 'path';
import { fileURLToPath } from 'url';
import URL from 'url-parse';
import sanitize from 'sanitize-filename';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

export function toHost(url) {
  const u = new URL(url);
  return u.host;
}

export function isSameOrigin(a, b) {
  const ua = new URL(a);
  const ub = new URL(b);
  return ua.host === ub.host && ua.protocol === ub.protocol;
}

export function normalizePathForDisk(u) {
  // Convert a URL path to a safe file path
  const url = new URL(u);
  let p = url.pathname;
  if (!p || p.endsWith('/')) p += 'index.html';
  const safe = p.split('/').map(seg => sanitize(seg) || '_').join('/');
  return safe;
}

export function isAsset(href) {
  return /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|\.css|\.js|\.ico|\.woff2?|\.ttf)$/i.test(href);
}

export function isHttp(u) { return /^https?:\/\//i.test(u); }