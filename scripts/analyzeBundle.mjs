// Simple bundle analyzer using rollup-plugin-visualizer output + size diff
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { gzipSync } from 'zlib';
import path from 'path';

// After vite build, gather dist/*.js sizes and compare to previous snapshot
const distDir = path.resolve('dist');
const snapshotFile = path.resolve('dist-size-snapshot.json');

function collect(dir = distDir, prefix = '') {
  if (!existsSync(dir)) return {};
  const entries = {};
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    const rel = path.join(prefix, f).replace(/\\/g,'/');
    const st = statSync(p);
    if (st.isDirectory()) {
      Object.assign(entries, collect(p, rel));
    } else if (f.endsWith('.js')) {
      const raw = readFileSync(p);
      entries[rel] = { size: st.size, gzip: gzipSync(raw).length };
    }
  }
  return entries;
}

const current = collect();
let previous = {};
if (existsSync(snapshotFile)) {
  try { previous = JSON.parse(readFileSync(snapshotFile,'utf-8')); } catch {}
}

const report = [];
let regression = false;
for (const [file, meta] of Object.entries(current)) {
  const size = meta.size;
  const gzip = meta.gzip;
  const before = previous[file];
  let beforeSize, beforeGzip;
  if (before && typeof before === 'object') { beforeSize = before.size; beforeGzip = before.gzip; }
  else if (typeof before === 'number') { beforeSize = before; }
  const diff = beforeSize != null ? size - beforeSize : 0;
  const diffGzip = beforeGzip != null ? gzip - beforeGzip : 0;
  const pct = beforeSize ? ((diff / beforeSize) * 100).toFixed(2) : 'new';
  report.push({ file, size, gzip, diff, diffGzip, pct });
  if (beforeSize && diff > 10240) { // >10KB growth triggers failure
    regression = true;
  }
}

console.log('Bundle size report:');
for (const r of report.sort((a,b)=>b.size-a.size)) {
  console.log(`${r.file}\t${(r.size/1024).toFixed(1)}KB (gz ${(r.gzip/1024).toFixed(1)}KB)\tΔ ${(r.diff/1024).toFixed(1)}KB gzΔ ${(r.diffGzip/1024).toFixed(1)}KB (${r.pct}%)`);
}

// Aggregate initial (heuristic: index chunk + any chunk containing 'index' or 'main')
const initial = report.filter(r => /index|main|entry/i.test(r.file));
const totalInitialGzip = initial.reduce((a,b)=>a+b.gzip,0);
console.log(`Initial heuristic gzip total: ${(totalInitialGzip/1024).toFixed(1)}KB`);

writeFileSync(snapshotFile, JSON.stringify(current, null, 2));

if (regression) {
  console.error('Bundle regression detected (>10KB growth in at least one chunk).');
  process.exit(1);
}
