import path from 'path';
import fs from 'fs-extra';
import { __dirname, normalizePathForDisk, toHost } from './utils.js';


const ROOT = path.join(__dirname, '..', 'data');
const SNAPROOT = path.join(ROOT, 'snapshots');
const MANIFEST = path.join(ROOT, 'manifest.json');


await fs.ensureDir(SNAPROOT);
if (!(await fs.pathExists(MANIFEST))) await fs.writeJson(MANIFEST, {});


export async function createSnapshotRoot(targetUrl, ts) {
const host = toHost(targetUrl);
const dir = path.join(SNAPROOT, host, ts);
await fs.ensureDir(dir);
return { dir, host };
}


export async function saveAsset({ host, ts }, absUrl, buffer) {
const rel = normalizePathForDisk(absUrl);
const out = path.join(SNAPROOT, host, ts, rel);
await fs.ensureDir(path.dirname(out));
await fs.writeFile(out, buffer);
return rel;
}


export async function listSnapshotsByUrl(targetUrl) {
const host = toHost(targetUrl);
const hostDir = path.join(SNAPROOT, host);
if (!await fs.pathExists(hostDir)) return [];
const tsList = (await fs.readdir(hostDir)).filter(f => /\d{14}/.test(f)).sort();
return tsList;
}


export async function recordCapture(targetUrl, ts) {
const m = await fs.readJson(MANIFEST);
const host = toHost(targetUrl);
m[host] = m[host] || [];
if (!m[host].includes(ts)) m[host].push(ts);
await fs.writeJson(MANIFEST, m, { spaces: 2 });
}


export async function getManifest() {
return fs.readJson(MANIFEST);
}