import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const vaultDir = path.join(root, 'data/nihaixia/private-vault');
const inboxDir = path.join(vaultDir, 'inbox');
const registryDir = path.join(vaultDir, 'registry');
const chunksDir = path.join(vaultDir, 'chunks');
const reportDir = path.join(vaultDir, 'reports');
const sourceCatalogFile = path.join(registryDir, 'private-sources.catalog.jsonl');
const chunkFile = path.join(chunksDir, 'private-evidence-chunks.jsonl');
const reportFile = path.join(reportDir, 'private-vault-import-report.md');

type PrivateSource = {
  source_id: string;
  title: string;
  original_path: string;
  relative_path: string;
  media_type: string;
  text_ingest_status: 'ingested' | 'metadata_only' | 'empty_text' | 'unsupported_binary';
  storage_scope: 'private_user_scope_only';
  sha256: string;
  byte_size: number;
  mtime: string;
  extension: string;
  imported_at: string;
  chunk_count: number;
  notes: string;
};

type PrivateChunk = {
  chunk_id: string;
  source_id: string;
  chunk_index: number;
  text: string;
  char_start: number;
  char_end: number;
  sha256: string;
  tags: string[];
};

const textExtensions = new Set(['.txt', '.md', '.markdown', '.srt', '.vtt', '.csv', '.tsv']);
const metadataOnlyExtensions = new Set(['.pdf', '.mp3', '.m4a', '.wav', '.aac', '.flac', '.mp4', '.mov', '.mkv', '.avi']);

function ensureDirs() {
  for (const dir of [vaultDir, inboxDir, registryDir, chunksDir, reportDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(next);
    if (entry.isFile()) return [next];
    return [];
  });
}

function sha256(bytes: Buffer | string) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function mediaType(extension: string) {
  if (['.txt', '.md', '.markdown'].includes(extension)) return 'text';
  if (['.srt', '.vtt'].includes(extension)) return 'subtitle';
  if (['.csv', '.tsv'].includes(extension)) return 'table_text';
  if (extension === '.pdf') return 'pdf';
  if (['.mp3', '.m4a', '.wav', '.aac', '.flac'].includes(extension)) return 'audio';
  if (['.mp4', '.mov', '.mkv', '.avi'].includes(extension)) return 'video';
  return 'unknown';
}

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
}

function tagsFor(text: string) {
  const tags: string[] = [];
  const checks: Array<[string, RegExp]> = [
    ['daxian', /大限/],
    ['sihua', /四化|化禄|化权|化科|化忌/],
    ['palace_stem', /宫干/],
    ['five_tiger', /五虎遁/],
    ['liu_yue', /流月|月柱/],
    ['self_sihua', /自化/],
    ['laiyin', /来因宫/],
    ['health_mapping', /疾厄|脏腑|经络|子午流注|肝|肾|脾胃/],
    ['patterns', /格局|魁钺夹命|羊陀夹命|火铃夹命|禄马交驰/],
    ['warning_phrase', /田宅化忌|福德宫化忌|半空折翅|命运不是人生的全部/],
  ];
  for (const [tag, re] of checks) {
    if (re.test(text)) tags.push(tag);
  }
  return tags;
}

function chunkText(sourceId: string, text: string): PrivateChunk[] {
  const chunks: PrivateChunk[] = [];
  const maxChars = 1200;
  const overlap = 160;
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const splitAt = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('。'), window.lastIndexOf('\n'));
      if (splitAt > 400) end = start + splitAt + 1;
    }

    const body = text.slice(start, end).trim();
    if (body.length > 0) {
      const digest = sha256(body);
      chunks.push({
        chunk_id: `${sourceId}-chunk-${String(index + 1).padStart(5, '0')}`,
        source_id: sourceId,
        chunk_index: index,
        text: body,
        char_start: start,
        char_end: end,
        sha256: digest,
        tags: tagsFor(body),
      });
      index++;
    }

    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

function titleFromFile(file: string) {
  return path.basename(file).replace(/\.[^.]+$/, '');
}

function main() {
  ensureDirs();
  const now = new Date().toISOString();
  const files = walkFiles(inboxDir)
    .filter(file => !path.basename(file).startsWith('.'))
    .sort();
  const sources: PrivateSource[] = [];
  const chunks: PrivateChunk[] = [];

  for (const file of files) {
    const bytes = fs.readFileSync(file);
    const digest = sha256(bytes);
    const stat = fs.statSync(file);
    const extension = path.extname(file).toLowerCase();
    const sourceId = `private-${digest.slice(0, 16)}`;
    const relativePath = path.relative(inboxDir, file);
    let textStatus: PrivateSource['text_ingest_status'] = 'metadata_only';
    let sourceChunks: PrivateChunk[] = [];
    let notes = 'Private user-scope source. Not from public crawler.';

    if (textExtensions.has(extension)) {
      const text = normalizeText(bytes.toString('utf8'));
      if (text.length === 0) {
        textStatus = 'empty_text';
        notes = 'Text file is empty after normalization.';
      } else {
        sourceChunks = chunkText(sourceId, text);
        textStatus = sourceChunks.length > 0 ? 'ingested' : 'empty_text';
      }
    } else if (metadataOnlyExtensions.has(extension)) {
      textStatus = 'unsupported_binary';
      notes = 'Binary media/PDF recorded as private metadata only. Provide transcript/OCR as .txt/.md/.srt/.vtt for text evidence chunks.';
    }

    chunks.push(...sourceChunks);
    sources.push({
      source_id: sourceId,
      title: titleFromFile(file),
      original_path: file,
      relative_path: relativePath,
      media_type: mediaType(extension),
      text_ingest_status: textStatus,
      storage_scope: 'private_user_scope_only',
      sha256: digest,
      byte_size: stat.size,
      mtime: stat.mtime.toISOString(),
      extension,
      imported_at: now,
      chunk_count: sourceChunks.length,
      notes,
    });
  }

  fs.writeFileSync(sourceCatalogFile, sources.map(row => JSON.stringify(row)).join('\n') + (sources.length ? '\n' : ''));
  fs.writeFileSync(chunkFile, chunks.map(row => JSON.stringify(row)).join('\n') + (chunks.length ? '\n' : ''));

  const taggedChunks = chunks.filter(chunk => chunk.tags.length > 0).length;
  const report = [
    '# 私有学习资料导入报告',
    '',
    `生成时间：${now}`,
    `inbox：${path.relative(root, inboxDir)}`,
    `私有来源数：${sources.length}`,
    `文本切片数：${chunks.length}`,
    `含主题标签切片：${taggedChunks}`,
    `二进制/PDF metadata-only：${sources.filter(source => source.text_ingest_status === 'unsupported_binary').length}`,
    '',
    '## 边界',
    '',
    '- 该目录用于用户本机私有学习资料，不由公网爬虫写入。',
    '- `.txt` / `.md` / `.srt` / `.vtt` 会生成私有证据切片。',
    '- `.pdf` / 音频 / 视频只记录 hash 和 metadata；如需证据切片，请放入你已有的转写/OCR 文本。',
    '- 输出文件只在本地 workspace 内，不进入公开来源目录。',
  ].join('\n');

  fs.writeFileSync(reportFile, `${report}\n`);
  console.log(report);
}

main();
