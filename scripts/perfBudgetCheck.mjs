import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const root = path.resolve(process.cwd(), 'dist');
let assetsDir = root;
if (fs.existsSync(path.join(root,'assets'))) assetsDir = path.join(root,'assets');
if (!fs.existsSync(root)) { console.error('dist not found'); process.exit(1); }
const files = fs.readdirSync(assetsDir).filter(f=>/\.js$/.test(f));
if (!files.length) { console.error('no js assets'); process.exit(1); }
const sized = files.map(f=>({f,size:fs.statSync(path.join(assetsDir,f)).size, gz:zlib.gzipSync(fs.readFileSync(path.join(assetsDir,f))).length})).sort((a,b)=>b.size-a.size);
const main = sized[0];
const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'),'utf8'));
const limit = pkg.perfBudget?.maxMainGzipBytes || 130000;
console.log(`Largest chunk: ${main.f} gzip=${main.gz}B limit=${limit}B`);
if (main.gz > limit) { console.error(`❌ Main bundle over budget`); process.exit(2); }

// Aggregate critical path: treat all js in index as initial (simple heuristic)
const indexHtml = fs.readFileSync(path.join(root,'index.html'),'utf8');
const scriptMatches = [...indexHtml.matchAll(/src="\.\/assets\/(.*?)\.js"/g)].map(m=>m[1]);
const initial = sized.filter(s => scriptMatches.some(name => s.f.startsWith(name)));
const totalInitialGzip = initial.reduce((acc,s)=>acc+s.gz,0);
const aggLimit = (pkg.perfBudget?.maxInitialGzipBytes) || (limit + 50000); // allow some overhead above single limit
console.log(`Initial chunks total gzip=${totalInitialGzip}B aggLimit=${aggLimit}B`);
if (totalInitialGzip > aggLimit) { console.error('❌ Initial critical path over aggregate budget'); process.exit(3); }
console.log('✅ Performance budgets OK');