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

export function normalizePathForDisk(url) {
  const u = new URL(url);
  let pathname = u.pathname;
  if (pathname === '/' || pathname === '') {
    return '_/index.html';
  }
  if (pathname.endsWith('/')) {
    return `_${pathname}index.html`;
  }
  return `_${pathname}`;
}

export function isAsset(href) {
  return /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|\.css|\.js|\.ico|\.woff2?|\.ttf)$/i.test(href);
}

export function isHttp(u) { return /^https?:\/\//i.test(u); }