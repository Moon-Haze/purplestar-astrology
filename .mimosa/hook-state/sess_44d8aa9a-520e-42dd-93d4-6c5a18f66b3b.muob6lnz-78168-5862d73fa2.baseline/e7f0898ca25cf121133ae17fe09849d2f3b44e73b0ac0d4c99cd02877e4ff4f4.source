import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const getArg = (name: string, fallback: string) =>
  argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const out = path.resolve(root, getArg('out', './samples-out'));
const workers = Math.max(1, parseInt(getArg('workers', '6'), 10) || 6);
const startYear = 1924;
const endYear = 1983;
const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
const chunkSize = Math.ceil(years.length / workers);
const chunks = Array.from({ length: workers }, (_, i) => {
  const chunkYears = years.slice(i * chunkSize, (i + 1) * chunkSize);
  return chunkYears.length > 0
    ? { start: chunkYears[0], end: chunkYears[chunkYears.length - 1] }
    : null;
}).filter(Boolean) as Array<{ start: number; end: number }>;

console.log(`[full-parallel] workers=${chunks.length}, out=${out}`);

function prefixLines(prefix: string, chunk: Buffer) {
  const text = chunk.toString();
  text.split(/\r?\n/).forEach(line => {
    if (line.trim()) console.log(`${prefix} ${line}`);
  });
}

const results = await Promise.all(chunks.map(({ start, end }) => new Promise<number>((resolve) => {
  const prefix = `[${start}-${end}]`;
  const child = spawn('tsx', [
    'scripts/generate-samples.ts',
    '--mode=full',
    `--out=${out}`,
    `--year-start=${start}`,
    `--year-end=${end}`,
  ], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', chunk => prefixLines(prefix, chunk));
  child.stderr.on('data', chunk => prefixLines(`${prefix} stderr`, chunk));
  child.on('close', code => {
    console.log(`${prefix} exit=${code ?? 0}`);
    resolve(code ?? 0);
  });
})));

const failed = results.filter(code => code !== 0).length;
if (failed > 0) {
  console.error(`[full-parallel] failed workers=${failed}`);
  process.exit(1);
}

console.log('[full-parallel] all workers completed');
